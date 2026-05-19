# Universal Invest Strategy CMS — Projet final structuré

## Stack
- Frontend: React + Vite
- Backend: FastAPI
- Database: PostgreSQL + SQLAlchemy
- Auth: JWT + RBAC
- Exports: PDF, Word, Excel, TXT Sage
- Email: SMTP avec pièces jointes

## Dossiers importants

```txt
backend/
  app/
    assets/                 Logo utilisé dans les exports PDF
    routes/                 Endpoints API
      contracts.py          Workflow contrat + renouvellement + email
      invoices.py           Factures + PDF + Excel + TXT Sage + email
      documents.py          Upload/download documents client/admin
      clients.py            Gestion clients + profils
      auth.py               Login/register/JWT
    services/
      contract_exports.py   Génération contrat PDF/Word
      invoice_exports.py    Génération facture PDF
      email_service.py      SMTP propre et centralisé
    utils/
      email.py              Wrapper compatible import ancien
    models.py               Modèles SQLAlchemy
    schemas/schemas.py      Schémas Pydantic
  migrations/               Scripts SQL d'évolution DB
  .env.example              Variables générales
  .env.smtp.example         Exemple SMTP

frontend/
  public/ui_logo.jpeg       Logo affiché dans l'app
  src/
    pages/auth/             Login/Register avec branding
    pages/client/           Espace client: contrat, factures, documents
    pages/director/         Admin: clients, contrats, factures
    components/layout/      Layout, sidebar, topbar, dark/light mode
    services/api.js         Toutes les méthodes API
```

## Workflow principal

1. Le client crée un compte puis remplit la demande de contrat.
2. Le backend met à jour/crée le profil client.
3. Le backend crée le contrat avec statut `pending`.
4. Le backend génère automatiquement une facture liée au contrat.
5. La date fin de facture est calculée automatiquement selon la durée.
6. Le backend génère contrat PDF/Word + facture PDF.
7. Si SMTP est configuré, le client reçoit un email avec les fichiers joints.
8. Le directeur voit les demandes non approuvées, peut approuver/refuser/modifier.
9. Le client peut demander un renouvellement si son contrat existe/expire.
10. Le directeur peut exporter Excel, Canva comptabilité et TXT Sage.

## Configuration SMTP

Copie `backend/.env.example` vers `backend/.env`, puis ajoute les valeurs SMTP.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_gmail_app_password_without_spaces
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_FROM_NAME=Universal Invest Strategy
SMTP_USE_TLS=true
```

Important: avec Gmail, `SMTP_PASSWORD` doit être un **App Password**, pas le mot de passe réel du compte.

## Endpoints email utiles

- `POST /api/v1/contracts/{contract_id}/send-email` : renvoyer contrat + facture au client.
- `POST /api/v1/invoices/{invoice_id}/send-email` : renvoyer facture au client.

## Exports factures

- `GET /api/v1/invoices/export/excel`
- `GET /api/v1/invoices/export/accounting-canvas`
- `GET /api/v1/invoices/export/sage-txt`

## Lancement

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Migrations

Si la base existe déjà, exécute les migrations SQL dans l'ordre depuis `backend/migrations/`.
