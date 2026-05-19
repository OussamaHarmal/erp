"""
RBAC Middleware & Permission System
Role-Based Access Control for all protected routes
"""
from functools import wraps
from typing import List
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..models import User, UserRole
from ..utils.auth import get_current_user


# ─── Role Checker Factory ─────────────────────────────────────────────────────

class RoleChecker:
    """
    Dependency class for role-based access control.
    Usage: Depends(require_roles([UserRole.DIRECTEUR]))
    """
    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in self.allowed_roles]}"
            )
        return current_user


# ─── Convenience Dependencies ─────────────────────────────────────────────────

def require_directeur(current_user: User = Depends(get_current_user)) -> User:
    """Allow only DIRECTEUR (admin) role"""
    if current_user.role != UserRole.DIRECTEUR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to directors only"
        )
    return current_user


def require_client(current_user: User = Depends(get_current_user)) -> User:
    """Allow only CLIENT role"""
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to clients only"
        )
    return current_user


def require_any_authenticated(current_user: User = Depends(get_current_user)) -> User:
    """Allow any authenticated user (client or directeur)"""
    return current_user


# ─── Resource Ownership Check ─────────────────────────────────────────────────

def check_resource_access(resource_owner_id, current_user: User) -> None:
    """
    Verify user can access a resource:
    - DIRECTEUR can access anything
    - CLIENT can only access their own resources
    """
    if current_user.role == UserRole.DIRECTEUR:
        return  # Directors have full access

    if str(resource_owner_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: you can only access your own resources"
        )
