# Universal Invest Strategy — Upgrade SMTP + Facture + Export Sage

## Nouveautés ajoutées

- Nom de l'application changé en **Universal Invest Strategy CMS**.
- Logo Universal Invest Strategy intégré dans :
  - `backend/app/assets/ui_logo.jpeg`
  - `frontend/public/ui_logo.jpeg`
- Le client remplit la demande de contrat depuis son espace.
- Après soumission client :
  1. création/mise à jour du profil client ;
  2. création du contrat en statut `pending` ;
  3. génération automatique de la facture liée au contrat ;
  4. génération automatique du contrat PDF + Word ;
  5. génération automatique de la facture PDF ;
  6. envoi SMTP au client si SMTP est configuré.
- Export factures :
  - Excel classique ;
  - Canva comptabilité vente client ;
  - TXT Sage lisible par logiciel comptable.

## Configuration SMTP

Dans `backend/.env`, ajouter :

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=contact@ui-strategy.com
SMTP_FROM_NAME=Universal Invest Strategy
SMTP_USE_TLS=true
```

> Pour Gmail, il faut utiliser un **App Password**, pas le mot de passe normal.

## Endpoints ajoutés

```http
GET /api/v1/invoices/export/sage-txt
```

Le fichier TXT Sage contient les lignes comptables :

- journal vente `VT`
- compte client `3421`
- compte vente `7121`
- compte TVA `4455`

## Fichiers backend importants

- `backend/app/config.py`
- `backend/app/services/email_service.py`
- `backend/app/routes/contracts.py`
- `backend/app/routes/invoices.py`
- `backend/app/services/invoice_exports.py`
- `backend/app/services/contract_exports.py`

## Fichiers frontend importants

- `frontend/public/ui_logo.jpeg`
- `frontend/src/components/layout/Sidebar.jsx`
- `frontend/src/pages/auth/LoginPage.jsx`
- `frontend/src/pages/auth/RegisterPage.jsx`
- `frontend/src/pages/client/ContractRequestPage.jsx`
- `frontend/src/pages/director/InvoicesPage.jsx`
- `frontend/src/services/api.js`
