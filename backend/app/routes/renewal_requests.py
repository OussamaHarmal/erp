import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..middleware.rbac import require_any_authenticated, require_client, require_directeur
from ..models import (
    Contract,
    ContractStatus,
    Notification,
    NotificationType,
    RenewalRequest,
    RenewalRequestStatus,
    User,
    UserRole,
)
from ..schemas.schemas import RenewalRequestCreate, RenewalRequestDecision, RenewalRequestResponse

router = APIRouter(tags=["Renewal Requests"])

def _add_months(dt: datetime, months: int) -> datetime:
    month = dt.month - 1 + int(months)
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, 28)
    return dt.replace(year=year, month=month, day=day)


def _generate_contract_number(db: Session) -> str:
    count = db.query(Contract).count()
    year = datetime.now().year
    return f"DOM-{year}-{str(count + 1).zfill(4)}"


@router.post("/contracts/{contract_id}/renewal-request", response_model=RenewalRequestResponse, status_code=201)
def create_renewal_request(
    contract_id: uuid.UUID,
    payload: RenewalRequestCreate,
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if contract.status not in {ContractStatus.ACTIVE, ContractStatus.APPROVED, ContractStatus.EXPIRED}:
        raise HTTPException(status_code=400, detail="This contract cannot be renewed.")

    existing = db.query(RenewalRequest).filter(
        RenewalRequest.contract_id == contract.id,
        RenewalRequest.status == RenewalRequestStatus.PENDING,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A pending renewal request already exists for this contract.")

    request = RenewalRequest(
        contract_id=contract.id,
        client_id=current_user.id,
        message=payload.message,
        status=RenewalRequestStatus.PENDING,
    )
    db.add(request)

    client_message = (
        f"Votre demande de renouvellement pour le contrat {contract.contract_number} a ete envoyee."
    )
    director_message = (
        f"Nouvelle demande de renouvellement pour le contrat {contract.contract_number}."
    )
    db.add(Notification(
        user_id=current_user.id,
        type=NotificationType.CONTRACT_EXPIRING,
        title="Demande de renouvellement envoyee",
        message=client_message,
        source_key=f"renewal-request-client:{contract.id}:{datetime.utcnow().date().isoformat()}",
    ))
    director_users = db.query(User).filter(User.role == UserRole.DIRECTEUR).all()
    for director in director_users:
        db.add(Notification(
            user_id=director.id,
            type=NotificationType.CONTRACT_EXPIRING,
            title="Nouvelle demande de renouvellement",
            message=director_message,
            source_key=f"renewal-request-director:{director.id}:{request.id}",
        ))

    db.commit()
    return (
        db.query(RenewalRequest)
        .options(
            joinedload(RenewalRequest.contract),
            joinedload(RenewalRequest.client).joinedload(User.profile),
        )
        .filter(RenewalRequest.id == request.id)
        .first()
    )


@router.get("/client/renewal-requests", response_model=List[RenewalRequestResponse])
def list_my_renewal_requests(
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    return (
        db.query(RenewalRequest)
        .options(
            joinedload(RenewalRequest.contract),
            joinedload(RenewalRequest.client).joinedload(User.profile),
        )
        .filter(RenewalRequest.client_id == current_user.id)
        .order_by(RenewalRequest.created_at.desc())
        .all()
    )


@router.get("/director/renewal-requests", response_model=List[RenewalRequestResponse])
def list_all_renewal_requests(
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db),
):
    return (
        db.query(RenewalRequest)
        .options(
            joinedload(RenewalRequest.contract),
            joinedload(RenewalRequest.client).joinedload(User.profile),
        )
        .order_by(RenewalRequest.created_at.desc())
        .all()
    )


@router.patch("/director/renewal-requests/{request_id}", response_model=RenewalRequestResponse)
def decide_renewal_request(
    request_id: uuid.UUID,
    payload: RenewalRequestDecision,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db),
):
    request = (
        db.query(RenewalRequest)
        .options(joinedload(RenewalRequest.contract), joinedload(RenewalRequest.client).joinedload(User.profile))
        .filter(RenewalRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Renewal request not found")
    if request.status != RenewalRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="This renewal request has already been processed.")
    if payload.status not in {RenewalRequestStatus.APPROVED, RenewalRequestStatus.REJECTED}:
        raise HTTPException(status_code=400, detail="Status must be approved or rejected.")

    request.status = payload.status
    request.updated_at = datetime.utcnow()
    if payload.message:
        request.message = f"{request.message or ''}\nDecision: {payload.message}".strip()

    if payload.status == RenewalRequestStatus.APPROVED and request.contract:
        old_contract = request.contract
        old_contract.status = ContractStatus.EXPIRED
        old_contract.updated_at = datetime.utcnow()
        duration = int(old_contract.duration_months or 1)
        start = old_contract.end_date or datetime.utcnow()
        new_contract = Contract(
            contract_number=_generate_contract_number(db),
            client_id=old_contract.client_id,
            created_by=current_user.id,
            title=old_contract.title,
            description=f"Renouvellement valide depuis {old_contract.contract_number}",
            status=ContractStatus.PENDING,
            contract_type=old_contract.contract_type,
            duration_months=duration,
            price=old_contract.price,
            value=old_contract.value,
            currency=old_contract.currency,
            start_date=start,
            end_date=_add_months(start, duration),
            submitted_at=datetime.utcnow(),
            renewal_parent_id=old_contract.id,
            terms=old_contract.terms,
            notes=(payload.message or "Contrat cree depuis demande de renouvellement approuvee."),
        )
        db.add(new_contract)
        db.flush()
        request.message = f"{request.message or ''}\nNouveau contrat cree: {new_contract.contract_number}".strip()

    decision_label = "acceptee" if payload.status == RenewalRequestStatus.APPROVED else "refusee"
    db.add(Notification(
        user_id=request.client_id,
        type=NotificationType.CONTRACT_EXPIRING,
        title="Demande de renouvellement traitee",
        message=f"Votre demande de renouvellement pour {request.contract.contract_number} a ete {decision_label}.",
        source_key=f"renewal-request-decision:{request.id}:{payload.status.value}",
    ))
    db.commit()
    db.refresh(request)
    return request

