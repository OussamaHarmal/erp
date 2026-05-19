# Correction contrats — profil client + listing directeur

## 1. Espace client : suppression de la répétition des informations

Avant, le client saisissait ses informations personnelles à l'inscription, puis devait les ressaisir lors de la demande de contrat.

Maintenant :

- La page `Demande de contrat` récupère automatiquement le profil du client connecté.
- Les informations représentant sont affichées en lecture seule : nom, CIN, téléphone, adresse, ville, date naissance.
- Le client ne remplit plus que :
  - type de contrat,
  - date début,
  - durée,
  - informations société si elles sont manquantes ou à corriger.
- Le backend fusionne automatiquement les données envoyées avec le profil existant.
- Si le profil est incomplet, le client reçoit un message clair et un lien vers `Mon Profil`.

Fichiers modifiés :

- `frontend/src/pages/client/ContractRequestPage.jsx`
- `backend/app/schemas/schemas.py`
- `backend/app/routes/contracts.py`

## 2. Espace directeur : listing contrats refait

Avant, les contrats étaient affichés en sections/cards difficiles à lire.

Maintenant :

- Listing en tableau comme les pages Clients/Factures.
- Recherche par numéro contrat, client, société, CIN, type.
- Filtres par statut : tous, en attente, approuvé, actif, rejeté, expiré, résilié.
- Actions directes : détails, approuver, refuser, modifier, PDF, Word.
- Modal de détail complet.
- Modal de modification complet.

Fichier modifié :

- `frontend/src/pages/director/ContractsPage.jsx`

## 3. Test

Le build frontend n'a pas été lancé dans cet environnement car `vite` n'est pas installé dans `node_modules` du ZIP.

Lance :

```bash
cd frontend
npm install
npm run build
```

Ou avec Docker :

```bash
docker compose down
docker compose up --build
```
