# Fix renouvellement + notifications expiration

## Ce qui a été corrigé

### 1. Facture générée automatiquement au renouvellement
Quand le client demande un renouvellement depuis `Mes Contrats`, le backend crée maintenant :
- un nouveau contrat de renouvellement en statut `PENDING`
- une facture liée à ce contrat renouvelé
- le PDF/Word du contrat renouvelé
- le PDF de la facture
- un email automatique si SMTP est configuré

Prix renouvellement : `165 MAD / mois` HT, TVA 20% ajoutée sur la facture.

### 2. Notification contrat proche expiration
Nouveau endpoint :

```txt
GET /api/v1/contracts/alerts/expiring-soon?days=30
```

- Client : voit uniquement ses contrats proches d'expiration.
- Directeur : voit tous les contrats proches d'expiration.

### 3. Rappels email expiration
Nouveau endpoint directeur :

```txt
POST /api/v1/contracts/alerts/expiring-soon/send-reminders?days=30
```

Il envoie un email aux clients dont le contrat expire bientôt.

### 4. Frontend
- Dashboard client : alerte si un contrat expire bientôt.
- Mes Contrats client : alerte + bouton renouveler.
- Page contrats directeur : section alerte contrats proches expiration + bouton envoyer rappels email.

## Fichiers modifiés

- `backend/app/routes/contracts.py`
- `frontend/src/services/api.js`
- `frontend/src/pages/client/Dashboard.jsx`
- `frontend/src/pages/client/MyContractsPage.jsx`
- `frontend/src/pages/director/ContractsPage.jsx`

## Important

Aucune nouvelle table n'est nécessaire pour cette correction.
