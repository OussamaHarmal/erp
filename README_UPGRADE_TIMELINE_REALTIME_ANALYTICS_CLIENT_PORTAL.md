# Upgrade ajouté

## Fonctionnalités ajoutées

1. **Activity Timeline**
   - Nouveau composant frontend `ActivityTimeline.jsx`.
   - Nouveau endpoint backend `/api/v1/analytics/activity-timeline`.
   - Timeline basée sur contrats, factures, documents, notifications et logs d’audit.

2. **Notifications temps réel**
   - La cloche de notifications se rafraîchit automatiquement toutes les 15 secondes.
   - Badge live + dropdown amélioré.

3. **Dashboard Analytics PREMIUM**
   - Nouveau graphique comparatif CA payé vs factures émises.
   - Centre d’alerte direction.
   - Timeline direction intégrée.
   - KPI enrichis avec labels de tendance.

4. **Espace Client ULTRA PRO**
   - Nouveau hero premium.
   - Score de complétion profil.
   - Actions rapides.
   - Prochaine facture / contrat proche expiration.
   - Timeline personnelle.
   - Cards KPI client modernisées.

## Fichiers modifiés

- `backend/app/routes/analytics.py`
- `frontend/src/services/api.js`
- `frontend/src/components/layout/ActivityTimeline.jsx`
- `frontend/src/components/notifications/NotificationBell.jsx`
- `frontend/src/pages/director/Dashboard.jsx`
- `frontend/src/pages/client/Dashboard.jsx`
- `frontend/src/index.css`

## Notes

Aucune migration obligatoire : les nouvelles fonctionnalités utilisent les tables déjà existantes.
