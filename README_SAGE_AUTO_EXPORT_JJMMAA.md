# Sage 100 i7 — Export TXT JJMMAA + préparation dossier

Cette version génère le fichier Sage au format qui a fonctionné dans ton dossier Sage :

```txt
Code journal;Date de pièce;N° pièce;N° compte général;N° compte tiers;Libellé écriture;Date échéance;Montant débit;Montant crédit
```

Important : le fichier généré **ne contient pas de header**.

Exemple réel généré :

```txt
VTE;290426;F00126;34210000;B01;DOM F00126 BRAHIM 12MOIS;010126;960,00;0,00
VTE;290426;F00126;71243000;;DOM F00126 BRAHIM 12MOIS;;0,00;800,00
VTE;290426;F00126;44550000;;TVA 20 DOM F00126 BRAHIM 12MOIS;;0,00;160,00
```

## Format exact

- Date : `JJMMAA`, exemple `290426`
- Décimales : virgule, exemple `960,00`
- Séparateur : point-virgule `;`
- Encodage : Windows ANSI / `cp1252`
- Fin de ligne : CRLF
- 3 lignes par facture : client débit TTC, vente crédit HT, TVA crédit TVA.

## Nouveau bouton

Page directeur : `/director/erp-sage`

Boutons :

- `Exporter TXT Sage` : télécharge le fichier.
- `Exporter ZIP par période` : prépare un ZIP par mois.
- `Préparer dans dossier Sage` : écrit automatiquement le TXT dans un dossier configuré.

## Configuration dossier

Dans `backend/.env` :

```env
SAGE_EXPORT_DROP_DIR=C:\\SAGE_IMPORT\\VENTES
SAGE_JOURNAL_CODE=VTE
SAGE_CLIENT_ACCOUNT=34210000
SAGE_SALES_ACCOUNT=71243000
SAGE_VAT_ACCOUNT=44550000
SAGE_DEFAULT_TIERS_CODE=B01
```

Si le backend tourne dans Docker, monte un volume vers le dossier Windows :

```yaml
volumes:
  - ./exports/sage:/app/exports/sage
```

Puis garde :

```env
SAGE_EXPORT_DROP_DIR=/app/exports/sage
```

## À propos de l'automatisation Sage

Le backend peut générer et déposer le fichier automatiquement. Par contre, Sage 100 i7 desktop n’importe pas automatiquement un fichier juste parce qu’il existe dans un dossier.

Pour un import 100% automatique dans Sage, il faut l’une de ces solutions :

1. Connecteur officiel Sage / API Sage.
2. ODBC/SQL Sage avec validation comptable stricte.
3. Robot Windows/RPA sur le poste Sage qui ouvre Sage et lance l’import paramétrable.

La méthode la plus stable pour ton projet : générer automatiquement le TXT dans un dossier, puis importer avec ton modèle `.MAE` paramétrable.
