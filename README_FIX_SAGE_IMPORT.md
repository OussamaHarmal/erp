# Fix export Sage 100 Comptabilité i7

Le problème `Format de fichier incorrect !` venait du fichier TXT exporté avec :

- une ligne d'en-tête/header ;
- trop de colonnes pour un import Sage direct ;
- date au format `dd/mm/yyyy` ;
- montants avec point décimal ;
- encodage UTF-8 BOM.

## Nouveau bouton

Dans `Factures`, le bouton **TXT Sage compatible** télécharge maintenant :

```txt
SAGE_VENTES_COMPATIBLE.txt
```

Format généré :

```txt
VTE;20260428;FACT-2026-00001;3421;Client Bifo service;120,00;0,00
VTE;20260428;FACT-2026-00001;712;Domiciliation Juridique - 1 mois;0,00;100,00
VTE;20260428;FACT-2026-00001;4455;TVA 20% - Domiciliation Juridique - 1 mois;0,00;20,00
```

## Mapping Sage conseillé

Créer un format d'import paramétrable avec séparateur `;` et mapper :

| Colonne TXT | Champ Sage |
|---|---|
| 1 | Journal |
| 2 | Date |
| 3 | Pièce |
| 4 | Compte général |
| 5 | Libellé |
| 6 | Débit |
| 7 | Crédit |

## Notes importantes

- Le fichier compatible n'a pas d'en-tête.
- La date est en `YYYYMMDD`.
- Les montants utilisent la virgule : `120,00`.
- Encodage : Windows-1252 / ANSI.
- Le bouton **TXT Sage riche** reste disponible pour l'archivage interne, avec ICE, TVA, TTC et période, mais il n'est pas recommandé pour l'import Sage direct.
