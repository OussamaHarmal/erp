# Assistant IA ERP - Client + Admin

Cette version ajoute un chatbot IA dans les deux espaces :

- **Espace client** : répond uniquement sur les données du client connecté : contrats, factures, documents, paiements.
- **Espace admin/directeur** : répond sur les données globales ERP : CA, clients, factures, Sage, top clients, exports.

## Fonctionnement

Le backend expose :

```txt
POST /api/v1/chatbot/ask
```

Le chatbot utilise une API externe compatible OpenAI si `OPENAI_API_KEY` est configurée. Sinon, il utilise automatiquement un fallback local simple pour éviter que l'interface tombe en panne.

## Configuration API externe

Dans `backend/.env` :

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
AI_CHATBOT_ENABLED=true
```

Tu peux aussi utiliser un autre fournisseur compatible OpenAI en changeant `OPENAI_BASE_URL` et `OPENAI_MODEL`.

## Sécurité

- Le client ne reçoit que ses propres données.
- L'admin reçoit les données globales.
- Les questions sont enregistrées dans `audit_logs` avec seulement un aperçu de la question.
- La clé API reste côté backend, jamais dans React.

## Fichiers ajoutés/modifiés

```txt
backend/app/routes/chatbot.py
backend/app/main.py
backend/app/config.py
backend/.env.example
frontend/src/components/layout/ChatbotWidget.jsx
frontend/src/components/layout/DashboardLayout.jsx
frontend/src/services/api.js
frontend/src/index.css
```
