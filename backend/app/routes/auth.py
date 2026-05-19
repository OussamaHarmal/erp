"""
Authentication Routes
Login, Register, Refresh Token, Logout
"""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, ClientProfile, RefreshToken, UserRole
from ..schemas.schemas import LoginRequest, RegisterRequest, TokenResponse, RefreshRequest, UserResponse
from ..utils.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    get_current_user
)
from ..config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


def generate_unique_number(prefix: str, db: Session) -> str:
    """Generate a unique sequential number"""
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new client account"""

    # Check if email already exists
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Create user
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.CLIENT,
    )
    db.add(user)
    db.flush()  # Get ID without committing

    # Create profile
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

    return _create_token_response(user, db)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT tokens"""

    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact administrator."
        )

    return _create_token_response(user, db)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Issue new tokens using a valid refresh token"""

    # Verify token signature and expiry
    try:
        token_data = decode_token(payload.refresh_token)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    if token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not a refresh token"
        )

    # Check if token is revoked in DB
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == payload.refresh_token,
        RefreshToken.is_revoked == False
    ).first()

    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked"
        )

    # Revoke old token (rotation)
    db_token.is_revoked = True
    db.commit()

    user = db.query(User).filter(User.id == token_data["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return _create_token_response(user, db)


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke all refresh tokens for current user"""
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False
    ).update({"is_revoked": True})
    db.commit()
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info"""
    return current_user


# ─── Helper ───────────────────────────────────────────────────────────────────

def _create_token_response(user: User, db: Session) -> dict:
    """Create access + refresh tokens and save refresh token to DB"""
    token_data = {"sub": str(user.id), "role": user.role.value}

    access_token = create_access_token(token_data)
    refresh_token_str = create_refresh_token(token_data)

    # Persist refresh token for revocation support
    db_token = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(db_token)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer",
        "user": user
    }
