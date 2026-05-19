"""Demo database seed for local testing.
Creates sample clients, contracts, invoices, invoice items and documents.
Safe to run multiple times: it skips if demo clients already exist.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .models import (
    User, ClientProfile, Contract, Invoice, InvoiceItem, Document,
    UserRole, ContractStatus, InvoiceStatus, DocumentType, PaymentMethod, AuditLog,
    Notification, NotificationType,
)
from .utils.auth import hash_password


def seed_demo_data(db: Session, force: bool = False) -> dict:
    existing = db.query(User).filter(User.email.like("demo.%@example.com")).count()
    if existing and not force:
        return {"created": False, "message": "Demo data already exists", "clients": existing}

    admin = db.query(User).filter(User.role == UserRole.DIRECTEUR).first()
    creator_id = admin.id if admin else None
    now = datetime.utcnow()

    demo_clients = [
        {
            "email": "demo.atlas@example.com", "password": "Client@2024!",
            "first_name": "Youssef", "last_name": "Bennani", "phone": "+212 661 111 222",
            "city": "Casablanca", "company_name": "Atlas Digital Services", "ice": "002345678000071",
            "activity": "Conseil IT & transformation digitale", "amount": 42000, "status": InvoiceStatus.PAID,
            "contract_status": ContractStatus.ACTIVE, "exported": False,
        },
        {
            "email": "demo.nova@example.com", "password": "Client@2024!",
            "first_name": "Salma", "last_name": "El Amrani", "phone": "+212 662 333 444",
            "city": "Rabat", "company_name": "Nova Consulting Maroc", "ice": "001987654000032",
            "activity": "Audit, formation et stratégie", "amount": 28500, "status": InvoiceStatus.PENDING,
            "contract_status": ContractStatus.ACTIVE, "exported": False,
        },
        {
            "email": "demo.medina@example.com", "password": "Client@2024!",
            "first_name": "Amine", "last_name": "Tazi", "phone": "+212 663 555 666",
            "city": "Marrakech", "company_name": "Medina Hospitality Group", "ice": "003456789000019",
            "activity": "Hôtellerie & gestion commerciale", "amount": 73500, "status": InvoiceStatus.PAID,
            "contract_status": ContractStatus.ACTIVE, "exported": True,
        },
        {
            "email": "demo.sahara@example.com", "password": "Client@2024!",
            "first_name": "Hajar", "last_name": "Mansouri", "phone": "+212 664 777 888",
            "city": "Agadir", "company_name": "Sahara Logistics", "ice": "004567890000027",
            "activity": "Transport & logistique", "amount": 19800, "status": InvoiceStatus.OVERDUE,
            "contract_status": ContractStatus.EXPIRED, "exported": False,
        },
    ]

    created_clients = 0
    created_invoices = 0
    for idx, item in enumerate(demo_clients, start=1):
        user = db.query(User).filter(User.email == item["email"]).first()
        if not user:
            user = User(
                email=item["email"],
                hashed_password=hash_password(item["password"]),
                role=UserRole.CLIENT,
                is_active=True,
            )
            db.add(user)
            db.flush()
            db.add(ClientProfile(
                user_id=user.id,
                first_name=item["first_name"],
                last_name=item["last_name"],
                phone=item["phone"],
                address=f"Adresse test {idx}, {item['city']}",
                city=item["city"],
                country="Morocco",
                company_name=item["company_name"],
                company_ice=item["ice"],
                company_activity=item["activity"],
                company_email=item["email"],
                company_phone=item["phone"],
            ))
            created_clients += 1

        contract = db.query(Contract).filter(Contract.contract_number == f"CTR-DEMO-2026-{idx:03d}").first()
        if not contract:
            start = now - timedelta(days=120 - idx * 12)
            end = now + timedelta(days=180 - idx * 30) if item["contract_status"] != ContractStatus.EXPIRED else now - timedelta(days=20)
            contract = Contract(
                contract_number=f"CTR-DEMO-2026-{idx:03d}",
                client_id=user.id,
                created_by=creator_id,
                title=f"Contrat ERP - {item['company_name']}",
                description="Contrat de démonstration pour tester dashboard, ERP Sage et facturation.",
                contract_type="Service annuel",
                duration_months=12,
                price=item["amount"],
                status=item["contract_status"],
                start_date=start,
                end_date=end,
                value=item["amount"],
                currency="MAD",
                terms="Conditions de test générées automatiquement.",
                approved_at=now - timedelta(days=90),
                signed_at=now - timedelta(days=88),
            )
            db.add(contract)
            db.flush()

        invoice = db.query(Invoice).filter(Invoice.invoice_number == f"FAC-DEMO-2026-{idx:03d}").first()
        if not invoice:
            subtotal = round(item["amount"] / 1.2, 2)
            tax = round(item["amount"] - subtotal, 2)
            issue = now - timedelta(days=45 - idx * 5)
            due = issue + timedelta(days=30)
            paid_date = issue + timedelta(days=12) if item["status"] == InvoiceStatus.PAID else None
            invoice = Invoice(
                invoice_number=f"FAC-DEMO-2026-{idx:03d}",
                client_id=user.id,
                contract_id=contract.id,
                created_by=creator_id,
                status=item["status"],
                issue_date=issue,
                due_date=due if item["status"] != InvoiceStatus.OVERDUE else now - timedelta(days=15),
                paid_date=paid_date,
                payment_method=PaymentMethod.BANK_TRANSFER if item["status"] == InvoiceStatus.PAID else None,
                amount_paid=item["amount"] if item["status"] == InvoiceStatus.PAID else 0,
                remaining_amount=0 if item["status"] == InvoiceStatus.PAID else item["amount"],
                exported_to_sage=item["exported"],
                sage_exported_at=now - timedelta(days=5) if item["exported"] else None,
                subtotal=subtotal,
                tax_rate=20,
                tax_amount=tax,
                total=item["amount"],
                currency="MAD",
                notes="Facture de démonstration.",
            )
            db.add(invoice)
            db.flush()
            db.add(InvoiceItem(
                invoice_id=invoice.id,
                description=f"Pack ERP / conseil - {item['company_name']}",
                quantity=1,
                unit_price=subtotal,
                total=subtotal,
            ))
            created_invoices += 1

        doc = db.query(Document).filter(Document.name == f"Document Demo {idx}").first()
        if not doc:
            db.add(Document(
                owner_id=user.id,
                contract_id=contract.id,
                name=f"Document Demo {idx}",
                original_filename=f"demo_document_{idx}.pdf",
                file_path=f"uploads/demo_document_{idx}.pdf",
                file_size=1024 * idx,
                mime_type="application/pdf",
                doc_type=DocumentType.CONTRACT,
                category="contrat",
                version=1,
                is_verified=idx % 2 == 0,
                description="Document fictif pour remplir l’interface de test.",
            ))

        contract_key = f"seed-contract-expiring:{contract.id}"
        has_contract_notification = db.query(Notification).filter(Notification.source_key == contract_key).first()
        if not has_contract_notification and contract.end_date and contract.end_date <= now + timedelta(days=30):
            db.add(Notification(
                user_id=user.id,
                type=NotificationType.CONTRACT_EXPIRING,
                title="Contrat proche expiration",
                message=f"Votre contrat {contract.contract_number} expire bientot. Vous pouvez demander un renouvellement.",
                source_key=contract_key,
            ))

        if invoice.status == InvoiceStatus.OVERDUE:
            invoice_key = f"seed-invoice-overdue:{invoice.id}"
            has_invoice_notification = db.query(Notification).filter(Notification.source_key == invoice_key).first()
            if not has_invoice_notification:
                db.add(Notification(
                    user_id=user.id,
                    type=NotificationType.INVOICE_OVERDUE,
                    title="Facture echue",
                    message=f"Votre facture {invoice.invoice_number} est echue depuis le {invoice.due_date.strftime('%d/%m/%Y')}.",
                    source_key=invoice_key,
                ))

    db.add(AuditLog(
        actor_id=creator_id,
        action="seed_demo_data",
        entity_type="system",
        description="Données de démonstration ajoutées pour tester le dashboard et l’ERP.",
        meta={"clients": created_clients, "invoices": created_invoices},
    ))
    db.commit()
    return {"created": True, "clients": created_clients, "invoices": created_invoices}
