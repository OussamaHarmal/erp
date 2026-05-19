# Mise à jour Sage .MAE + Dashboard

Changements appliqués :

## Dashboard
- Suppression du bouton `Actualiser` dans le dashboard directeur.
- Le dashboard charge les données automatiquement à l’ouverture.
- Aucune alerte automatique affichée dans le dashboard.

## ERP Sage
- Suppression du bouton `Actualiser` dans la page ERP Sage.
- Le bouton `Appliquer` reste pour recharger après changement de filtres.
- Export Excel modifié pour ressembler au canvas comptabilité Sage.

## Nouveau format Sage .MAE / TXT
Le fichier TXT Sage utilise maintenant l’ordre suivant :

```txt
Jour;N° pièce;N° facture;Référence;N° compte général;N° compte tiers;Libellé écriture;Date échéance;P;Débit;Crédit
```

Exemple :

```txt
29;2;F00126;REF001;34210000;B01;DOM F00126 BRAHIM 12MOIS;010126;;960,00;
29;2;F00126;REF001;71243000;;DOM F00126 BRAHIM 12MOIS;;;;800,00
29;2;F00126;REF001;44550000;;TVA 20 DOM F00126 BRAHIM 12MOIS;;;;160,00
```

## Export Excel
Le fichier Excel contient :
- Feuille `Canvas Comptabilite` : mêmes colonnes que Sage.
- Feuille `Controle` : résumé facture/client/montants.
- Feuille `Erreurs` : erreurs de validation Sage.

Important : dans Sage, modifier le modèle `.MAE` pour respecter exactement cet ordre de colonnes.
