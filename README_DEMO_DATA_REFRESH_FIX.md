# Fix bouton Actualiser + données de test

## Ce qui a été corrigé

- Bouton **Actualiser** du dashboard directeur :
  - feedback visuel pendant le chargement ;
  - message d’erreur visible si l’API échoue ;
  - heure de la dernière actualisation ;
  - bouton désactivé pendant le refresh pour éviter les doubles appels.

- Bouton **Actualiser** de la page ERP Sage :
  - désactivé pendant chargement/export ;
  - icône animée pendant l’actualisation.

## Données de test ajoutées automatiquement

Au démarrage backend, le projet ajoute quelques données de démonstration si `SEED_DEMO_DATA=true` ou si la variable n’existe pas.

Comptes clients de test :

- `demo.atlas@example.com` / `Client@2024!`
- `demo.nova@example.com` / `Client@2024!`
- `demo.medina@example.com` / `Client@2024!`
- `demo.sahara@example.com` / `Client@2024!`

Ces clients ont des profils, contrats, factures payées/impayées/en retard, documents et données Sage.

## Désactiver le seed en production

Dans `backend/.env` :

```env
SEED_DEMO_DATA=false
```
