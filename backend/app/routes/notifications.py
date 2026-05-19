import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .contracts import sync_contract_statuses
from ..middleware.rbac import require_any_authenticated
from ..models import Contract, ContractStatus, Invoice, InvoiceStatus, Notification, NotificationType, User, UserRole
from ..schemas.schemas import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])

def _generate_notifications(db: Session, current_user: User) -> None:
    now = datetime.utcnow()
    soon = now + timedelta(days=30)
    sync_contract_statuses(db)
    contracts_query = db.query(Contract).filter(
        Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.APPROVED, ContractStatus.EXPIRED]),
        Contract.end_date.isnot(None),
        Contract.end_date <= soon,
    )
    invoices_query = db.query(Invoice).filter(
        Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
        Invoice.due_date < now,
    )
    if current_user.role != UserRole.DIRECTEUR:
        contracts_query = contracts_query.filter(Contract.client_id == current_user.id)
        invoices_query = invoices_query.filter(Invoice.client_id == current_user.id)
    director_users = db.query(User).filter(User.role == UserRole.DIRECTEUR).all() if current_user.role == UserRole.DIRECTEUR else []

    for contract in contracts_query.all():
        is_expired = bool(contract.end_date and contract.end_date < now)
        key = f"contract-expiring:{contract.id}:{contract.end_date.strftime('%Y%m%d')}:{'expired' if is_expired else 'soon'}"
        exists = db.query(Notification.id).filter(
            Notification.user_id == contract.client_id,
            Notification.source_key == key,
        ).first()
        if not exists:
            title = "Contrat expire" if is_expired else "Contrat proche expiration"
            message = (
                f"Votre contrat {contract.contract_number} est expire. Cliquez pour demander un renouvellement."
                if is_expired
                else f"Votre contrat {contract.contract_number} expire bientot. Cliquez pour demander un renouvellement."
            )
            db.add(Notification(
                user_id=contract.client_id,
                type=NotificationType.CONTRACT_EXPIRING,
                title=title,
                message=message,
                action_url=f"/client/contracts?contractId={contract.id}",
                source_key=key,
            ))
        for director in director_users:
            director_key = f"{key}:director:{director.id}"
            exists_director = db.query(Notification.id).filter(
                Notification.user_id == director.id,
                Notification.source_key == director_key,
            ).first()
            if exists_director:
                continue
            db.add(Notification(
                user_id=director.id,
                type=NotificationType.CONTRACT_EXPIRING,
                title="Contrat client a renouveler",
                message=f"Le contrat {contract.contract_number} du client {contract.client_id} est a traiter.",
                action_url=f"/director/contracts?contractId={contract.id}",
                source_key=director_key,
            ))

    for invoice in invoices_query.all():
        invoice.status = InvoiceStatus.OVERDUE
        key = f"invoice-overdue:{invoice.id}:{invoice.due_date.strftime('%Y%m%d')}"
        exists = db.query(Notification.id).filter(
            Notification.user_id == invoice.client_id,
            Notification.source_key == key,
        ).first()
        if not exists:
            db.add(Notification(
                user_id=invoice.client_id,
                type=NotificationType.INVOICE_OVERDUE,
                title="Facture echue",
                message=f"Votre facture {invoice.invoice_number} est echue depuis le {invoice.due_date.strftime('%d/%m/%Y')}.",
                action_url=f"/client/invoices?invoiceId={invoice.id}",
                source_key=key,
            ))
        for director in director_users:
            director_key = f"{key}:director:{director.id}"
            exists_director = db.query(Notification.id).filter(
                Notification.user_id == director.id,
                Notification.source_key == director_key,
            ).first()
            if exists_director:
                continue
            db.add(Notification(
                user_id=director.id,
                type=NotificationType.INVOICE_OVERDUE,
                title="Facture client echue",
                message=f"La facture {invoice.invoice_number} est en retard et necessite une action.",
                action_url=f"/director/invoices?invoiceId={invoice.id}",
                source_key=director_key,
            ))
    db.commit()


@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    unread_only: bool = Query(False),
    type: Optional[NotificationType] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    generate: bool = Query(True),
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    if generate:
        _generate_notifications(db, current_user)
    query = db.query(Notification).order_by(Notification.created_at.desc())
    if current_user.role != UserRole.DIRECTEUR:
        query = query.filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    if type:
        query = query.filter(Notification.type == type)
    return query.limit(limit).all()


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if current_user.role != UserRole.DIRECTEUR and notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.patch("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    query = db.query(Notification).filter(Notification.is_read == False)  # noqa: E712
    if current_user.role != UserRole.DIRECTEUR:
        query = query.filter(Notification.user_id == current_user.id)
    updated = query.update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"updated": updated}


@router.delete("/delete-all")
def delete_all_notifications(
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    query = db.query(Notification)
    if current_user.role != UserRole.DIRECTEUR:
        query = query.filter(Notification.user_id == current_user.id)
    deleted = query.delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}
