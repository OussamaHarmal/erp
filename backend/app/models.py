"""
Database Models
SQLAlchemy ORM models for all entities
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Float, Boolean, DateTime,
    Enum, ForeignKey, Text, BigInteger, Integer, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from .database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    CLIENT = "client"
    DIRECTEUR = "directeur"


class ContractStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    ACTIVE = "active"
    REJECTED = "rejected"
    EXPIRED = "expired"
    TERMINATED = "terminated"


class InvoiceStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class DocumentType(str, enum.Enum):
    CIN = "cin"
    RC = "rc"
    ICE = "ice"
    CONTRACT = "contract"
    SIGNED_CONTRACT = "signed_contract"
    INVOICE = "invoice"
    RECEIPT = "receipt"
    OTHER = "other"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CHECK = "check"
    CARD = "card"
    OTHER = "other"


class NotificationType(str, enum.Enum):
    CONTRACT_EXPIRING = "contract_expiring"
    INVOICE_OVERDUE = "invoice_overdue"
    SAGE_EXPORT = "sage_export"
    SYSTEM = "system"


# ─── User Model ───────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.CLIENT)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship(
        "ClientProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    contracts = relationship(
        "Contract",
        foreign_keys="[Contract.client_id]",
        back_populates="client"
    )

    created_contracts = relationship(
        "Contract",
        foreign_keys="[Contract.created_by]",
        back_populates="creator"
    )

    approved_contracts = relationship(
        "Contract",
        foreign_keys="[Contract.approved_by]",
        back_populates="approver"
    )

    invoices = relationship(
        "Invoice",
        foreign_keys="[Invoice.client_id]",
        back_populates="client"
    )

    created_invoices = relationship(
        "Invoice",
        foreign_keys="[Invoice.created_by]",
        back_populates="creator"
    )

    documents = relationship(
        "Document",
        back_populates="owner"
    )

    refresh_tokens = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    renewal_requests = relationship(
        "RenewalRequest",
        back_populates="client",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"


# ─── Client Profile ───────────────────────────────────────────────────────────

class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )

    # Personal info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    cin_number = Column(String(20), unique=True, index=True)
    address = Column(Text)
    city = Column(String(100))
    country = Column(String(100), default="Morocco")
    birth_date = Column(DateTime)

    # Company info
    company_name = Column(String(200))
    company_ice = Column(String(100))
    company_rc = Column(String(100))
    company_address = Column(Text)
    company_activity = Column(String(200))
    company_email = Column(String(255))
    company_phone = Column(String(50))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship(
        "User",
        back_populates="profile"
    )

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __repr__(self):
        return f"<ClientProfile {self.full_name}>"


# ─── Contract Model ───────────────────────────────────────────────────────────

class Contract(Base):
    __tablename__ = "contracts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_number = Column(String(50), unique=True, nullable=False, index=True)

    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE")
    )

    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id")
    )

    approved_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )

    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(Enum(ContractStatus), default=ContractStatus.DRAFT)

    # Contract request workflow fields
    contract_type = Column(String(100), nullable=True)
    duration_months = Column(BigInteger, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    pdf_path = Column(String(500), nullable=True)
    word_path = Column(String(500), nullable=True)

    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    value = Column(Float, nullable=False, default=0.0)
    currency = Column(String(3), default="MAD")

    terms = Column(Text)
    notes = Column(Text)

    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    signed_at = Column(DateTime, nullable=True)
    renewal_parent_id = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship(
        "User",
        foreign_keys=[client_id],
        back_populates="contracts"
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="created_contracts"
    )

    approver = relationship(
        "User",
        foreign_keys=[approved_by],
        back_populates="approved_contracts"
    )

    invoices = relationship(
        "Invoice",
        back_populates="contract"
    )

    documents = relationship(
        "Document",
        back_populates="contract"
    )
    renewal_requests = relationship(
        "RenewalRequest",
        back_populates="contract",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Contract {self.contract_number}>"


# ─── Invoice Model ────────────────────────────────────────────────────────────

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)

    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE")
    )

    contract_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id"),
        nullable=True
    )

    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id")
    )

    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.PENDING)
    issue_date = Column(DateTime, default=datetime.utcnow)

    # Period billed on the invoice. For contract-generated invoices,
    # these dates are calculated automatically from contract.start_date + duration.
    service_start_date = Column(DateTime, nullable=True)
    service_end_date = Column(DateTime, nullable=True)
    duration_months = Column(BigInteger, nullable=True)

    due_date = Column(DateTime, nullable=False)
    paid_date = Column(DateTime, nullable=True)
    payment_method = Column(Enum(PaymentMethod), nullable=True)
    amount_paid = Column(Float, nullable=False, default=0.0)
    remaining_amount = Column(Float, nullable=False, default=0.0)

    exported_to_sage = Column(Boolean, default=False, index=True)
    sage_exported_at = Column(DateTime, nullable=True)
    sage_export_batch_id = Column(UUID(as_uuid=True), nullable=True)

    subtotal = Column(Float, nullable=False, default=0.0)
    tax_rate = Column(Float, default=20.0)
    tax_amount = Column(Float, default=0.0)
    total = Column(Float, nullable=False, default=0.0)
    currency = Column(String(3), default="MAD")

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship(
        "User",
        foreign_keys=[client_id],
        back_populates="invoices"
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="created_invoices"
    )

    contract = relationship(
        "Contract",
        back_populates="invoices"
    )

    items = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Invoice {self.invoice_number} - {self.status}>"


# ─── Invoice Item Model ───────────────────────────────────────────────────────

class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    invoice_id = Column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE")
    )

    description = Column(String(500), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit_price = Column(Float, nullable=False)
    total = Column(Float, nullable=False)

    invoice = relationship(
        "Invoice",
        back_populates="items"
    )


# ─── Document Model ───────────────────────────────────────────────────────────

class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE")
    )

    contract_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id"),
        nullable=True
    )

    name = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(BigInteger)
    mime_type = Column(String(100))
    doc_type = Column(Enum(DocumentType), default=DocumentType.OTHER)
    category = Column(String(80), default="general", index=True)
    version = Column(Integer, default=1)
    is_verified = Column(Boolean, default=False)

    description = Column(Text)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship(
        "User",
        back_populates="documents"
    )

    contract = relationship(
        "Contract",
        back_populates="documents"
    )

    def __repr__(self):
        return f"<Document {self.name}>"


# ─── Refresh Token ────────────────────────────────────────────────────────────

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE")
    )

    token = Column(String(500), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship(
        "User",
        back_populates="refresh_tokens"
    )

# ─── Audit / Notifications / Sage Export History ─────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(120), nullable=False, index=True)
    entity_type = Column(String(80), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    description = Column(Text)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    type = Column(Enum(NotificationType), default=NotificationType.SYSTEM, index=True)
    title = Column(String(180), nullable=False)
    message = Column(Text, nullable=False)
    action_url = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False, index=True)
    source_key = Column(String(200), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class RenewalRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class RenewalRequest(Base):
    __tablename__ = "renewal_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    message = Column(Text, nullable=True)
    status = Column(Enum(RenewalRequestStatus), default=RenewalRequestStatus.PENDING, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contract = relationship("Contract", back_populates="renewal_requests")
    client = relationship("User", back_populates="renewal_requests")


class SageExportBatch(Base):
    __tablename__ = "sage_export_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exported_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    invoice_count = Column(Integer, default=0)
    total_amount = Column(Float, default=0.0)
    filename = Column(String(255), nullable=False)
    export_type = Column(String(30), default="txt")
    status = Column(String(30), default="generated")
    errors = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
