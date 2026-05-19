# Smart CMS — Final Pro Upgrade

## Nouveautés ajoutées

- Contrat PDF/Word avec logo Universal Invest Strategy et structure de domiciliation basée sur le modèle fourni.
- Facture PDF avec logo Universal Invest Strategy, style facture fournie, bloc destinataire, tableau désignation/quantité/prix/total, HT/TVA/TTC et footer légal.
- Renouvellement de contrat : uniquement le client peut demander le renouvellement depuis son espace. Le prix est 165 DH/mois. La demande arrive en statut `pending` et le directeur doit l'approuver.
- Espace directeur > Contrats : sections “Contrats approuvés” et “Contrats non approuvés”, validation/refus, modification des infos client et société, export PDF/Word.
- Espace directeur > Clients : bouton “Voir plus” pour voir le profil, l'entreprise, les contrats, les factures et les documents importés par le client.
- Documents importés : le client voit ses documents, le directeur peut voir tous les documents et les télécharger via “Voir plus” client.
- Mode clair/sombre conservé avec localStorage.

## Règles métier importantes

- Le directeur ne crée plus directement de renouvellement depuis l'interface admin.
- Le client demande le renouvellement d'un contrat approuvé/actif/expiré.
- Une demande de renouvellement reste non approuvée jusqu'à validation par le directeur.
- Les documents importés restent protégés par RBAC : client = uniquement les siens, directeur = tous.
