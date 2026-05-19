"""
AI Chatbot Routes
Role-aware assistant for client and director/admin dashboards.
Uses an OpenAI-compatible API when configured, with a safe local fallback.
"""
import json
import urllib.error
import urllib.request
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..middleware.rbac import require_any_authenticated
from ..models import (
    User, UserRole, ClientProfile, Contract, Invoice, Document,
    ContractStatus, InvoiceStatus, AuditLog
)

router = APIRouter(prefix="/chatbot", tags=["AI Chatbot"])


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=3000)
    history: Optional[List[ChatMessage]] = Field(default_factory=list)


def _money(value: float) -> str:
    return f"{float(value or 0):,.2f} MAD".replace(",", " ")


def _date(value) -> str:
    return value.strftime("%d/%m/%Y") if value else "-"


def _build_client_context(db: Session, user: User) -> str:
    profile = user.profile
    contracts = db.query(Contract).filter(Contract.client_id == user.id).order_by(Contract.created_at.desc()).limit(8).all()
    invoices = db.query(Invoice).filter(Invoice.client_id == user.id).order_by(Invoice.issue_date.desc()).limit(10).all()
    documents_count = db.query(Document).filter(Document.owner_id == user.id).count()

    total_paid = db.query(func.sum(Invoice.total)).filter(Invoice.client_id == user.id, Invoice.status == InvoiceStatus.PAID).scalar() or 0
    total_pending = db.query(func.sum(Invoice.total)).filter(Invoice.client_id == user.id, Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE])).scalar() or 0

    profile_line = ""
    if profile:
        profile_line = f"Client: {profile.full_name}, société: {profile.company_name or '-'}, ville: {profile.city or '-'}, ICE: {profile.company_ice or '-'}"

    contract_lines = [
        f"- {c.contract_number}: {c.title}, statut={c.status.value}, début={_date(c.start_date)}, fin={_date(c.end_date)}, valeur={_money(c.value or c.price)}"
        for c in contracts
    ]
    invoice_lines = [
        f"- {i.invoice_number}: statut={i.status.value}, date={_date(i.issue_date)}, échéance={_date(i.due_date)}, total={_money(i.total)}, export_sage={bool(i.exported_to_sage)}"
        for i in invoices
    ]

    return "\n".join([
        "CONTEXTE CLIENT AUTORISÉ:",
        profile_line,
        f"Total payé: {_money(total_paid)} | Montant en attente/retard: {_money(total_pending)} | Documents: {documents_count}",
        "Contrats récents:", *(contract_lines or ["- Aucun contrat"]),
        "Factures récentes:", *(invoice_lines or ["- Aucune facture"]),
    ])


def _build_director_context(db: Session, user: User) -> str:
    total_clients = db.query(User).filter(User.role == UserRole.CLIENT).count()
    total_contracts = db.query(Contract).count()
    total_invoices = db.query(Invoice).count()
    paid_revenue = db.query(func.sum(Invoice.total)).filter(Invoice.status == InvoiceStatus.PAID).scalar() or 0
    pending_amount = db.query(func.sum(Invoice.total)).filter(Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE])).scalar() or 0
    sage_pending = db.query(Invoice).filter(Invoice.status == InvoiceStatus.PAID, Invoice.exported_to_sage == False).count()  # noqa: E712

    invoice_status = db.query(Invoice.status, func.count(Invoice.id), func.coalesce(func.sum(Invoice.total), 0)).group_by(Invoice.status).all()
    contract_status = db.query(Contract.status, func.count(Contract.id)).group_by(Contract.status).all()

    recent_invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).limit(10).all()
    top_clients = (
        db.query(User.email, ClientProfile.first_name, ClientProfile.last_name, func.coalesce(func.sum(Invoice.total), 0).label("revenue"))
        .join(Invoice, Invoice.client_id == User.id)
        .outerjoin(ClientProfile, ClientProfile.user_id == User.id)
        .filter(Invoice.status == InvoiceStatus.PAID)
        .group_by(User.email, ClientProfile.first_name, ClientProfile.last_name)
        .order_by(func.sum(Invoice.total).desc())
        .limit(5)
        .all()
    )

    return "\n".join([
        "CONTEXTE ADMIN/DIRECTEUR AUTORISÉ:",
        f"Clients: {total_clients} | Contrats: {total_contracts} | Factures: {total_invoices}",
        f"CA payé: {_money(paid_revenue)} | À encaisser/retard: {_money(pending_amount)} | Factures payées non exportées Sage: {sage_pending}",
        "Statuts factures: " + ", ".join([f"{s.value}={c} ({_money(t)})" for s, c, t in invoice_status]),
        "Statuts contrats: " + ", ".join([f"{s.value}={c}" for s, c in contract_status]),
        "Top clients: " + "; ".join([f"{(fn or '')} {(ln or '')} <{email}>: {_money(revenue)}" for email, fn, ln, revenue in top_clients]) or "Top clients: aucun",
        "Factures récentes:", *[
            f"- {i.invoice_number}: {i.status.value}, total={_money(i.total)}, échéance={_date(i.due_date)}, sage={bool(i.exported_to_sage)}"
            for i in recent_invoices
        ]
    ])


def _local_fallback_answer(message: str, context: str, user: User) -> str:
    msg = message.lower()
    role = "admin" if user.role == UserRole.DIRECTEUR else "client"

    if any(k in msg for k in ["sage", "export", "mae", "vte"]):
        return (
            "Pour Sage, le format validé commence par `VTE`, puis Date pièce en `JJMMAA`, N° pièce, N° facture, Référence, compte, tiers, libellé, échéance, débit, crédit. "
            "La ligne client doit être au débit et les lignes HT/TVA au crédit avec `;;;montant`."
        )
    if any(k in msg for k in ["facture", "invoice", "impay", "pay"]):
        return "Voici le résumé facturation disponible dans ton espace:\n\n" + "\n".join([l for l in context.splitlines() if "Facture" in l or "facture" in l or "Total" in l or "CA" in l][:12])
    if any(k in msg for k in ["contrat", "contract"]):
        return "Voici le résumé contrats disponible dans ton espace:\n\n" + "\n".join([l for l in context.splitlines() if "Contrat" in l or "contrat" in l][:12])
    if any(k in msg for k in ["client", "dashboard", "ca", "revenu", "chiffre"]):
        return "Résumé rapide du dashboard:\n\n" + "\n".join(context.splitlines()[1:8])

    if role == "admin":
        return "Je peux t’aider à analyser les clients, factures, contrats, chiffre d’affaires et exports Sage. Pose-moi une question comme : “quelles factures ne sont pas exportées Sage ?” ou “résume le CA”."
    return "Je peux t’aider à comprendre tes contrats, factures, documents et paiements. Pose-moi une question comme : “quelle facture est en attente ?” ou “résume mes contrats”."


def _call_openai_compatible(system_prompt: str, history: List[ChatMessage], message: str) -> str:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY missing")

    url = settings.OPENAI_BASE_URL.rstrip("/") + "/chat/completions"
    payload = {
        "model": settings.OPENAI_MODEL,
        "temperature": 0.25,
        "max_tokens": 700,
        "messages": [
            {"role": "system", "content": system_prompt},
            *[{"role": m.role, "content": m.content} for m in (history or [])[-8:]],
            {"role": "user", "content": message},
        ],
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=25) as res:
        data = json.loads(res.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"].strip()


@router.post("/ask")
def ask_chatbot(
    payload: ChatRequest,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db),
):
    """Ask the ERP chatbot. Role-aware: clients only see their own data, directors see global data."""
    context = _build_director_context(db, current_user) if current_user.role == UserRole.DIRECTEUR else _build_client_context(db, current_user)

    system_prompt = f"""
Tu es UIS Assistant, un chatbot ERP professionnel intégré dans Universal Invest Strategy CMS.
Réponds en français simple ou Darija si l'utilisateur écrit en Darija.
Tu dois utiliser uniquement le contexte fourni ci-dessous. Ne crée jamais de fausses données.
Si l'information n'existe pas dans le contexte, dis clairement que tu ne peux pas la confirmer.
Pour un client: ne parle que de ses propres données.
Pour un directeur/admin: tu peux donner des synthèses globales et recommandations.
Ne donne pas de conseils juridiques/comptables définitifs; propose de vérifier avec le responsable comptable.
Date système: {datetime.utcnow().strftime('%d/%m/%Y')}

{context}
""".strip()

    provider = "local"
    try:
        if settings.AI_CHATBOT_ENABLED and settings.OPENAI_API_KEY:
            answer = _call_openai_compatible(system_prompt, payload.history or [], payload.message)
            provider = settings.AI_PROVIDER or "external"
        else:
            answer = _local_fallback_answer(payload.message, context, current_user)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError, KeyError, IndexError) as exc:
        answer = _local_fallback_answer(payload.message, context, current_user)
        provider = f"local_fallback ({exc.__class__.__name__})"

    db.add(AuditLog(
        actor_id=current_user.id,
        action="chatbot_ask",
        entity_type="chatbot",
        description=f"Question chatbot par {current_user.role.value}",
        meta={"provider": provider, "question_preview": payload.message[:140]},
    ))
    db.commit()

    return {"answer": answer, "provider": provider, "role": current_user.role.value}
