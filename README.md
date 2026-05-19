# 🚀 Smart CMS — Client & Contract Management System

Plateforme web complète pour gérer clients, contrats, factures et documents.  
**Stack :** React + FastAPI + PostgreSQL + JWT RBAC

---

## 🆕 Nouvelles fonctionnalités ERP (renouvellement + notifications)

- **Demandes de renouvellement contrat**
  - `POST /api/v1/contracts/{id}/renewal-request` (client)
  - `GET /api/v1/client/renewal-requests` (client)
  - `GET /api/v1/director/renewal-requests` (directeur)
  - `PATCH /api/v1/director/renewal-requests/{id}` (accept/refuse)
  - Une seule demande `pending` par contrat est autorisée.
- **Notifications**
  - `GET /api/v1/notifications`
  - `PATCH /api/v1/notifications/{id}/read`
  - `PATCH /api/v1/notifications/read-all`
  - Notifications auto pour contrats proches expiration / expirés et factures échues, sans doublons (`source_key`).
- **UI moderne**
  - `NotificationBell` dans la topbar avec compteur non-lu.
  - Page Notifications pour client et directeur.
  - Contrats client: statut + dates + action **Demander renouvellement**.
  - Factures client: statuts (payé/non payé/échue), dates, montant, téléchargement PDF.

### Migration SQL

- Ajouter `backend/migrations/006_renewal_requests_notifications_upgrade.sql`.
- Cette migration crée la table `renewal_requests` et enrichit `notifications` (`source_key`, `updated_at`, index anti-doublon).

### Données de démonstration

- `backend/app/demo_seed.py` ajoute maintenant des notifications de test:
  - contrats proches expiration,
  - factures échues,
  - utile pour tester badge + page Notifications.

---

## 📁 Structure du projet

```
smart-cms/
├── backend/                    # FastAPI API
│   ├── app/
│   │   ├── main.py             # Point d'entrée + seed admin
│   │   ├── config.py           # Variables d'environnement
│   │   ├── database.py         # SQLAlchemy engine & session
│   │   ├── models.py           # ORM models (User, Contract, Invoice, Document...)
│   │   ├── routes/             # Endpoints API
│   │   │   ├── auth.py         # Login / Register / Refresh / Logout
│   │   │   ├── clients.py      # CRUD clients (Directeur)
│   │   │   ├── contracts.py    # CRUD contrats
│   │   │   ├── invoices.py     # CRUD factures + export Excel
│   │   │   ├── documents.py    # Upload / Download fichiers
│   │   │   └── analytics.py    # Dashboard stats
│   │   ├── schemas/
│   │   │   └── schemas.py      # Pydantic models (validation)
│   │   ├── middleware/
│   │   │   └── rbac.py         # Role-Based Access Control
│   │   └── utils/
│   │       └── auth.py         # JWT helpers + bcrypt
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── App.jsx             # Routes + protection
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Auth state global
│   │   ├── services/
│   │   │   └── api.js          # Axios + auto token refresh
│   │   ├── components/layout/
│   │   │   ├── DashboardLayout.jsx
│   │   │   ├── Sidebar.jsx     # Navigation dynamique par rôle
│   │   │   └── TopBar.jsx
│   │   └── pages/
│   │       ├── auth/
│   │       │   ├── LoginPage.jsx
│   │       │   └── RegisterPage.jsx
│   │       ├── director/       # Espace DIRECTEUR
│   │       │   ├── Dashboard.jsx       # Analytics + charts
│   │       │   ├── ClientsPage.jsx     # CRUD clients
│   │       │   ├── ContractsPage.jsx   # CRUD contrats
│   │       │   └── InvoicesPage.jsx    # CRUD factures + Excel
│   │       └── client/         # Espace CLIENT
│   │           ├── Dashboard.jsx       # Stats personnelles
│   │           ├── MyContractsPage.jsx # Mes contrats (lecture)
│   │           ├── MyInvoicesPage.jsx  # Mes factures détaillées
│   │           ├── MyDocumentsPage.jsx # Upload / Download fichiers
│   │           └── MyProfilePage.jsx   # Édition profil
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── docker-compose.yml
```

---

## ⚡ Démarrage rapide

### Option 1 — Docker (recommandé)

```bash
# Cloner et démarrer
git clone <repo>
cd smart-cms
docker-compose up -d

# Frontend : http://localhost:3000
# Backend API : http://localhost:8000/api/docs
```

### Option 2 — Manuel

#### Backend

```bash
cd backend

# Créer l'environnement virtuel
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (DATABASE_URL, SECRET_KEY...)

# Démarrer le serveur
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

npm install
npm run dev
# → http://localhost:3000
```

#### Base de données

```bash
# Créer la base PostgreSQL
createdb smart_cms

# Les tables sont créées automatiquement au démarrage
# Le compte admin est seedé automatiquement :
# Email : admin@smartcms.ma
# MDP   : Admin@2024!
```

---

## 🔐 Comptes de test

| Rôle      | Email                | Mot de passe  |
|-----------|----------------------|---------------|
| Directeur | admin@smartcms.ma    | Admin@2024!   |
| Client    | client@test.ma       | Client@2024!  |

> Le compte client de test doit être créé manuellement via `/register` ou par le Directeur.

---

## 🗺️ Endpoints API

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| POST | `/api/v1/auth/login` | Public | Connexion |
| POST | `/api/v1/auth/register` | Public | Inscription client |
| POST | `/api/v1/auth/refresh` | Public | Refresh token |
| POST | `/api/v1/auth/logout` | Auth | Déconnexion |
| GET | `/api/v1/clients` | Directeur | Liste clients |
| POST | `/api/v1/clients` | Directeur | Créer client |
| GET | `/api/v1/contracts` | Auth | Liste contrats |
| POST | `/api/v1/contracts` | Directeur | Créer contrat |
| GET | `/api/v1/invoices` | Auth | Liste factures |
| POST | `/api/v1/invoices` | Directeur | Créer facture |
| GET | `/api/v1/invoices/export/excel` | Directeur | Export Excel |
| POST | `/api/v1/documents/upload` | Auth | Upload document |
| GET | `/api/v1/analytics/dashboard` | Directeur | Dashboard stats |
| GET | `/api/v1/analytics/my-stats` | Client | Stats personnelles |

**Documentation Swagger :** http://localhost:8000/api/docs

---

## 🔒 Sécurité

- **JWT** : access token (30min) + refresh token (7j) avec rotation
- **bcrypt** : hashage des mots de passe
- **RBAC** : middleware vérifie le rôle sur chaque route protégée
- **Ownership check** : un client ne peut accéder qu'à ses propres ressources
- **File validation** : type MIME + taille max 10Mo pour les uploads

---

## 🎨 Features par rôle

### 👤 CLIENT
- Dashboard personnel avec stats
- Consulter ses contrats (détail, statut, valeur)
- Consulter ses factures (lignes de détail, TVA)
- Uploader / télécharger ses documents (CIN, etc.)
- Éditer son profil (nom, adresse, téléphone...)

### 🧑‍💼 DIRECTEUR
- Dashboard analytics (revenus, charts, KPIs)
- CRUD complet clients (créer, activer/désactiver, supprimer)
- CRUD contrats (créer, changer statut, supprimer)
- CRUD factures avec lignes de facturation + TVA
- Marquer factures comme payées
- Export Excel de toutes les factures
