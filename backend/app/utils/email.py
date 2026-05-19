"""Backward-compatible email helper.

Use app.services.email_service in new code. This module exists because some
older Smart CMS instructions imported app.utils.email directly.
"""
from app.services.email_service import (
    smtp_is_configured,
    send_email_with_attachments,
    send_contract_invoice_email,
)


def send_email(to_email: str, subject: str, body: str, attachments=None) -> bool:
    """Simple wrapper used by older route code/examples."""
    return send_email_with_attachments(
        to_email=to_email,
        subject=subject,
        body=body,
        attachments=attachments or [],
    )
