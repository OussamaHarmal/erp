# Smart CMS — Advanced Contract Workflow + Light/Dark Mode

## Nouveautés
- Workflow complet de demande de contrat client.
- Template PDF/Word basé sur le contrat de domiciliation Universal Invest Strategy.
- Informations Universal Invest Strategy fixes.
- Informations client et société client variables.
- Directeur fixe : YOUSSEF BACHRI / BACHRA selon le template.
- Export PDF avec ReportLab.
- Export Word avec python-docx.
- RBAC : client = ses contrats seulement, directeur = tous les contrats.
- Mode clair / sombre avec sauvegarde dans localStorage.

## Fichiers principaux modifiés
- backend/app/models.py
- backend/app/schemas/schemas.py
- backend/app/routes/contracts.py
- backend/app/services/contract_exports.py
- backend/migrations/001_contract_request_workflow.sql
- backend/migrations/002_advanced_contract_workflow.sql
- frontend/src/App.jsx
- frontend/src/context/ThemeContext.jsx
- frontend/src/components/layout/DashboardLayout.jsx
- frontend/src/components/layout/TopBar.jsx
- frontend/src/components/layout/Sidebar.jsx
- frontend/src/index.css
- frontend/src/pages/client/ContractRequestPage.jsx
- frontend/src/pages/client/MyContractsPage.jsx
- frontend/src/pages/director/ContractsPage.jsx
- frontend/src/services/api.js

## Installation
Backend:
```bash
cd backend
pip install -r requirements.txt
psql -d smart_cms -f migrations/001_contract_request_workflow.sql
psql -d smart_cms -f migrations/002_advanced_contract_workflow.sql
uvicorn app.main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```
