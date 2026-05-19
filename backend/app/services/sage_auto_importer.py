"""
Sage 100 Auto Import service.

This module integrates the old standalone `sage import.py` watcher inside the
FastAPI backend. When enabled, the backend starts a background thread that
watches the Sage pending folder and imports every generated TXT file into
Sage 100 Comptabilite through Windows UI automation.

IMPORTANT:
- Works only on Windows where Sage desktop is installed.
- Requires optional packages: pywin32 and pywinauto.
- Keep disabled in Docker/Linux production unless the container has access to
  a real Windows desktop session, which is usually not the case.
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

log = logging.getLogger(__name__)


def _bool_env(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


class SageAutoImporter:
    def __init__(self) -> None:
        self.watch_folder = Path(os.getenv("SAGE_AUTO_IMPORT_FOLDER", r"C:\SAGE_AUTO_IMPORT\pending"))
        self.imported_folder = Path(os.getenv("SAGE_IMPORTED_FOLDER", r"C:\SAGE_AUTO_IMPORT\imported"))
        self.error_folder = Path(os.getenv("SAGE_ERROR_FOLDER", r"C:\SAGE_AUTO_IMPORT\errors"))
        self.log_file = Path(os.getenv("SAGE_IMPORT_LOG_FILE", r"C:\SAGE_AUTO_IMPORT\logs\import.log"))

        self.sage_exe_path = os.getenv("SAGE_EXE_PATH", r"C:\Program Files (x86)\Sage\iComptabilité\Maestria.exe")
        self.sage_process_name = os.getenv("SAGE_PROCESS_NAME", "Maestria.exe")
        self.mae_file = Path(os.getenv("SAGE_MAE_FILE", r"C:\Users\dell\Downloads\import vente us.ema"))

        self.sage_startup_wait = int(os.getenv("SAGE_STARTUP_WAIT", "15"))
        self.scan_interval = int(os.getenv("SAGE_SCAN_INTERVAL", "5"))
        self.allowed_extensions = tuple(
            ext.strip().lower()
            for ext in os.getenv("SAGE_ALLOWED_EXTENSIONS", ".txt").split(",")
            if ext.strip()
        )
        self.ignore_popup_titles = tuple(
            title.strip().lower()
            for title in os.getenv(
                "SAGE_IGNORE_POPUP_TITLES",
                "ouvrir le format param,ouvrir le fichier d'import,ouvrir,sage 100 comptabilité,uis2026",
            ).split(",")
            if title.strip()
        )
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.last_status = "stopped"
        self.last_error: Optional[str] = None
        self.last_processed_file: Optional[str] = None

    def start_background(self) -> bool:
        """Start the watcher once. Returns True if started or already running."""
        if self._thread and self._thread.is_alive():
            return True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self.run_forever, name="sage-auto-importer", daemon=True)
        self._thread.start()
        self.last_status = "running"
        log.info("Sage auto importer started in background.")
        return True

    def stop(self) -> None:
        self._stop_event.set()
        self.last_status = "stopping"

    def status(self) -> dict:
        return {
            "enabled": _bool_env("SAGE_AUTO_IMPORT_ENABLED", "false"),
            "running": bool(self._thread and self._thread.is_alive()),
            "status": self.last_status,
            "last_error": self.last_error,
            "last_processed_file": self.last_processed_file,
            "watch_folder": str(self.watch_folder),
            "imported_folder": str(self.imported_folder),
            "error_folder": str(self.error_folder),
            "mae_file": str(self.mae_file),
            "sage_exe_path": self.sage_exe_path,
        }

    # ───────────────────────────── lazy Windows imports ──────────────────────
    def _windows_modules(self):
        try:
            import win32api
            import win32clipboard
            import win32con
            import win32gui
            import win32process
            from pywinauto.keyboard import send_keys
        except Exception as exc:  # pragma: no cover - depends on Windows host
            raise RuntimeError(
                "Sage automation requires Windows packages. Install them with: "
                "pip install -r requirements-windows-sage.txt"
            ) from exc
        return win32api, win32clipboard, win32con, win32gui, win32process, send_keys

    # ───────────────────────────── low-level helpers ─────────────────────────
    def set_clipboard(self, text: str) -> None:
        _, win32clipboard, _, _, _, _ = self._windows_modules()
        win32clipboard.OpenClipboard()
        try:
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardText(text, win32clipboard.CF_UNICODETEXT)
        finally:
            win32clipboard.CloseClipboard()

    def find_window_by_title(self, title_contains: str, timeout: int = 10) -> Optional[int]:
        _, _, _, win32gui, _, _ = self._windows_modules()
        start = time.time()
        while time.time() - start < timeout:
            result = []

            def cb(hwnd, _):
                if win32gui.IsWindowVisible(hwnd):
                    title = win32gui.GetWindowText(hwnd)
                    if title_contains.lower() in title.lower():
                        result.append(hwnd)

            win32gui.EnumWindows(cb, None)
            if result:
                return result[0]
            time.sleep(0.3)
        return None

    def force_foreground(self, hwnd: int) -> None:
        win32api, _, win32con, win32gui, win32process, _ = self._windows_modules()
        try:
            current_thread = win32api.GetCurrentThreadId()
            target_thread, _ = win32process.GetWindowThreadProcessId(hwnd)
            attached = False
            if current_thread != target_thread:
                win32process.AttachThreadInput(current_thread, target_thread, True)
                attached = True
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            win32gui.BringWindowToTop(hwnd)
            win32gui.SetForegroundWindow(hwnd)
            if attached:
                win32process.AttachThreadInput(current_thread, target_thread, False)
            time.sleep(0.3)
        except Exception as exc:
            log.warning("force_foreground failed: %s", exc)

    def force_focus(self, hwnd_parent: int, hwnd_child: int) -> None:
        win32api, _, _, win32gui, win32process, _ = self._windows_modules()
        current_thread = win32api.GetCurrentThreadId()
        target_thread, _ = win32process.GetWindowThreadProcessId(hwnd_parent)
        attached = False
        try:
            if current_thread != target_thread:
                win32process.AttachThreadInput(current_thread, target_thread, True)
                attached = True
            win32gui.SetFocus(hwnd_child)
            time.sleep(0.2)
        except Exception as exc:
            log.warning("force_focus failed: %s", exc)
        finally:
            if attached:
                try:
                    win32process.AttachThreadInput(current_thread, target_thread, False)
                except Exception:
                    pass

    def find_child_by_class(self, parent_hwnd: int, class_name: str) -> list[int]:
        _, _, _, win32gui, _, _ = self._windows_modules()
        result: list[int] = []

        def cb(hwnd, _):
            if win32gui.GetClassName(hwnd) == class_name:
                result.append(hwnd)

        win32gui.EnumChildWindows(parent_hwnd, cb, None)
        return result

    def find_button_by_text(self, parent_hwnd: int, btn_text: str) -> Optional[int]:
        _, _, _, win32gui, _, _ = self._windows_modules()
        result: list[int] = []

        def cb(hwnd, _):
            if win32gui.GetClassName(hwnd) == "Button":
                title = win32gui.GetWindowText(hwnd)
                if btn_text.lower() in title.lower():
                    result.append(hwnd)

        win32gui.EnumChildWindows(parent_hwnd, cb, None)
        return result[0] if result else None

    def click_button(self, hwnd_btn: int) -> None:
        _, _, win32con, win32gui, _, _ = self._windows_modules()
        win32gui.SendMessage(hwnd_btn, win32con.BM_CLICK, 0, 0)

    # ───────────────────────────── process helpers ───────────────────────────
    @staticmethod
    def is_file_ready(path: Path) -> bool:
        try:
            size_1 = path.stat().st_size
            time.sleep(1)
            size_2 = path.stat().st_size
            return size_1 == size_2
        except OSError:
            return False

    @staticmethod
    def move_file(src: Path, dest_folder: Path) -> Path:
        dest_folder.mkdir(parents=True, exist_ok=True)
        dest = dest_folder / src.name
        if dest.exists():
            dest = dest_folder / f"{src.stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{src.suffix}"
        shutil.move(str(src), str(dest))
        return dest

    def is_sage_running(self) -> bool:
        result = subprocess.run(
            ["tasklist", "/FI", f"IMAGENAME eq {self.sage_process_name}", "/NH"],
            capture_output=True,
            text=True,
            check=False,
        )
        return self.sage_process_name.lower() in result.stdout.lower()

    def launch_sage(self) -> None:
        if self.is_sage_running():
            log.info("Sage is already open.")
            return
        subprocess.Popen([self.sage_exe_path])
        log.info("Sage launched. Waiting %ss...", self.sage_startup_wait)
        time.sleep(self.sage_startup_wait)

    def open_import_menu(self) -> None:
        *_, send_keys = self._windows_modules()
        hwnd = self.find_window_by_title("Sage 100 Comptabilité", timeout=5)
        if not hwnd:
            hwnd = self.find_window_by_title("UIS2026", timeout=5)
        if not hwnd:
            raise RuntimeError("Fenêtre Sage principale introuvable.")
        self.force_foreground(hwnd)
        send_keys("%f")
        time.sleep(0.8)
        send_keys("i")
        time.sleep(0.8)
        send_keys("p")
        time.sleep(1.5)

    def fill_dialog(self, file_path: Path, dialog_title: str) -> None:
        *_, send_keys = self._windows_modules()
        hwnd = self.find_window_by_title(dialog_title, timeout=10)
        if not hwnd:
            raise RuntimeError(f"Boîte de dialogue introuvable: {dialog_title}")
        edits = self.find_child_by_class(hwnd, "Edit")
        if not edits:
            raise RuntimeError("Champ 'Nom du fichier' introuvable.")
        edit_hwnd = edits[0]
        self.force_foreground(hwnd)
        self.force_focus(hwnd, edit_hwnd)
        send_keys("^a")
        time.sleep(0.2)
        send_keys("{DELETE}")
        time.sleep(0.2)
        self.set_clipboard(str(file_path))
        send_keys("^v")
        time.sleep(0.4)
        send_keys("{ENTER}")
        time.sleep(2)

    def close_sage_result_popups(self, timeout: int = 15) -> None:
        _, _, _, win32gui, win32process, _ = self._windows_modules()
        sage_hwnd = self.find_window_by_title("Sage 100 Comptabilité", timeout=3)
        if not sage_hwnd:
            sage_hwnd = self.find_window_by_title("UIS2026", timeout=3)
        if not sage_hwnd:
            log.warning("Sage main window not found for popup filtering.")
            return
        _, sage_pid = win32process.GetWindowThreadProcessId(sage_hwnd)
        start = time.time()
        while time.time() - start < timeout:
            found_popup = False

            def cb(hwnd, _):
                nonlocal found_popup
                if not win32gui.IsWindowVisible(hwnd) or hwnd == sage_hwnd:
                    return
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                if pid != sage_pid:
                    return
                title = win32gui.GetWindowText(hwnd)
                if not title:
                    return
                title_lower = title.lower()
                if any(ignored in title_lower for ignored in self.ignore_popup_titles):
                    return
                for label in ("OK", "Fermer", "Terminer", "Oui"):
                    btn = self.find_button_by_text(hwnd, label)
                    if btn:
                        self.click_button(btn)
                        found_popup = True
                        time.sleep(0.5)
                        break

            win32gui.EnumWindows(cb, None)
            if not found_popup:
                break
            time.sleep(1)

    def import_parametrable(self, txt_file: Path) -> bool:
        try:
            self.open_import_menu()
            log.info("Sage import step 1/2: MAE model")
            self.fill_dialog(self.mae_file, "Ouvrir le format param")
            log.info("Sage import step 2/2: TXT file")
            self.fill_dialog(txt_file, "Ouvrir le fichier d")
            time.sleep(3)
            self.close_sage_result_popups(timeout=15)
            log.info("Sage import completed: %s", txt_file.name)
            return True
        except Exception as exc:
            self.last_error = str(exc)
            log.exception("Sage import failed: %s", exc)
            return False

    def process_file(self, file_path: Path) -> None:
        if file_path.suffix.lower() not in self.allowed_extensions:
            return
        if not self.is_file_ready(file_path):
            log.warning("File not stable yet: %s", file_path.name)
            return
        if not self.mae_file.is_file():
            raise RuntimeError(f"Modèle .MAE introuvable: {self.mae_file}")
        log.info("Processing Sage file: %s", file_path.name)
        self.launch_sage()
        success = self.import_parametrable(file_path)
        if success:
            dest = self.move_file(file_path, self.imported_folder)
            self.last_processed_file = str(dest)
            self.last_status = "imported"
        else:
            dest = self.move_file(file_path, self.error_folder)
            self.last_processed_file = str(dest)
            self.last_status = "error"

    def run_once(self) -> None:
        for folder in (self.watch_folder, self.imported_folder, self.error_folder, self.log_file.parent):
            folder.mkdir(parents=True, exist_ok=True)
        files = [p for p in self.watch_folder.iterdir() if p.is_file()]
        for file_path in files:
            self.process_file(file_path)

    def run_forever(self) -> None:
        self.last_status = "running"
        log.info("Sage 100 Auto Import watcher started. Folder: %s", self.watch_folder)
        while not self._stop_event.is_set():
            try:
                self.run_once()
            except Exception as exc:
                self.last_error = str(exc)
                self.last_status = "error"
                log.exception("Sage watcher loop error: %s", exc)
            self._stop_event.wait(self.scan_interval)
        self.last_status = "stopped"
        log.info("Sage 100 Auto Import watcher stopped.")


sage_auto_importer = SageAutoImporter()


def start_sage_auto_importer_if_enabled() -> None:
    if not _bool_env("SAGE_AUTO_IMPORT_ENABLED", "false"):
        log.info("Sage auto importer disabled. Set SAGE_AUTO_IMPORT_ENABLED=true to enable it.")
        return
    sage_auto_importer.start_background()
