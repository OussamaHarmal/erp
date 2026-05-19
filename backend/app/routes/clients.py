"""
Client Routes
DIRECTEUR: full CRUD | CLIENT: read own profile only
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import User, ClientProfile, UserRole
from ..schemas.schemas import ProfileUpdate, ProfileResponse, UserWithProfile, RegisterRequest, UserResponse
from ..middleware.rbac import require_directeur, require_any_authenticated, check_resource_access
from ..utils.auth import hash_password, get_current_user

router = APIRouter(prefix="/clients", tags=["Clients"])


# ─── DIRECTEUR ONLY ───────────────────────────────────────────────────────────

@router.get("", response_model=List[UserWithProfile])
def list_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    search: Optional[str] = Query(None),
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db)
):
    """List all clients with their profiles (DIRECTEUR only)"""
    query = db.query(User).options(
        joinedload(User.profile)
    ).filter(User.role == UserRole.CLIENT)

    if search:
        query = query.join(ClientProfile).filter(
            ClientProfile.first_name.ilike(f"%{search}%") |
            ClientProfile.last_name.ilike(f"%{search}%") |
            User.email.ilike(f"%{search}%")
        )

    return query.offset(skip).limit(limit).all()


@router.post("", response_model=UserWithProfile, status_code=201)
def create_client(
    payload: RegisterRequest,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db)
):
    """Create a new client account (DIRECTEUR only)"""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.CLIENT,
    )
    db.add(user)
    db.flush()

    profile = ClientProfile(
        user_id=user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        cin_number=payload.cin_number,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{client_id}", response_model=UserWithProfile)
def get_client(
    client_id: uuid.UUID,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db)
):
    """Get client by ID (DIRECTEUR: any; CLIENT: own only)"""
    check_resource_access(client_id, current_user)

    user = db.query(User).options(joinedload(User.profile)).filter(
        User.id == client_id,
        User.role == UserRole.CLIENT
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="Client not found")

    return user


@router.put("/{client_id}/profile", response_model=ProfileResponse)
def update_profile(
    client_id: uuid.UUID,
    payload: ProfileUpdate,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db)
):
    """Update client profile (DIRECTEUR: any; CLIENT: own only)"""
    check_resource_access(client_id, current_user)

    profile = db.query(ClientProfile).filter(
        ClientProfile.user_id == client_id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: uuid.UUID,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db)
):
    """Delete a client account (DIRECTEUR only)"""
    user = db.query(User).filter(User.id == client_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Client not found")

    db.delete(user)
    db.commit()


@router.patch("/{client_id}/toggle-status", response_model=UserResponse)
def toggle_client_status(
    client_id: uuid.UUID,
    current_user: User = Depends(require_directeur),
    db: Session = Depends(get_db)
):
    """Activate or deactivate a client (DIRECTEUR only)"""
    user = db.query(User).filter(User.id == client_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Client not found")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user
