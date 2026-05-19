# Smart CMS - Advanced approval, renewal and invoice exports

## New contract workflow

Director page now contains two sections:
- Contrats non approuvés: pending, draft, rejected, expired, terminated.
- Contrats approuvés: approved, active.

Director actions:
- Approuver: `PATCH /api/v1/contracts/{contract_id}/approve`
- Refuser: `PATCH /api/v1/contracts/{contract_id}/reject`
- Modifier: `PUT /api/v1/contracts/{contract_id}`
- Renouveler: `POST /api/v1/contracts/{contract_id}/renew`
- Export PDF/Word: existing download endpoints.

Client renewal:
- A client can request renewal of his own contract.
- Renewal price is fixed at 165 MAD/month.
- A client renewal creates a new pending contract request.
- A director renewal creates an approved renewal contract.

## Invoice template

Invoices now export to PDF using Universal Invest Strategy design:
- Same company identity and legal footer.
- Universal Invest Strategy logo from `backend/app/assets/ui_logo.jpeg`.
- Invoice structure based on the provided NEPTUNE invoice: header, destinataire, designation, quantity, price, total, TVA, TTC, amount sentence, legal footer.

Endpoint:
- `GET /api/v1/invoices/{invoice_id}/download/pdf`

## Accounting export

New export section for accounting preparation:
- `GET /api/v1/invoices/export/accounting-canvas`
- Exports `canva-comptabilite-vente-client.xlsx`
- Columns: Date, N° Facture, Client, ICE Client, Désignation, HT, TVA %, TVA, TTC, Statut, Mode.
