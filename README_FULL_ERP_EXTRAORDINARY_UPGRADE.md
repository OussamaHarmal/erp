# Full ERP Extraordinary Upgrade

Cette version ajoute une couche ERP plus professionnelle au projet : dashboard avancé, Sage export center moderne, historique d'export, audit logs, notifications, documents versionnés et champs prêts pour paiement complet.

## Changements backend

- `AuditLog` : trace les actions sensibles comme export Sage, génération d'alertes, etc.
- `Notification` : alertes contrats proches expiration, factures en retard, exports Sage.
- `SageExportBatch` : historique des exports Sage avec période, total, statut, erreurs.
- Factures : ajout de `exported_to_sage`, `sage_exported_at`, `sage_export_batch_id`, `payment_method`, `amount_paid`, `remaining_amount`.
- Contrats : ajout de `signed_at` et `renewal_parent_id` pour signature/renouvellement.
- Documents : ajout de `category`, `version`, `is_verified` pour GED professionnelle.
- Analytics enrichi : CA, impayés, contrats bientôt expirés, Sage pending, top clients, alertes.
- Sage : preview par période, export TXT par période, ZIP, dossier Sage, marquage automatique des factures exportées.

## Changements frontend

- Nouveau dashboard directeur “ERP Command Center”.
- Cartes KPI modernes avec style glassmorphism.
- Alertes intelligentes : factures en retard, Sage pending, contrats expirants.
- Top clients par chiffre d'affaires.
- Notifications récentes.
- Page Sage redesignée : filtres de période, preview, export, mapping .MAE, historique.
- Skeleton loaders et style moderne extraordinaire.

## Migration PostgreSQL

Exécuter :

```bash
psql "$DATABASE_URL" -f backend/migrations/004_full_erp_extra_modules.sql
```

Ou exécuter le fichier SQL depuis pgAdmin.

## Notes importantes

- Pour une base neuve, `Base.metadata.create_all()` créera les nouvelles tables.
- Pour une base existante, il faut appliquer la migration `004_full_erp_extra_modules.sql`.
- Après ajout de `node_modules`, lance :

```bash
cd frontend
npm install
npm run build
```

