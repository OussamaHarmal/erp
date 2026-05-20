"""
Pydantic Schemas
Request/Response validation for all API endpoints
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, validator
from uuid import UUID
from ..models import UserRole, ContractStatus, InvoiceStatus, DocumentType, PaymentMethod, NotificationType, RenewalRequestStatus
from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime

# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    cin_number: Optional[str] = None

    @validator("password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class RefreshRequest(BaseModel):
    refresh_token: str


# ─── User Schemas ─────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: UUID
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserWithProfile(UserResponse):
    profile: Optional["ProfileResponse"] = None


# ─── Profile Schemas ──────────────────────────────────────────────────────────

class ProfileCreate(BaseModel):
    first_name: str
    last_name: str
    phone: Optional[str] = None
    cin_number: Optional[str] = None
    birth_date: Optional[datetime] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "Morocco"
    company_name: Optional[str] = None
    company_ice: Optional[str] = None
    company_rc: Optional[str] = None
    company_address: Optional[str] = None
    company_activity: Optional[str] = None
    company_email: Optional[EmailStr] = None
    company_phone: Optional[str] = None


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    cin_number: Optional[str] = None
    birth_date: Optional[datetime] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    company_name: Optional[str] = None
    company_ice: Optional[str] = None
    company_rc: Optional[str] = None
    company_address: Optional[str] = None
    company_activity: Optional[str] = None
    company_email: Optional[EmailStr] = None
    company_phone: Optional[str] = None


class ProfileResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    phone: Optional[str]
    cin_number: Optional[str]
    address: Optional[str]
    city: Optional[str]
    country: Optional[str]
    birth_date: Optional[datetime]
    company_name: Optional[str]
    company_ice: Optional[str] = None
    company_rc: Optional[str] = None
    company_address: Optional[str] = None
    company_activity: Optional[str] = None
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Contract Schemas ─────────────────────────────────────────────────────────

class ContractCreate(BaseModel):
    client_id: UUID
    title: str
    description: Optional[str] = None
    contract_type: Optional[str] = None
    duration_months: Optional[int] = None
    price: Optional[float] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    value: float
    currency: str = "MAD"
    terms: Optional[str] = None
    notes: Optional[str] = None


class ContractUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ContractStatus] = None
    contract_type: Optional[str] = None
    duration_months: Optional[int] = None
    price: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    value: Optional[float] = None
    terms: Optional[str] = None
    notes: Optional[str] = None

    # Optional editable client and company data for director inline updates
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    cin_number: Optional[str] = None
    birth_date: Optional[datetime] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    company_name: Optional[str] = None
    company_ice: Optional[str] = None
    company_rc: Optional[str] = None
    company_address: Optional[str] = None
    company_activity: Optional[str] = None
    company_email: Optional[EmailStr] = None
    company_phone: Optional[str] = None


class ContractRequestCreate(BaseModel):
    # Personal fields are optional on contract request because they are already
    # collected during registration / profile update. The backend merges this
    # payload with ClientProfile to avoid asking the client for the same data twice.
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    cin_number: Optional[str] = None
    birth_date: Optional[datetime] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    contract_type: str
    start_date: Optional[datetime] = None
    duration_months: int
    company_name: Optional[str] = None
    company_ice: Optional[str] = None
    company_rc: Optional[str] = None
    company_address: Optional[str] = None
    company_activity: Optional[str] = None
    company_email: Optional[EmailStr] = None
    company_phone: Optional[str] = None

    @validator("duration_months")
    def duration_must_have_fixed_price(cls, value):
        if value not in {1, 3, 6}:
            raise ValueError("duration_months must be one of: 1, 3, 6")
        return value

class ContractRenewalRequest(BaseModel):
    duration_months: int = 1
    start_date: Optional[datetime] = None
    notes: Optional[str] = None

    @validator("duration_months")
    def renewal_months_positive(cls, value):
        if value < 1 or value > 24:
            raise ValueError("duration_months must be between 1 and 24")
        return value


class ContractResponse(BaseModel):
    id: UUID
    contract_number: str
    client_id: UUID
    title: str
    description: Optional[str]
    status: ContractStatus
    contract_type: Optional[str] = None
    duration_months: Optional[int] = None
    price: float = 0.0
    pdf_path: Optional[str] = None
    word_path: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime]
    value: float
    currency: str
    terms: Optional[str]
    notes: Optional[str]
    created_at: datetime
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[UUID] = None
    client: Optional[UserWithProfile] = None

    class Config:
        from_attributes = True


# ─── Invoice Schemas ──────────────────────────────────────────────────────────

class InvoiceItemCreate(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float


class InvoiceCreate(BaseModel):
    client_id: UUID
    contract_id: Optional[UUID] = None
    due_date: datetime
    service_start_date: Optional[datetime] = None
    duration_months: Optional[int] = None
    tax_rate: float = 20.0
    notes: Optional[str] = None
    items: List[InvoiceItemCreate]


class InvoiceUpdate(BaseModel):
    status: Optional[InvoiceStatus] = None
    due_date: Optional[datetime] = None
    service_start_date: Optional[datetime] = None
    duration_months: Optional[int] = None
    notes: Optional[str] = None
    paid_date: Optional[datetime] = None
    payment_method: Optional[PaymentMethod] = None
    amount_paid: Optional[float] = None



class InvoiceItemResponse(BaseModel):
    id: UUID
    description: str
    quantity: float
    unit_price: float
    total: float

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: UUID
    invoice_number: str
    client_id: UUID
    contract_id: Optional[UUID]
    status: InvoiceStatus
    issue_date: datetime
    service_start_date: Optional[datetime] = None
    service_end_date: Optional[datetime] = None
    duration_months: Optional[int] = None
    due_date: datetime
    paid_date: Optional[datetime]
    payment_method: Optional[PaymentMethod] = None
    amount_paid: float = 0.0
    remaining_amount: float = 0.0
    exported_to_sage: bool = False
    sage_exported_at: Optional[datetime] = None
    subtotal: float
    tax_rate: float
    tax_amount: float
    total: float
    currency: str
    notes: Optional[str]
    items: List[InvoiceItemResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Document Schemas ─────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: UUID
    owner_id: UUID
    contract_id: Optional[UUID]
    name: str
    original_filename: str
    file_size: Optional[int]
    mime_type: Optional[str]
    doc_type: DocumentType
    category: Optional[str] = None
    version: int = 1
    is_verified: bool = False
    description: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ─── Analytics Schemas ────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_clients: int
    total_contracts: int
    total_invoices: int
    total_revenue: float
    pending_invoices: int
    paid_invoices: int = 0
    unpaid_invoices: int = 0
    active_contracts: int
    expired_contracts: int = 0
    overdue_invoices: int = 0
    unpaid_amount: float = 0.0
    sage_pending_invoices: int = 0
    expiring_contracts_30d: int = 0
    total_documents: int = 0
    monthly_revenue: List[dict]
    contract_status_breakdown: dict
    invoice_status_breakdown: dict
    top_clients: List[dict] = []
    alerts: List[dict] = []


# Update forward refs
TokenResponse.model_rebuild()
UserWithProfile.model_rebuild()


class NotificationResponse(BaseModel):
    id: UUID
    type: NotificationType
    title: str
    message: str
    action_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: UUID
    actor_id: Optional[UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[UUID] = None
    description: Optional[str] = None
    meta: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RenewalRequestCreate(BaseModel):
    message: Optional[str] = None


class RenewalRequestDecision(BaseModel):
    status: RenewalRequestStatus
    message: Optional[str] = None


class RenewalRequestResponse(BaseModel):
    id: UUID
    contract_id: UUID
    client_id: UUID
    message: Optional[str] = None
    status: RenewalRequestStatus
    created_at: datetime
    updated_at: datetime
    contract: Optional[ContractResponse] = None
    client: Optional[UserWithProfile] = None

    class Config:
        from_attributes = True
        
class SageExportJob(BaseModel):
    __tablename__ = "sage_export_jobs"

    id = Column(Integer, primary_key=True, index=True)

    filename = Column(String, nullable=False)

    content = Column(Text, nullable=False)

    status = Column(String, default="pending")

    created_at = Column(DateTime, default=datetime.utcnow)

    downloaded_at = Column(DateTime, nullable=True)