"""SMTP email helpers for Universal Invest Strategy.

The service is safe by default: if SMTP_HOST is not configured, it returns
False instead of breaking the contract/invoice workflow.
"""
from __future__ import annotations

from email.message import EmailMessage
from pathlib import Path
import mimetypes
import smtplib
from typing import Iterable, Optional

from ..config import settings


def smtp_is_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


def send_email_with_attachments(
    to_email: str,
    subject: str,
    body: str,
    attachments: Optional[Iterable[str]] = None,
) -> bool:
    """Send an email with optional attachments.

    Returns True when sent, False when SMTP is not configured or recipient missing.
    Raises only for real SMTP failures so logs can catch problems during dev.
    """
    if not to_email or not smtp_is_configured():
        return False

    msg = EmailMessage()
    sender = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{sender}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    for file_path in attachments or []:
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            continue
        mime_type, _ = mimetypes.guess_type(str(path))
        maintype, subtype = (mime_type or "application/octet-stream").split("/", 1)
        msg.add_attachment(
            path.read_bytes(),
            maintype=maintype,
            subtype=subtype,
            filename=path.name,
        )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)
    return True


def send_contract_invoice_email(client_email: str, contract, invoice, attachments: list[str]) -> bool:
    invoice_number = invoice.invoice_number if invoice else "sans facture"
    subject = f"Votre contrat et facture - {contract.contract_number}"
    body = f"""Bonjour,

Votre demande de contrat de domiciliation a bien été reçue.

Vous trouverez en pièces jointes :
- le contrat de domiciliation ({contract.contract_number})
- la facture associée ({invoice_number})

Le contrat reste soumis à validation par la direction Universal Invest Strategy.

Cordialement,
Universal Invest Strategy
"""
    return send_email_with_attachments(client_email, subject, body, attachments)
