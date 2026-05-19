"""
Analytics Routes
Dashboard statistics and metrics for DIRECTEUR
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, timedelta

from ..database import get_db
from ..models import User, ClientProfile, Contract, Invoice, Document, UserRole, ContractStatus, InvoiceStatus, Notification, NotificationType, AuditLog
from ..schemas.schemas import DashboardStats
from ..middleware.rbac import require_directeur, require_any_authenticated

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db)
):
    """Full dashboard analytics (DIRECTEUR only)"""

    now = datetime.utcnow()
    soon = now + timedelta(days=30)

    # Basic counts
    total_clients = db.query(User).filter(User.role == UserRole.CLIENT).count()
    total_contracts = db.query(Contract).count()
    total_invoices = db.query(Invoice).count()
    total_documents = db.query(Document).count()
    active_contracts = db.query(Contract).filter(Contract.status == ContractStatus.ACTIVE).count()
    pending_invoices = db.query(Invoice).filter(Invoice.status == InvoiceStatus.PENDING).count()
    paid_invoices = db.query(Invoice).filter(Invoice.status == InvoiceStatus.PAID).count()
    unpaid_invoices = db.query(Invoice).filter(Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE])).count()
    expired_contracts = db.query(Contract).filter(Contract.status == ContractStatus.EXPIRED).count()
    overdue_invoices = db.query(Invoice).filter(
        Invoice.status.in_([InvoiceStatus.OVERDUE, InvoiceStatus.PENDING]),
        Invoice.due_date < now
    ).count()
    expiring_contracts_30d = db.query(Contract).filter(
        Contract.status == ContractStatus.ACTIVE,
        Contract.end_date.isnot(None),
        Contract.end_date >= now,
        Contract.end_date <= soon
    ).count()
    sage_pending_invoices = db.query(Invoice).filter(
        Invoice.status == InvoiceStatus.PAID,
        Invoice.exported_to_sage == False  # noqa: E712
    ).count()

    revenue_result = db.query(func.sum(Invoice.total)).filter(Invoice.status == InvoiceStatus.PAID).scalar()
    total_revenue = float(revenue_result or 0)

    unpaid_result = db.query(func.sum(Invoice.total)).filter(
        Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE])
    ).scalar()
    unpaid_amount = float(unpaid_result or 0)

    # Monthly revenue (last 6 months)
    monthly_revenue = []
    for i in range(5, -1, -1):
        base = datetime(now.year, now.month, 1)
        month = base.month - i
        year = base.year
        while month <= 0:
            month += 12
            year -= 1
        month_start = datetime(year, month, 1)
        month_end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

        paid_rev = db.query(func.sum(Invoice.total)).filter(
            Invoice.status == InvoiceStatus.PAID,
            Invoice.paid_date >= month_start,
            Invoice.paid_date < month_end
        ).scalar() or 0
        issued_total = db.query(func.sum(Invoice.total)).filter(
            Invoice.issue_date >= month_start,
            Invoice.issue_date < month_end
        ).scalar() or 0
        monthly_revenue.append({
            "month": month_start.strftime("%b %Y"),
            "revenue": float(paid_rev),
            "issued": float(issued_total),
        })

    contract_statuses = db.query(Contract.status, func.count(Contract.id)).group_by(Contract.status).all()
    contract_breakdown = {s.value: c for s, c in contract_statuses}

    invoice_statuses = db.query(Invoice.status, func.count(Invoice.id)).group_by(Invoice.status).all()
    invoice_breakdown = {s.value: c for s, c in invoice_statuses}

    top_clients_rows = (
        db.query(
            User.id,
            User.email,
            ClientProfile.first_name,
            ClientProfile.last_name,
            func.coalesce(func.sum(Invoice.total), 0).label("revenue"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .join(Invoice, Invoice.client_id == User.id)
        .outerjoin(ClientProfile, ClientProfile.user_id == User.id)
        .filter(Invoice.status == InvoiceStatus.PAID)
        .group_by(User.id, User.email, ClientProfile.first_name, ClientProfile.last_name)
        .order_by(func.sum(Invoice.total).desc())
        .limit(5)
        .all()
    )
    top_clients = [
        {
            "id": str(row.id),
            "email": row.email,
            "full_name": f"{row.first_name or ''} {row.last_name or ''}".strip() or row.email,
            "revenue": float(row.revenue or 0),
            "invoice_count": int(row.invoice_count or 0),
        }
        for row in top_clients_rows
    ]

    alerts = []
    if overdue_invoices:
        alerts.append({"type": "danger", "title": "Factures en retard", "message": f"{overdue_invoices} facture(s) nécessitent une relance."})
    if expiring_contracts_30d:
        alerts.append({"type": "warning", "title": "Contrats proches expiration", "message": f"{expiring_contracts_30d} contrat(s) expirent dans 30 jours."})
    if sage_pending_invoices:
        alerts.append({"type": "info", "title": "Sage en attente", "message": f"{sage_pending_invoices} facture(s) payées ne sont pas encore exportées."})

    return DashboardStats(
        total_clients=total_clients,
        total_contracts=total_contracts,
        total_invoices=total_invoices,
        total_revenue=total_revenue,
        pending_invoices=pending_invoices,
        paid_invoices=paid_invoices,
        unpaid_invoices=unpaid_invoices,
        active_contracts=active_contracts,
        expired_contracts=expired_contracts,
        overdue_invoices=overdue_invoices,
        unpaid_amount=unpaid_amount,
        sage_pending_invoices=sage_pending_invoices,
        expiring_contracts_30d=expiring_contracts_30d,
        total_documents=total_documents,
        monthly_revenue=monthly_revenue,
        contract_status_breakdown=contract_breakdown,
        invoice_status_breakdown=invoice_breakdown,
        top_clients=top_clients,
        alerts=alerts,
    )

@router.get("/my-stats")
def get_my_stats(
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db)
):
    """Personal stats for logged-in client"""
    my_contracts = db.query(Contract).filter(Contract.client_id == current_user.id).count()
    my_invoices = db.query(Invoice).filter(Invoice.client_id == current_user.id).count()
    my_pending = db.query(Invoice).filter(
        Invoice.client_id == current_user.id,
        Invoice.status == InvoiceStatus.PENDING
    ).count()
    my_total = db.query(func.sum(Invoice.total)).filter(
        Invoice.client_id == current_user.id,
        Invoice.status == InvoiceStatus.PAID
    ).scalar() or 0

    return {
        "contracts": my_contracts,
        "invoices": my_invoices,
        "pending_invoices": my_pending,
        "total_paid": float(my_total)
    }


@router.get("/notifications")
def get_notifications(
    unread_only: bool = False,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db)
):
    q = db.query(Notification).order_by(Notification.created_at.desc())
    if current_user.role != UserRole.DIRECTEUR:
        q = q.filter((Notification.user_id == current_user.id) | (Notification.user_id.is_(None)))
    if unread_only:
        q = q.filter(Notification.is_read == False)  # noqa: E712
    return q.limit(25).all()


@router.post("/notifications/generate")
def generate_system_notifications(
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    soon = now + timedelta(days=30)
    created = 0

    expiring = db.query(Contract).options(joinedload(Contract.client).joinedload(User.profile)).filter(
        Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.APPROVED]),
        Contract.end_date.isnot(None),
        Contract.end_date <= soon,
    ).all()
    directors = db.query(User).filter(User.role == UserRole.DIRECTEUR).all()
    for c in expiring:
        client_source_key = f"contract-expiring-client:{c.id}:{c.end_date.strftime('%Y%m%d')}"
        exists_client = db.query(Notification.id).filter(Notification.source_key == client_source_key).first()
        if not exists_client:
            db.add(Notification(
                user_id=c.client_id,
                type=NotificationType.CONTRACT_EXPIRING,
                title="Contrat proche expiration",
                message=f"Votre contrat {c.contract_number} expire bientot. Vous pouvez demander un renouvellement.",
                source_key=client_source_key,
            ))
            created += 1

        full_name = c.client.profile.full_name if c.client and c.client.profile else (c.client.email if c.client else "Client")
        for director in directors:
            director_source_key = f"contract-expiring-director:{director.id}:{c.id}:{c.end_date.strftime('%Y%m%d')}"
            exists_director = db.query(Notification.id).filter(Notification.source_key == director_source_key).first()
            if exists_director:
                continue
            db.add(Notification(
                user_id=director.id,
                type=NotificationType.CONTRACT_EXPIRING,
                title="Contrat client proche expiration",
                message=f"Le contrat {c.contract_number} du client {full_name} arrive a expiration.",
                source_key=director_source_key,
            ))
            created += 1

    overdue = db.query(Invoice).filter(
        Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
        Invoice.due_date < now,
    ).all()
    for inv in overdue:
        inv.status = InvoiceStatus.OVERDUE
        due_str = inv.due_date.strftime("%d/%m/%Y")
        client_key = f"invoice-overdue-client:{inv.id}:{due_str}"
        exists_client = db.query(Notification.id).filter(Notification.source_key == client_key).first()
        if not exists_client:
            db.add(Notification(
                user_id=inv.client_id,
                type=NotificationType.INVOICE_OVERDUE,
                title="Facture echue",
                message=f"Votre facture {inv.invoice_number} est echue depuis le {due_str}.",
                source_key=client_key,
            ))
            created += 1
        client = db.query(User).options(joinedload(User.profile)).filter(User.id == inv.client_id).first()
        full_name = client.profile.full_name if client and client.profile else (client.email if client else "Client")
        for director in directors:
            director_key = f"invoice-overdue-director:{director.id}:{inv.id}:{due_str}"
            exists_director = db.query(Notification.id).filter(Notification.source_key == director_key).first()
            if exists_director:
                continue
            db.add(Notification(
                user_id=director.id,
                type=NotificationType.INVOICE_OVERDUE,
                title="Facture client en retard",
                message=f"La facture {inv.invoice_number} du client {full_name} est en retard.",
                source_key=director_key,
            ))
            created += 1

    db.add(AuditLog(
        actor_id=current_user.id,
        action="generate_notifications",
        entity_type="system",
        description=f"{created} notifications générées automatiquement.",
        meta={"created": created},
    ))
    db.commit()
    return {"message": "Notifications générées", "created": created}


@router.get("/audit-logs")
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db),
):
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()


@router.get("/activity-timeline")
def get_activity_timeline(
    limit: int = Query(25, ge=1, le=100),
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    """Unified activity timeline built from contracts, invoices, documents, notifications and audit logs."""
    items = []

    def add(kind, title, message, date, status="info", url=None, amount=None):
        if not date:
            return
        items.append({
            "kind": kind,
            "title": title,
            "message": message,
            "date": date.isoformat(),
            "status": status,
            "url": url,
            "amount": amount,
        })

    is_director = current_user.role == UserRole.DIRECTEUR

    contracts_q = db.query(Contract).options(joinedload(Contract.client).joinedload(User.profile)).order_by(Contract.created_at.desc())
    invoices_q = db.query(Invoice).options(joinedload(Invoice.client).joinedload(User.profile)).order_by(Invoice.created_at.desc())
    documents_q = db.query(Document).order_by(Document.uploaded_at.desc())
    notifications_q = db.query(Notification).order_by(Notification.created_at.desc())

    if not is_director:
        contracts_q = contracts_q.filter(Contract.client_id == current_user.id)
        invoices_q = invoices_q.filter(Invoice.client_id == current_user.id)
        documents_q = documents_q.filter(Document.owner_id == current_user.id)
        notifications_q = notifications_q.filter((Notification.user_id == current_user.id) | (Notification.user_id.is_(None)))

    for c in contracts_q.limit(limit).all():
        client_name = c.client.profile.full_name if c.client and c.client.profile else (c.client.email if c.client else "Client")
        add(
            "contract",
            f"Contrat {c.contract_number}",
            f"{client_name} · statut {c.status.value}",
            c.updated_at or c.created_at,
            "success" if c.status.value in {"active", "approved"} else "warning" if c.status.value == "pending" else "danger" if c.status.value == "expired" else "info",
            "/director/contracts" if is_director else "/client/contracts",
        )

    for inv in invoices_q.limit(limit).all():
        client_name = inv.client.profile.full_name if inv.client and inv.client.profile else (inv.client.email if inv.client else "Client")
        add(
            "invoice",
            f"Facture {inv.invoice_number}",
            f"{client_name} · {inv.status.value}",
            inv.paid_date or inv.updated_at or inv.created_at,
            "success" if inv.status.value == "paid" else "danger" if inv.status.value == "overdue" else "warning",
            "/director/invoices" if is_director else "/client/invoices",
            float(inv.total or 0),
        )

    for d in documents_q.limit(limit).all():
        add(
            "document",
            d.name or d.original_filename,
            f"Document {d.category or d.doc_type.value if d.doc_type else 'general'} ajouté",
            d.uploaded_at,
            "info",
            "/client/documents" if not is_director else None,
        )

    for n in notifications_q.limit(limit).all():
        add("notification", n.title, n.message, n.created_at, "warning" if not n.is_read else "info", n.action_url)

    if is_director:
        for a in db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all():
            add("audit", a.action, a.description or a.entity_type, a.created_at, "info", None)

    items.sort(key=lambda x: x["date"], reverse=True)
    return items[:limit]


@router.get("/client-portal")
def get_client_portal(
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    """Ultra pro client portal overview."""
    now = datetime.utcnow()
    contracts = db.query(Contract).filter(Contract.client_id == current_user.id).all()
    invoices = db.query(Invoice).filter(Invoice.client_id == current_user.id).all()
    documents = db.query(Document).filter(Document.owner_id == current_user.id).all()
    active_contracts = [c for c in contracts if c.status in [ContractStatus.ACTIVE, ContractStatus.APPROVED]]
    pending_invoices = [i for i in invoices if i.status in [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]]
    total_paid = sum(float(i.total or 0) for i in invoices if i.status == InvoiceStatus.PAID)
    next_due = sorted([i for i in pending_invoices if i.due_date], key=lambda i: i.due_date)
    expiring = sorted([c for c in active_contracts if c.end_date and c.end_date <= now + timedelta(days=30)], key=lambda c: c.end_date)
    completeness_checks = [bool(current_user.profile), len(contracts) > 0, len(invoices) > 0, len(documents) > 0]
    completion = int(sum(completeness_checks) / len(completeness_checks) * 100)
    return {
        "profile_completion": completion,
        "active_contracts": len(active_contracts),
        "pending_invoices": len(pending_invoices),
        "documents": len(documents),
        "total_paid": total_paid,
        "next_invoice": {
            "invoice_number": next_due[0].invoice_number,
            "due_date": next_due[0].due_date.isoformat(),
            "total": float(next_due[0].total or 0),
            "status": next_due[0].status.value,
        } if next_due else None,
        "expiring_contract": {
            "contract_number": expiring[0].contract_number,
            "end_date": expiring[0].end_date.isoformat(),
            "status": expiring[0].status.value,
        } if expiring else None,
        "quick_actions": [
            {"label": "Demander un contrat", "url": "/client/contract-request", "type": "primary"},
            {"label": "Voir mes factures", "url": "/client/invoices", "type": "secondary"},
            {"label": "Uploader document", "url": "/client/documents", "type": "secondary"},
        ],
    }
