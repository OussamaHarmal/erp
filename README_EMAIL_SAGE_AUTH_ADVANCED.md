# Universal Invest Strategy CMS — Auth logo + SMTP + Invoice period + Sage TXT

## Ce qui a été ajouté

- Logo Universal Invest Strategy appliqué dans :
  - `frontend/public/ui_logo.jpeg`
  - `backend/app/assets/ui_logo.jpeg`
  - pages Login/Register
- Nom affiché dans l'authentification : **Universal Invest Strategy**.
- SMTP : envoi automatique du contrat + facture après demande client.
- Boutons admin pour renvoyer une facture/contrat par email.
- Facture avec période facturée : date début + date fin calculée automatiquement selon la durée.
- Export Excel enrichi avec période facturée.
- Export TXT Sage : `GET /api/v1/invoices/export/sage-txt`.

## Migration PostgreSQL

```bash
psql -d smart_cms -f backend/migrations/003_invoice_period_auth_branding_email.sql
```

## Configuration SMTP recommandée

Pour un projet local/simple : Gmail App Password.
Pour production : SendGrid, Mailgun, Brevo ou Amazon SES.

Exemple `.env` :

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre.email@gmail.com
SMTP_PASSWORD=VOTRE_APP_PASSWORD_GMAIL
SMTP_FROM_EMAIL=votre.email@gmail.com
SMTP_FROM_NAME=Universal Invest Strategy
SMTP_USE_TLS=true
```

Important : avec Gmail, il faut créer un **App Password** depuis le compte Google. Le mot de passe normal ne fonctionne pas.

## Workflow email

Quand un client envoie une demande de contrat :
1. le profil client est créé/mis à jour ;
2. le contrat est créé ;
3. la facture est créée automatiquement ;
4. la date fin facture est calculée à partir de la date début + durée ;
5. PDF/Word contrat + PDF facture sont générés ;
6. email envoyé au client si SMTP est configuré.

