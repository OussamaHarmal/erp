# Mise à jour Dashboard + ERP Sage + Style moderne

## Changements effectués

### Frontend
- Dashboard directeur remplacé par une interface plus propre et professionnelle.
- Nouveau style global moderne clair : glass cards, hero sections, panels, métriques propres, tables plus lisibles.
- Page ERP Sage améliorée avec bouton **Exporter Excel**.
- Export ERP disponible en TXT Sage, Excel de contrôle, ZIP par période et dossier Sage.

### Backend
- Nouveau endpoint : `GET /api/v1/erp/sage/export/excel`
- Le fichier Excel contient :
  - feuille `Controle Sage`
  - feuille `Lignes Sage`
  - feuille `Erreurs`
- L’export Excel respecte les filtres : date début, date fin, seulement non exportées.

## Commandes

```bash
cd frontend
npm install
npm run build
```

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
