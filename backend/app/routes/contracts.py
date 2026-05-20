"""
Contract Routes
Advanced contract request workflow with director validation and exports.
"""
import os
import uuid
from calendar import monthrange
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import (
    ClientProfile,
    Contract,
    ContractStatus,
    User,
    UserRole,
    Invoice,
    InvoiceItem,
    InvoiceStatus
)
from ..schemas.schemas import (
    ContractCreate,
    ContractRequestCreate,
    ContractResponse,
    ContractUpdate,
    ContractRenewalRequest,
)
from ..middleware.rbac import (
    require_client,
    require_directeur,
    require_any_authenticated,
    check_resource_access,
)
from ..services.contract_exports import generate_contract_pdf, generate_contract_word
from ..services.invoice_exports import generate_invoice_pdf
from ..services.email_service import send_contract_invoice_email, send_email_with_attachments

router = APIRouter(prefix="/contracts", tags=["Contracts"])

DURATION_PRICES = {
    1: 65.0,
    3: 195.0,
    6: 390.0,
}
RENEWAL_MONTHLY_PRICE = 165.0

PROFILE_FIELDS = {
    "first_name", "last_name", "cin_number", "birth_date", "address", "phone", "city",
    "company_name", "company_ice", "company_rc", "company_address",
    "company_activity", "company_email", "company_phone",
}

def sync_contract_statuses(db: Session) -> None:
    now = datetime.utcnow()
    expired_contracts = (
        db.query(Contract)
        .filter(Contract.end_date.isnot(None))
        .filter(Contract.end_date < now)
        .filter(Contract.status.in_([ContractStatus.APPROVED, ContractStatus.ACTIVE]))
        .all()
    )
    changed = False
    for contract in expired_contracts:
        contract.status = ContractStatus.EXPIRED
        contract.updated_at = now
        changed = True
    if changed:
        db.commit()


def calculate_contract_price(duration_months: int) -> float:
    try:
        return DURATION_PRICES[int(duration_months)]
    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid duration. Accepted values: 1, 3 or 6 months.",
        )


def add_months(dt: datetime, months: int) -> datetime:
    month = dt.month - 1 + int(months)
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def generate_contract_number(db: Session) -> str:
    count = db.query(Contract).count()
    year = datetime.now().year
    return f"DOM-{year}-{str(count + 1).zfill(4)}"


def create_invoice_for_contract(
    db: Session,
    contract: Contract,
    current_user: User,
    *,
    reason: str = "contract_request",
) -> Invoice:
    """Create one invoice for a contract request or a renewal request.

    Renewals now generate their own invoice automatically. The billed period is
    contract.start_date -> contract.end_date and TVA 20% is calculated here.
    """
    count = db.query(Invoice).count()
    year = datetime.now().year
    subtotal = float(contract.price or 0)
    tax_amount = round(subtotal * 0.20, 2)
    total = round(subtotal + tax_amount, 2)
    is_renewal = reason == "renewal"
    note = (
        f"Facture générée automatiquement après la demande de renouvellement {contract.contract_number}."
        if is_renewal
        else f"Facture générée automatiquement après la demande du contrat {contract.contract_number}."
    )
    description_prefix = "Renouvellement" if is_renewal else "Domiciliation"

    invoice = Invoice(
        invoice_number=f"FACT-{year}-{str(count + 1).zfill(5)}",
        client_id=contract.client_id,
        contract_id=contract.id,
        service_start_date=contract.start_date,
        service_end_date=contract.end_date,
        duration_months=contract.duration_months,
        due_date=datetime.utcnow() + timedelta(days=7),
        tax_rate=20.0,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        currency="MAD",
        notes=note,
        created_by=current_user.id,
    )
    db.add(invoice)
    db.flush()
    db.add(InvoiceItem(
        invoice_id=invoice.id,
        description=f"{description_prefix} - {contract.contract_type or 'Contrat de domiciliation'} - {contract.duration_months} mois",
        quantity=1,
        unit_price=subtotal,
        total=subtotal,
    ))
    db.flush()
    return invoice

def invalidate_exports(contract: Contract) -> None:
    for path in [contract.pdf_path, contract.word_path]:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass
    contract.pdf_path = None
    contract.word_path = None


def apply_status_audit(contract: Contract, new_status, current_user: User) -> None:
    if not new_status:
        return

    status_value = new_status.value if hasattr(new_status, "value") else str(new_status)
    if status_value in {ContractStatus.APPROVED.value, ContractStatus.ACTIVE.value}:
        contract.approved_by = current_user.id
        contract.approved_at = datetime.utcnow()


def get_contract_or_404(db: Session, contract_id: uuid.UUID) -> Contract:
    contract = (
        db.query(Contract)
        .options(joinedload(Contract.client).joinedload(User.profile))
        .filter(Contract.id == contract_id)
        .first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.get("", response_model=List[ContractResponse])
def list_contracts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    status: Optional[str] = None,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    """
    List contracts:
    - DIRECTEUR: all contract requests and contracts
    - CLIENT: own contracts only
    """
    sync_contract_statuses(db)
    query = db.query(Contract).options(joinedload(Contract.client).joinedload(User.profile))

    if current_user.role != UserRole.DIRECTEUR:
        query = query.filter(Contract.client_id == current_user.id)

    if status:
        query = query.filter(Contract.status == status)

    return query.order_by(Contract.created_at.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=ContractResponse, status_code=201)
def create_contract(
    payload: ContractCreate,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db),
):
    """Create a contract manually (DIRECTEUR only)."""
    data = payload.model_dump()
    if data.get("duration_months"):
        data["price"] = data.get("price") or calculate_contract_price(data["duration_months"])
        data["end_date"] = data.get("end_date") or add_months(data["start_date"], data["duration_months"])
    if data.get("price") is not None:
        data["value"] = data["price"]

    contract = Contract(
        **data,
        contract_number=generate_contract_number(db),
        created_by=current_user.id,
        status=ContractStatus.DRAFT,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return get_contract_or_404(db, contract.id)


@router.post("/request", response_model=ContractResponse, status_code=201)
def request_contract(
    payload: ContractRequestCreate,
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    """
    Client submits a domiciliation contract request.
    The profile/company data is created or updated, price is calculated server-side,
    and the request enters the PENDING status for director validation.
    """
    price = calculate_contract_price(payload.duration_months)

    profile = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()

    # Merge request payload with the existing client profile. This avoids asking
    # the client to re-enter registration/profile information when creating a contract.
    incoming_profile_data = payload.model_dump(include=PROFILE_FIELDS, exclude_none=True)
    incoming_profile_data = {k: v for k, v in incoming_profile_data.items() if v not in (None, "")}

    if profile:
        for field, value in incoming_profile_data.items():
            setattr(profile, field, value)
    else:
        profile = ClientProfile(user_id=current_user.id, **incoming_profile_data)
        db.add(profile)
        db.flush()

    required_profile_fields = ["first_name", "last_name", "cin_number", "phone", "address", "city"]
    missing = [field for field in required_profile_fields if not getattr(profile, field, None)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail="Profil incomplet. Complétez d’abord: " + ", ".join(missing),
        )

    now = datetime.utcnow()
    start = payload.start_date or now
    contract = Contract(
        contract_number=generate_contract_number(db),
        client_id=current_user.id,
        created_by=current_user.id,
        title="Contrat de domiciliation",
        description="Demande de contrat de domiciliation créée depuis l'espace client.",
        status=ContractStatus.PENDING,
        contract_type=payload.contract_type or "Domiciliation Juridique",
        duration_months=payload.duration_months,
        price=price,
        value=price,
        currency="MAD",
        start_date=start,
        end_date=add_months(start, payload.duration_months),
        submitted_at=now,
        terms="Demande en attente de validation par le directeur.",
    )

    db.add(contract)
    db.flush()
    invoice = create_invoice_for_contract(db, contract, current_user)
    db.commit()

    final_contract = get_contract_or_404(db, contract.id)
    final_invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.client).joinedload(User.profile), joinedload(Invoice.items))
        .filter(Invoice.id == invoice.id)
        .first()
    )

    # Generate contract + invoice immediately, then send them by email when SMTP is configured.
    try:
        pdf_path = generate_contract_pdf(final_contract)
        word_path = generate_contract_word(final_contract)
        final_contract.pdf_path = pdf_path
        final_contract.word_path = word_path
        invoice_pdf_path = generate_invoice_pdf(final_invoice) if final_invoice else None
        db.commit()
        recipient = profile.company_email or current_user.email
        send_contract_invoice_email(
            recipient,
            final_contract,
            final_invoice,
            [p for p in [pdf_path, word_path, invoice_pdf_path] if p],
        )
    except Exception as exc:
        final_contract.notes = (final_contract.notes or "") + f"\nEmail/export automatique non envoyé: {exc}"
        db.commit()

    return get_contract_or_404(db, final_contract.id)


@router.get("/alerts/expiring-soon", response_model=List[ContractResponse])
def expiring_contracts(
    days: int = Query(30, ge=1, le=180),
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    """Contracts close to expiration for client/admin notifications."""
    now = datetime.utcnow()
    limit_date = now + timedelta(days=days)
    query = (
        db.query(Contract)
        .options(joinedload(Contract.client).joinedload(User.profile))
        .filter(Contract.end_date.isnot(None))
        .filter(Contract.end_date >= now)
        .filter(Contract.end_date <= limit_date)
        .filter(Contract.status.in_([ContractStatus.APPROVED, ContractStatus.ACTIVE]))
    )
    if current_user.role != UserRole.DIRECTEUR:
        query = query.filter(Contract.client_id == current_user.id)
    return query.order_by(Contract.end_date.asc()).all()


@router.post("/alerts/expiring-soon/send-reminders")
def send_expiration_reminders(
    days: int = Query(30, ge=1, le=180),
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db),
):
    """Director action: send email reminders for contracts expiring soon."""
    now = datetime.utcnow()
    limit_date = now + timedelta(days=days)
    contracts = (
        db.query(Contract)
        .options(joinedload(Contract.client).joinedload(User.profile))
        .filter(Contract.end_date.isnot(None))
        .filter(Contract.end_date >= now)
        .filter(Contract.end_date <= limit_date)
        .filter(Contract.status.in_([ContractStatus.APPROVED, ContractStatus.ACTIVE]))
        .order_by(Contract.end_date.asc())
        .all()
    )
    sent = 0
    skipped = 0
    for contract in contracts:
        profile = contract.client.profile if contract.client and contract.client.profile else None
        recipient = getattr(profile, "company_email", None) or getattr(contract.client, "email", None)
        if not recipient:
            skipped += 1
            continue
        days_left = max(0, (contract.end_date - now).days)
        body = (
            f"Bonjour,\n\n"
            f"Votre contrat de domiciliation {contract.contract_number} expire le "
            f"{contract.end_date.strftime('%d/%m/%Y')} (dans {days_left} jour(s)).\n\n"
            "Vous pouvez demander le renouvellement depuis votre espace client.\n\n"
            "Cordialement,\nUniversal Invest Strategy"
        )
        ok = send_email_with_attachments(
            recipient,
            f"Renouvellement de votre contrat {contract.contract_number}",
            body,
            [],
        )
        sent += 1 if ok else 0
        skipped += 0 if ok else 1
    return {"total": len(contracts), "sent": sent, "skipped": skipped}


@router.post("/{contract_id}/send-renewal-invitation")
def send_renewal_invitation(
    contract_id: uuid.UUID,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db),
):
    """Director action: send a renewal invitation email for one contract."""
    contract = get_contract_or_404(db, contract_id)
    profile = contract.client.profile if contract.client and contract.client.profile else None
    recipient = getattr(profile, "company_email", None) or getattr(contract.client, "email", None)
    if not recipient:
        raise HTTPException(status_code=400, detail="Client email not found")
    if contract.status not in {ContractStatus.EXPIRED, ContractStatus.ACTIVE, ContractStatus.APPROVED}:
        raise HTTPException(status_code=400, detail="Renewal invitation is allowed only for active/approved/expired contracts.")

    body = (
        f"Bonjour,\n\n"
        f"Le contrat {contract.contract_number} peut etre renouvelle depuis votre espace client.\n"
        "Merci de vous connecter pour soumettre votre demande de renouvellement.\n\n"
        "Cordialement,\nUniversal Invest Strategy"
    )
    ok = send_email_with_attachments(
        recipient,
        f"Invitation de renouvellement - contrat {contract.contract_number}",
        body,
        [],
    )
    if not ok:
        raise HTTPException(status_code=400, detail="SMTP is not configured. Check SMTP credentials in .env")
    return {"sent": True, "to": recipient, "contract_number": contract.contract_number}


@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: uuid.UUID,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    contract = get_contract_or_404(db, contract_id)
    check_resource_access(contract.client_id, current_user)
    return contract


@router.put("/{contract_id}", response_model=ContractResponse)
def update_contract(
    contract_id: uuid.UUID,
    payload: ContractUpdate,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db),
):
    """Director updates contract and the variable client/company information."""
    contract = get_contract_or_404(db, contract_id)
    update_data = payload.model_dump(exclude_unset=True)

    profile_data = {k: update_data.pop(k) for k in list(update_data.keys()) if k in PROFILE_FIELDS}
    if profile_data:
        profile = contract.client.profile if contract.client else None
        if not profile:
            profile = ClientProfile(user_id=contract.client_id, first_name="", last_name="")
            db.add(profile)
        for field, value in profile_data.items():
            setattr(profile, field, value)

    old_status = contract.status

    if "duration_months" in update_data:
        update_data["duration_months"] = int(update_data["duration_months"])
        update_data["price"] = calculate_contract_price(update_data["duration_months"])
        update_data["value"] = update_data["price"]
        base_start = update_data.get("start_date") or contract.start_date or datetime.utcnow()
        update_data["end_date"] = add_months(base_start, update_data["duration_months"])
    elif "price" in update_data:
        update_data["value"] = update_data["price"]

    for field, value in update_data.items():
        setattr(contract, field, value)

    if "status" in update_data and update_data["status"] != old_status:
        apply_status_audit(contract, update_data["status"], current_user)

    invalidate_exports(contract)
    db.commit()
    db.refresh(contract)
    return get_contract_or_404(db, contract.id)


@router.patch("/{contract_id}/approve")
def approve_contract(
    contract_id: uuid.UUID,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contrat introuvable")

    contract.status = ContractStatus.APPROVED
    contract.approved_at = datetime.utcnow()
    contract.approved_by = current_user.id

    # prix = durée × 65
    duration = contract.duration_months or 1
    amount_ht = duration * 65
    tax = amount_ht * 0.20
    total = amount_ht + tax

    invoice = Invoice(
        client_id=contract.client_id,
        contract_id=contract.id,
        invoice_number=f"FAC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        issue_date=datetime.utcnow(),
        due_date=contract.start_date,
        subtotal=amount_ht,
        tax_amount=tax,
        total=total,
        status=InvoiceStatus.PENDING,
    )

    db.add(invoice)
    db.flush()

    invoice_item = InvoiceItem(
        invoice_id=invoice.id,
        description=f"Contrat {contract.contract_number} - {duration} mois",
        quantity=duration,
        unit_price=65,
        total=amount_ht,
    )

    db.add(invoice_item)
    db.commit()
    db.refresh(invoice)

    # envoi email automatique
    # génération PDF + email automatique
    try:
        profile = contract.client.profile if contract.client and contract.client.profile else None

        recipient = (
            getattr(profile, "company_email", None)
            or getattr(contract.client, "email", None)
        )

        if recipient:

            pdf_path = generate_contract_pdf(contract)
            word_path = generate_contract_word(contract)
            invoice_pdf_path = generate_invoice_pdf(invoice)

            contract.pdf_path = pdf_path
            contract.word_path = word_path

            db.commit()

            send_contract_invoice_email(
                recipient,
                contract,
                invoice,
                [
                    p for p in [
                        pdf_path,
                        word_path,
                        invoice_pdf_path
                    ] if p
                ]
            )

    except Exception as e:
        print("Email sending error:", str(e))

    return {
        "message": "Contrat approuvé, facture créée et email envoyé",
        "contract_id": str(contract.id),
        "invoice_id": str(invoice.id),
    }

@router.patch("/{contract_id}/reject", response_model=ContractResponse)
def reject_contract(
    contract_id: uuid.UUID,
    reason: Optional[str] = None,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db),
):
    """Director rejects a client contract request."""
    contract = get_contract_or_404(db, contract_id)
    contract.status = ContractStatus.REJECTED
    contract.notes = reason or contract.notes or "Demande refusée par la direction."
    invalidate_exports(contract)
    db.commit()
    db.refresh(contract)
    return get_contract_or_404(db, contract.id)


@router.post("/{contract_id}/renew", response_model=ContractResponse, status_code=201)
def renew_contract(
    contract_id: uuid.UUID,
    payload: ContractRenewalRequest,
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    """
    Client-only renewal request.
    Director/admin cannot create renewals directly; they approve/reject the generated PENDING renewal.
    Renewal price is fixed at 165 MAD/month.
    """
    old_contract = get_contract_or_404(db, contract_id)
    check_resource_access(old_contract.client_id, current_user)

    if old_contract.status not in {ContractStatus.APPROVED, ContractStatus.ACTIVE, ContractStatus.EXPIRED}:
        raise HTTPException(status_code=400, detail="Only approved, active or expired contracts can be renewed.")

    months = int(payload.duration_months)
    start = payload.start_date or old_contract.end_date or datetime.utcnow()
    if start < datetime.utcnow():
        start = datetime.utcnow()
    price = months * RENEWAL_MONTHLY_PRICE

    renewal = Contract(
        contract_number=generate_contract_number(db),
        client_id=old_contract.client_id,
        created_by=current_user.id,
        title="Demande de renouvellement contrat de domiciliation",
        description=f"Demande de renouvellement du contrat {old_contract.contract_number}",
        status=ContractStatus.PENDING,
        contract_type=old_contract.contract_type or "Domiciliation Juridique",
        duration_months=months,
        price=price,
        value=price,
        currency="MAD",
        start_date=start,
        end_date=add_months(start, months),
        submitted_at=datetime.utcnow(),
        terms=f"Demande client de renouvellement à {int(RENEWAL_MONTHLY_PRICE)} MAD/mois.",
        notes=payload.notes,
    )
    db.add(renewal)
    db.flush()
    invoice = create_invoice_for_contract(db, renewal, current_user, reason="renewal")
    old_contract.notes = ((old_contract.notes or "") + f"\nRenouvellement demandé par le client: {renewal.contract_number}").strip()
    db.commit()

    final_renewal = get_contract_or_404(db, renewal.id)
    final_invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.client).joinedload(User.profile), joinedload(Invoice.items))
        .filter(Invoice.id == invoice.id)
        .first()
    )

    try:
        pdf_path = generate_contract_pdf(final_renewal)
        word_path = generate_contract_word(final_renewal)
        final_renewal.pdf_path = pdf_path
        final_renewal.word_path = word_path
        invoice_pdf_path = generate_invoice_pdf(final_invoice) if final_invoice else None
        db.commit()
        profile = final_renewal.client.profile if final_renewal.client and final_renewal.client.profile else None
        recipient = getattr(profile, "company_email", None) or current_user.email
        send_contract_invoice_email(
            recipient,
            final_renewal,
            final_invoice,
            [p for p in [pdf_path, word_path, invoice_pdf_path] if p],
        )
    except Exception as exc:
        final_renewal.notes = (final_renewal.notes or "") + f"\nEmail/export renouvellement non envoyé: {exc}"
        db.commit()

    return get_contract_or_404(db, final_renewal.id)


@router.get("/{contract_id}/download/pdf")
def download_contract_pdf(
    contract_id: uuid.UUID,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    contract = get_contract_or_404(db, contract_id)
    check_resource_access(contract.client_id, current_user)

    path = contract.pdf_path
    if not path or not os.path.exists(path):
        path = generate_contract_pdf(contract)
        contract.pdf_path = path
        db.commit()

    return FileResponse(path, media_type="application/pdf", filename=f"{contract.contract_number}.pdf")


@router.get("/{contract_id}/download/word")
def download_contract_word(
    contract_id: uuid.UUID,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    contract = get_contract_or_404(db, contract_id)
    check_resource_access(contract.client_id, current_user)

    path = contract.word_path
    if not path or not os.path.exists(path):
        path = generate_contract_word(contract)
        contract.word_path = path
        db.commit()

    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"{contract.contract_number}.docx",
    )


@router.post("/{contract_id}/send-email")
def send_contract_email(
    contract_id: uuid.UUID,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db),
):
    """Director can resend the contract PDF/Word and linked invoice PDF to the client/company email."""
    contract = get_contract_or_404(db, contract_id)
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.client).joinedload(User.profile), joinedload(Invoice.items))
        .filter(Invoice.contract_id == contract.id)
        .order_by(Invoice.created_at.desc())
        .first()
    )
    profile = contract.client.profile if contract.client and contract.client.profile else None
    recipient = getattr(profile, "company_email", None) or getattr(contract.client, "email", None)
    if not recipient:
        raise HTTPException(status_code=400, detail="Client email not found")

    pdf_path = contract.pdf_path if contract.pdf_path and os.path.exists(contract.pdf_path) else generate_contract_pdf(contract)
    word_path = contract.word_path if contract.word_path and os.path.exists(contract.word_path) else generate_contract_word(contract)
    invoice_pdf_path = generate_invoice_pdf(invoice) if invoice else None
    contract.pdf_path = pdf_path
    contract.word_path = word_path
    db.commit()

    sent = send_contract_invoice_email(
        recipient, contract, invoice, [p for p in [pdf_path, word_path, invoice_pdf_path] if p]
    )
    if not sent:
        raise HTTPException(status_code=400, detail="SMTP is not configured. Check SMTP_HOST, SMTP_USER and SMTP_PASSWORD in .env")
    return {"sent": True, "to": recipient}


@router.delete("/{contract_id}", status_code=204)
def delete_contract(
    contract_id: uuid.UUID,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db),
):
    contract = get_contract_or_404(db, contract_id)
    db.delete(contract)
    db.commit()
