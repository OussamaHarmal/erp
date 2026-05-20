"""
Sage 100 Comptabilité i7 export helpers.

Format generated for the Sage .MAE accounting canvas validated by the client:

Code journal;Date pièce;N° pièce;N° facture;Référence;N° compte général;N° compte tiers;Libellé écriture;Date échéance;Débit;Crédit

Important Sage rules:
- No header in the import TXT file.
- Encoding must be Windows ANSI / cp1252.
- Line endings must be CRLF.
- First column is Code journal, for example VTE.
- Date pièce uses JJMMAA, for example 210326.
- Due date uses JJMMAA, for example 200426.
- Amounts use comma decimals, for example 42000,00.
- Each invoice is exported as 2 or 3 balanced accounting lines.
"""
from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, List, Optional

from app.models import Invoice


@dataclass
class SageExportConfig:
    journal_code: str = "VTE"
    client_account: str = "34210000"
    sales_account: str = "71243000"
    vat_account: str = "44550000"
    default_tiers_code: str = "B01"
    line_ending: str = "\r\n"
    encoding: str = "cp1252"


def clean_sage_text(value: object, max_len: int = 80) -> str:
    text = str(value or "")
    text = text.replace("\ufeff", "")
    text = text.replace(";", " ")
    text = text.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


def sage_date(dt: Optional[datetime]) -> str:
    return dt.strftime("%d%m%y") if dt else ""



def sage_amount(value: object) -> str:
    if value in (None, ""):
        return ""
    return f"{float(value or 0):.2f}".replace(".", ",")


def normalized_piece(invoice_number: object) -> str:
    raw = clean_sage_text(invoice_number, 30)
    raw = raw.replace("-", "").replace("/", "")
    return raw[:20] or "FACTURE"


def sage_piece_number(invoice: Invoice) -> str:
    """Short N° pièce like the Sage canvas. Uses digits from invoice number when possible."""
    raw = clean_sage_text(invoice.invoice_number, 30)
    digits = "".join(ch for ch in raw if ch.isdigit())
    if digits:
        return str(int(digits[-6:]))
    return normalized_piece(raw)[:10]


def invoice_reference(invoice: Invoice) -> str:
    """Reference column requested in the .MAE format."""
    contract = getattr(invoice, "contract", None)
    if contract and getattr(contract, "contract_number", None):
        return clean_sage_text(contract.contract_number, 30)
    return clean_sage_text(invoice.invoice_number, 30)


def invoice_client_label(invoice: Invoice) -> str:
    profile = invoice.client.profile if invoice.client and invoice.client.profile else None
    if profile:
        return clean_sage_text(
            profile.company_name
            or f"{profile.first_name or ''} {profile.last_name or ''}".strip()
            or invoice.client.email
        )
    return clean_sage_text(invoice.client_id)


def invoice_tiers_code(invoice: Invoice, config: SageExportConfig) -> str:
    profile = invoice.client.profile if invoice.client and invoice.client.profile else None
    candidate = clean_sage_text(getattr(profile, "company_rc", "") if profile else "", 17).upper()
    if candidate and re.fullmatch(r"[A-Z0-9_-]{1,17}", candidate):
        return candidate
    return config.default_tiers_code


def invoice_label(invoice: Invoice) -> str:
    piece = normalized_piece(invoice.invoice_number)
    client = invoice_client_label(invoice)
    duration = f" {invoice.duration_months}MOIS" if invoice.duration_months else ""
    base = f"DOM {piece} {client}{duration}"
    return clean_sage_text(base.upper(), 80)


def build_invoice_sage_lines(invoice: Invoice, config: SageExportConfig | None = None) -> List[str]:
    config = config or SageExportConfig()

    # ===== SECURE VALUES =====
    total = float(invoice.total or 0)
    subtotal = float(invoice.subtotal or 0)
    tax_amount = float(invoice.tax_amount or 0)

    if total <= 0:
        return []

    date_piece = sage_date(invoice.issue_date)
    piece = sage_piece_number(invoice)

    invoice_no = clean_sage_text(
        str(invoice.invoice_number or "FACTURE"),
        30
    )

    reference = clean_sage_text(
        str(invoice_reference(invoice) or ""),
        30
    )

    tiers = clean_sage_text(
        str(invoice_tiers_code(invoice, config) or "CLIENT"),
        17
    )

    label = clean_sage_text(
        str(invoice_label(invoice) or "VENTE"),
        80
    )

    due_date = sage_date(invoice.due_date)

    debit_ttc = sage_amount(total)
    credit_ht = sage_amount(subtotal)
    credit_tva = sage_amount(tax_amount)

    lines = []

    # CLIENT TTC
    lines.append([
        config.journal_code,
        date_piece,
        piece,
        invoice_no,
        reference,
        config.client_account,
        tiers,
        label,
        due_date,
        debit_ttc,
        ""
    ])

    # VENTE HT
    lines.append([
        config.journal_code,
        date_piece,
        piece,
        invoice_no,
        reference,
        config.sales_account,
        "",
        label,
        "",
        "",
        credit_ht
    ])

    # TVA
    if tax_amount > 0:
        lines.append([
            config.journal_code,
            date_piece,
            piece,
            invoice_no,
            reference,
            config.vat_account,
            "",
            f"TVA 20 {label}"[:80],
            "",
            "",
            credit_tva
        ])

    # ===== CLEAN ROWS =====
    clean_lines = []

    for row in lines:
        clean_row = [str(x or "") for x in row]
        clean_lines.append(";".join(clean_row))

    return clean_lines
def validate_sage_invoice(invoice: Invoice) -> List[str]:
    errors: List[str] = []
    if not invoice.issue_date:
        errors.append(f"{invoice.invoice_number}: date de pièce manquante")
    if not invoice.due_date:
        errors.append(f"{invoice.invoice_number}: date d'échéance manquante")
    if not invoice.invoice_number:
        errors.append("N° facture manquant")
    debit = round(float(invoice.total or 0), 2)
    credit = round(float(invoice.subtotal or 0) + float(invoice.tax_amount or 0), 2)
    if debit != credit:
        errors.append(f"{invoice.invoice_number}: écriture non équilibrée débit={debit:.2f} crédit={credit:.2f}")
    return errors


def build_sage_txt(invoices: Iterable[Invoice], config: SageExportConfig | None = None) -> str:
    config = config or SageExportConfig()
    lines: List[str] = []
    for invoice in invoices:
        lines.extend(build_invoice_sage_lines(invoice, config))
    return config.line_ending.join(lines) + config.line_ending


def build_sage_bytes(invoices: Iterable[Invoice], config: SageExportConfig | None = None) -> bytes:
    config = config or SageExportConfig()
    txt = build_sage_txt(invoices, config)

    if not txt.strip():
        txt = "VIDE;VIDE;VIDE\r\n"

    return txt.encode(config.encoding, errors="replace")

def build_sage_zip_by_period(invoices: Iterable[Invoice], config: SageExportConfig | None = None) -> bytes:
    config = config or SageExportConfig()
    grouped: dict[str, list[Invoice]] = {}
    for inv in invoices:
        key = inv.issue_date.strftime("%Y-%m") if inv.issue_date else "unknown"
        grouped.setdefault(key, []).append(inv)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for period, items in sorted(grouped.items()):
            zf.writestr(f"SAGE_VENTES_{period}.txt", build_sage_bytes(items, config))
    buffer.seek(0)
    return buffer.getvalue()

from pathlib import Path
from datetime import datetime
import os

SAGE_AUTO_IMPORT_FOLDER = Path(os.getenv("SAGE_AUTO_IMPORT_FOLDER", r"C:\SAGE_AUTO_IMPORT\pending"))

def export_sage_to_auto_import_folder(invoices, config: SageExportConfig | None = None) -> str:
    config = config or SageExportConfig()
    SAGE_AUTO_IMPORT_FOLDER.mkdir(parents=True, exist_ok=True)

    filename = f"SAGE_VENTES_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    file_path = SAGE_AUTO_IMPORT_FOLDER / filename

    content = build_sage_bytes(invoices, config)

    with open(file_path, "wb") as f:
        f.write(content)

    return str(file_path)