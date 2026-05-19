# Correction finale export Sage MAE

Format validé dans Sage :

```txt
Code journal;Date pièce;N° pièce;N° facture;Référence;N° compte général;N° compte tiers;Libellé écriture;Date échéance;Débit;Crédit
```

Exemple fonctionnel :

```txt
VTE;210326;26001;FAC-DEMO-2026-001;CTR-DEMO-2026-001;34210000;B01;DOM FACDEMO2026001 ATLAS DIGITAL SERVICES;200426;42000,00;
VTE;210326;26001;FAC-DEMO-2026-001;CTR-DEMO-2026-001;71243000;;DOM FACDEMO2026001 ATLAS DIGITAL SERVICES;;;35000,00
VTE;210326;26001;FAC-DEMO-2026-001;CTR-DEMO-2026-001;44550000;;TVA 20 DOM FACDEMO2026001 ATLAS DIGITAL SERVICES;;;7000,00
```

Corrections appliquées :
- Code journal `VTE` en première colonne.
- Suppression de la colonne `P`.
- Date pièce et date échéance en `JJMMAA`.
- Lignes crédit avec exactement `;;;montant`.
- Débit TTC = Crédit HT + Crédit TVA.
- Export TXT, ZIP et Excel alignés sur le même format.
