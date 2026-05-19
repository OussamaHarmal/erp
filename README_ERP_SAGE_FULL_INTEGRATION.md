# ERP Sage 100 i7 — Intégration finale

Cette version ajoute une section **ERP Sage** côté Directeur.

## Route frontend

- `/director/erp-sage`

## Endpoints backend

- `GET /api/v1/erp/sage/mapping` : affiche le mapping Sage exact.
- `GET /api/v1/erp/sage/preview` : aperçu des lignes générées + validation.
- `GET /api/v1/erp/sage/export/txt` : export TXT compatible Sage 100 i7.
- `GET /api/v1/erp/sage/export/zip` : export ZIP par période.
- `GET /api/v1/erp/sage/invoices/{invoice_id}/txt` : export Sage d'une facture.

## Mapping Sage obligatoire

Dans Sage : `Fichier > Format import/export paramétrable`.

Configurer le fichier `.MAE` avec :

1. Code journal
2. Date de pièce
3. N° pièce
4. N° compte général
5. N° compte tiers
6. Libellé écriture
7. Date d'échéance
8. Montant débit
9. Montant crédit

## Particularités Sage

- Type de fichier : Délimité
- Origine : Windows
- Délimiteur d'enregistrement : Retour chariot / CRLF
- Délimiteur champ : Point-virgule `;`
- Entête du fichier : Aucun
- Date : JJMMAA
- Montant : 2 décimales, séparateur décimal virgule, séparateur milliers aucun

## Format généré

Sans header :

```txt
VTE;290426;F00126;34210000;B01;DOM F00126 BRAHIM 12MOIS;010126;960,00;0,00
VTE;290426;F00126;71243000;;DOM F00126 BRAHIM 12MOIS;;0,00;800,00
VTE;290426;F00126;44550000;;TVA 20 DOM F00126 BRAHIM 12MOIS;;0,00;160,00
```

## Variables `.env`

```env
SAGE_JOURNAL_CODE=VTE
SAGE_CLIENT_ACCOUNT=34210000
SAGE_SALES_ACCOUNT=71243000
SAGE_VAT_ACCOUNT=44550000
SAGE_DEFAULT_TIERS_CODE=B01
```

## Important

Le fichier TXT généré est encodé en **Windows-1252 / ANSI** avec retours ligne **CRLF**, pour éviter les erreurs invisibles dans Sage.
