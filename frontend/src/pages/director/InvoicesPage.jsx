import { useState, useEffect } from 'react';
import { invoicesAPI, clientsAPI, contractsAPI } from '../../services/api';
import { Plus, Receipt, Download, CheckCircle, Mail } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_MAP = { pending: 'En attente', paid: 'Payé', overdue: 'En retard', cancelled: 'Annulé' };

export default function DirectorInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const [form, setForm] = useState({ client_id: '', contract_id: '', service_start_date: new Date().toISOString().slice(0, 16), duration_months: 1, due_date: '', tax_rate: 20, notes: '', items: [{ description: '', quantity: 1, unit_price: 0 }] });

  const load = () => {
    setLoading(true);
    Promise.all([invoicesAPI.list(), clientsAPI.list(), contractsAPI.list()])
      .then(([i, c, ct]) => { setInvoices(i.data); setClients(c.data); setContracts(ct.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setCreating(true);
    try {
      const payload = {
        ...form,
        tax_rate: parseFloat(form.tax_rate),
        items: form.items.map(i => ({ ...i, quantity: parseFloat(i.quantity), unit_price: parseFloat(i.unit_price) }))
      };
      if (!payload.contract_id) delete payload.contract_id;
      await invoicesAPI.create(payload);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur création');
    } finally { setCreating(false); }
  };

  const handleMarkPaid = async (id) => {
    await invoicesAPI.update(id, { status: 'paid' });
    load();
  };

  const extractErrorMessage = async (err) => {
    const data = err?.response?.data;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const json = JSON.parse(text);
        return json.detail || text;
      } catch {
        return 'Erreur de téléchargement';
      }
    }
    return data?.detail || err?.message || 'Erreur de téléchargement';
  };

  const downloadBlob = async (request, filename, mime = 'application/octet-stream') => {
    setActionError('');
    try {
      const response = await request();
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = await extractErrorMessage(err);
      setActionError(message);
      throw err;
    }
  };

  const handleDownloadInvoice = async (inv) => {
    setActionLoading(`pdf-${inv.id}`);
    try {
      await downloadBlob(() => invoicesAPI.downloadPdf(inv.id), `${inv.invoice_number}.pdf`, 'application/pdf');
    } finally {
      setActionLoading('');
    }
  };

  const handleSendEmail = async (inv) => {
    setActionLoading(`email-${inv.id}`);
    setActionError('');
    try {
      await invoicesAPI.sendEmail(inv.id);
      alert('Email envoyé avec succès');
    } catch (err) {
      const message = await extractErrorMessage(err);
      setActionError(message);
      alert(message);
    } finally {
      setActionLoading('');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await downloadBlob(() => invoicesAPI.exportExcel(), 'factures.xlsx'); }
    catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  const handleAccountingCanvas = async () => {
    setExporting(true);
    try { await downloadBlob(() => invoicesAPI.exportAccountingCanvas(), 'canva-comptabilite-vente-client.xlsx'); }
    catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  const handleSageTxt = async () => {
    setExporting(true);
    try { await downloadBlob(() => invoicesAPI.exportSageTxt(), 'SAGE_VENTES_COMPATIBLE.txt'); }
    catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  const handleSageRichTxt = async () => {
    setExporting(true);
    try { await downloadBlob(() => invoicesAPI.exportSageRichTxt(), 'SAGE_VENTES_RICH_ARCHIVE.txt'); }
    catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit_price: 0 }] });
  const updateItem = (i, k, v) => { const items = [...form.items]; items[i] = {...items[i], [k]: v}; setForm({...form, items}); };
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const clientName = (id) => { const c = clients.find(cl => cl.id === id); return c?.profile ? `${c.profile.first_name} ${c.profile.last_name}` : c?.email || id; };

  const subtotal = form.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);
  const tax = subtotal * (parseFloat(form.tax_rate) / 100);
  const total = subtotal + tax;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Factures</h1>
          <p className="page-subtitle">{invoices.length} facture(s)</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Export...' : 'Excel'}
          </button>
          <button className="btn btn-secondary" onClick={handleAccountingCanvas} disabled={exporting}>
            <Download size={16} /> Canva comptabilité
          </button>
          <button className="btn btn-secondary" onClick={handleSageTxt} disabled={exporting}>
            <Download size={16} /> TXT Sage compatible
          </button>
          <button className="btn btn-secondary" onClick={handleSageRichTxt} disabled={exporting}>
            <Download size={16} /> TXT Sage riche
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Nouvelle Facture
          </button>
        </div>
      </div>

      {actionError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{actionError}</div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : invoices.length === 0 ? (
        <div className="empty-state"><Receipt size={48} /><h3>Aucune facture</h3></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>N° Facture</th><th>Client</th><th>Émission</th><th>Période</th><th>Échéance</th><th>Total</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td><code style={{ color: 'var(--accent)', fontSize: 12 }}>{inv.invoice_number}</code></td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{clientName(inv.client_id)}</td>
                  <td>{format(new Date(inv.issue_date), 'dd/MM/yyyy')}</td>
                  <td>{inv.service_start_date ? `${format(new Date(inv.service_start_date), 'dd/MM/yyyy')} → ${inv.service_end_date ? format(new Date(inv.service_end_date), 'dd/MM/yyyy') : '—'}` : '—'}</td>
                  <td>{format(new Date(inv.due_date), 'dd/MM/yyyy')}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>{inv.total.toLocaleString()} {inv.currency}</td>
                  <td><span className={`badge badge-${inv.status}`}>{STATUS_MAP[inv.status]}</span></td>
                  <td>
                    <button className="btn btn-secondary btn-sm" disabled={actionLoading === `pdf-${inv.id}`} onClick={() => handleDownloadInvoice(inv)}>
                      <Download size={14} /> {actionLoading === `pdf-${inv.id}` ? '...' : 'PDF'}
                    </button>
                    <button className="btn btn-secondary btn-sm" disabled={actionLoading === `email-${inv.id}`} onClick={() => handleSendEmail(inv)}>
                      <Mail size={14} /> {actionLoading === `email-${inv.id}` ? '...' : 'Email'}
                    </button>
                    {inv.status === 'pending' && (
                      <button className="btn btn-sm" style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)' }}
                        onClick={() => handleMarkPaid(inv.id)}>
                        <CheckCircle size={14} /> Marquer payé
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 className="modal-title">Nouvelle Facture</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Client *</label>
                  <select className="form-input" value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} required>
                    <option value="">Sélectionner...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.profile ? `${c.profile.first_name} ${c.profile.last_name}` : c.email}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date d'échéance *</label>
                  <input type="datetime-local" className="form-input" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} required />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Date début facturation</label>
                  <input type="datetime-local" className="form-input" value={form.service_start_date} onChange={e => setForm({...form, service_start_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Durée facture (mois)</label>
                  <input type="number" min="1" className="form-input" value={form.duration_months} onChange={e => setForm({...form, duration_months: e.target.value})} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">TVA (%)</label>
                  <input type="number" className="form-input" value={form.tax_rate} onChange={e => setForm({...form, tax_rate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
              </div>

              {/* Line items */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Lignes de facturation</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={14} /> Ajouter</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                    <input className="form-input" placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} required />
                    <input type="number" className="form-input" placeholder="Qté" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} min={0.01} step={0.01} required />
                    <input type="number" className="form-input" placeholder="Prix" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} min={0} required />
                    <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(i)} style={{ flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>

              {/* Totals preview */}
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 16px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sous-total</span><span>{subtotal.toFixed(2)} MAD</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}><span>TVA ({form.tax_rate}%)</span><span>{tax.toFixed(2)} MAD</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--success)', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 4 }}><span>Total</span><span>{total.toFixed(2)} MAD</span></div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowCreate(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={creating}>
                  {creating ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
