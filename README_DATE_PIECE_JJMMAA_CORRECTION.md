# Correction Sage — Date de pièce JJMMAA

Correction appliquée dans cette version :

- La première colonne Sage n'est plus seulement le jour `JJ`.
- Elle devient maintenant **Date pièce** complète au format **JJMMAA**.
- Exemple correct : `200426` pour le 20/04/2026.

## Format exporté

```txt
Date pièce;N° pièce;N° facture;Référence;N° compte général;N° compte tiers;Libellé écriture;Date échéance;P;Débit;Crédit
```

## Exemple corrigé

```txt
200426;26001;FAC-DEMO-2026-001;CTR-DEMO-2026-001;34210000;B01;DOM FACDEMO2026001 ATLAS DIGITAL SERVICES;200426;;42000,00;
200426;26001;FAC-DEMO-2026-001;CTR-DEMO-2026-001;71243000;;DOM FACDEMO2026001 ATLAS DIGITAL SERVICES;;;;35000,00
200426;26001;FAC-DEMO-2026-001;CTR-DEMO-2026-001;44550000;;TVA 20 DOM FACDEMO2026001 ATLAS DIGITAL SERVICES;;;;7000,00
```

## Fichiers modifiés

- `backend/app/services/sage_export.py`
- `backend/app/routes/erp.py`

L'export TXT/MAE et l'export Excel utilisent maintenant le même format correct.
