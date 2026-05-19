# Correction finale téléchargement facture + email

## Ce qui a été corrigé

### Backend
- Route admin/client stable : `GET /api/v1/invoices/{invoice_id}/download/pdf`
- Alias ajouté : `GET /api/v1/invoices/{invoice_id}/download`
- Génération PDF sécurisée même si une facture n'a pas de lignes.
- Nom de fichier PDF nettoyé automatiquement.
- Contrôle d'accès :
  - directeur : peut télécharger toutes les factures ;
  - client : peut télécharger seulement ses factures.
- Messages d'erreur backend plus clairs pour PDF et SMTP.
- `Content-Disposition` exposé correctement pour le téléchargement navigateur.

### Frontend admin
- Bouton PDF corrigé dans la page Factures.
- Erreur de téléchargement affichée clairement au lieu de rester silencieuse.
- Bouton Email corrigé avec état de chargement et message SMTP clair.

### Frontend client
- Ajout du bouton PDF dans `Mes Factures`.
- Le client peut télécharger ses factures depuis son espace.
- Gestion d'erreur si la facture n'appartient pas au client ou si le PDF échoue.

## Vérification rapide

1. Redémarrer backend + frontend.
2. Se connecter admin.
3. Aller dans Factures.
4. Cliquer PDF sur une facture.
5. Cliquer Email seulement si SMTP est configuré dans `backend/.env`.
6. Se connecter avec un compte client.
7. Aller dans Mes Factures puis cliquer PDF.

## SMTP requis pour l'envoi email

Dans `backend/.env` :

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre_email@gmail.com
SMTP_PASSWORD=votre_app_password
SMTP_FROM_EMAIL=votre_email@gmail.com
SMTP_FROM_NAME=Universal Invest Strategy
SMTP_USE_TLS=true
```

Pour Gmail, il faut utiliser un **mot de passe d'application**, pas le mot de passe normal.
