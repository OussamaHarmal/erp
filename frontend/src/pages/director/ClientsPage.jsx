import { useState, useEffect } from 'react';
import { clientsAPI, contractsAPI, invoicesAPI, documentsAPI } from '../../services/api';
import { Plus, Search, Trash2, ToggleLeft, ToggleRight, User, Eye, FileText, Receipt, Download } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_MAP = {
  draft: 'Brouillon', pending: 'En attente', approved: 'Approuvé', active: 'Actif', rejected: 'Rejeté', expired: 'Expiré', terminated: 'Résilié',
};

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [clientDetails, setClientDetails] = useState({ contracts: [], invoices: [], documents: [] });
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '', phone: '', cin_number: ''
  });

  const load = () => {
    setLoading(true);
    clientsAPI.list({ search })
      .then(r => { setClients(Array.isArray(r.data) ? r.data : []); setError(''); })
      .catch(() => { setError('Impossible de charger la page clients. Vérifie le backend/API clients.'); setClients([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const openDetails = async (client) => {
    setSelected(client);
    setDetailsLoading(true);
    try {
      const [contracts, invoices, documents] = await Promise.all([
        contractsAPI.list(), invoicesAPI.list(), documentsAPI.list(),
      ]);
      setClientDetails({
        contracts: contracts.data.filter(x => x.client_id === client.id),
        invoices: invoices.data.filter(x => x.client_id === client.id),
        documents: documents.data.filter(x => x.owner_id === client.id),
      });
    } catch (e) {
      console.error(e);
      setClientDetails({ contracts: [], invoices: [], documents: [] });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setCreating(true);
    try {
      await clientsAPI.create(form);
      setShowCreate(false);
      setForm({ email: '', password: '', first_name: '', last_name: '', phone: '', cin_number: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur création');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce client ?')) return;
    await clientsAPI.delete(id);
    load();
  };

  const handleToggle = async (id) => {
    await clientsAPI.toggleStatus(id);
    load();
  };

  const downloadDoc = async (doc) => {
    const response = await documentsAPI.download(doc.id);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.original_filename || doc.name;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const fullName = (c) => c.profile ? `${c.profile.first_name} ${c.profile.last_name}` : '—';

  return (
    <div className="clients-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Gestion avancée : profil, société, contrats, factures et documents importés.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Nouveau Client
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="client-kpi-panel">
        <div className="client-kpi-grid">
          <Kpi label="Total clients" value={clients.length} />
          <Kpi label="Clients actifs" value={clients.filter(c => c.is_active).length} />
          <Kpi label="Sociétés renseignées" value={clients.filter(c => c.profile?.company_name).length} />
        </div>
      </div>

      <div className="client-search-card">
        <div className="client-search-box">
          <Search size={18} />
          <input placeholder="Rechercher par nom, email, CIN, société ou ville..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span>{clients.length} résultat(s)</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : clients.length === 0 ? (
        <div className="empty-state"><User size={48} /><h3>Aucun client trouvé</h3></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Nom</th><th>Email</th><th>Société</th><th>CIN</th><th>Téléphone</th><th>Ville</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fullName(c)}</td>
                  <td>{c.email}</td>
                  <td>{c.profile?.company_name || '—'}</td>
                  <td>{c.profile?.cin_number || '—'}</td>
                  <td>{c.profile?.phone || '—'}</td>
                  <td>{c.profile?.city || '—'}</td>
                  <td><span className={`badge badge-${c.is_active ? 'active' : 'terminated'}`}>{c.is_active ? 'Actif' : 'Inactif'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openDetails(c)} title="Voir plus"><Eye size={14} /> Voir plus</button>
                      <button className="btn btn-icon btn-secondary btn-sm" onClick={() => handleToggle(c.id)} title="Activer/Désactiver">{c.is_active ? <ToggleRight size={16} color="var(--success)" /> : <ToggleLeft size={16} />}</button>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => handleDelete(c.id)} title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 980 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Voir plus — {fullName(selected)}</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>{selected.email}</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>

            {detailsLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div> : (
              <div style={{ display: 'grid', gap: 18 }}>
                <Section title="Informations personnelles">
                  <Info label="Nom complet" value={fullName(selected)} />
                  <Info label="CIN" value={selected.profile?.cin_number || '—'} />
                  <Info label="Téléphone" value={selected.profile?.phone || '—'} />
                  <Info label="Adresse" value={`${selected.profile?.address || '—'} ${selected.profile?.city || ''}`} />
                </Section>

                <Section title="Entreprise du client">
                  <Info label="Société" value={selected.profile?.company_name || '—'} />
                  <Info label="ICE" value={selected.profile?.company_ice || '—'} />
                  <Info label="RC" value={selected.profile?.company_rc || '—'} />
                  <Info label="Activité" value={selected.profile?.company_activity || '—'} />
                  <Info label="Email société" value={selected.profile?.company_email || '—'} />
                  <Info label="Téléphone société" value={selected.profile?.company_phone || '—'} />
                  <Info label="Adresse société" value={selected.profile?.company_address || '—'} wide />
                </Section>

                <MiniList title="Contrats" icon={<FileText size={16} />} empty="Aucun contrat" items={clientDetails.contracts.map(c => ({
                  id: c.id,
                  title: `${c.contract_number} — ${c.title}`,
                  meta: `${STATUS_MAP[c.status] || c.status} · ${(c.price || c.value || 0).toLocaleString()} ${c.currency} · ${c.end_date ? 'Fin ' + format(new Date(c.end_date), 'dd/MM/yyyy') : ''}`,
                }))} />

                <MiniList title="Factures" icon={<Receipt size={16} />} empty="Aucune facture" items={clientDetails.invoices.map(i => ({
                  id: i.id,
                  title: `${i.invoice_number}`,
                  meta: `${i.status} · ${Number(i.total || 0).toLocaleString()} ${i.currency} · ${format(new Date(i.issue_date), 'dd/MM/yyyy')}`,
                }))} />

                <div className="card" style={{ padding: 14 }}>
                  <h3 style={styles.sectionTitle}>Documents importés par le client ({clientDetails.documents.length})</h3>
                  {clientDetails.documents.length === 0 ? <p style={styles.muted}>Aucun document importé.</p> : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {clientDetails.documents.map(d => (
                        <div key={d.id} style={styles.docRow}>
                          <div>
                            <b style={{ color: 'var(--text-primary)' }}>{d.name}</b>
                            <p style={styles.muted}>{d.original_filename} · {d.doc_type} · {format(new Date(d.uploaded_at), 'dd/MM/yyyy')}</p>
                          </div>
                          <button className="btn btn-secondary btn-sm" onClick={() => downloadDoc(d)}><Download size={14} /> Télécharger</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <div className="modal-header"><h2 className="modal-title">Nouveau Client</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>✕</button></div>
            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="grid-2"><Input label="Prénom *" value={form.first_name} onChange={v => setForm({...form, first_name: v})} required /><Input label="Nom *" value={form.last_name} onChange={v => setForm({...form, last_name: v})} required /></div>
              <Input label="Email *" type="email" value={form.email} onChange={v => setForm({...form, email: v})} required />
              <Input label="Mot de passe *" type="password" value={form.password} onChange={v => setForm({...form, password: v})} required />
              <div className="grid-2"><Input label="Téléphone" value={form.phone} onChange={v => setForm({...form, phone: v})} /><Input label="CIN" value={form.cin_number} onChange={v => setForm({...form, cin_number: v})} /></div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowCreate(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={creating}>{creating ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }) { return <div className="client-kpi-card"><span>{label}</span><strong>{value}</strong></div>; }
function Section({ title, children }) { return <div className="card" style={{ padding: 14 }}><h3 style={styles.sectionTitle}>{title}</h3><div style={styles.infoGrid}>{children}</div></div>; }
function Info({ label, value, wide }) { return <div style={wide ? { gridColumn: '1 / -1' } : undefined}><div style={styles.infoLabel}>{label}</div><div style={styles.infoValue}>{value}</div></div>; }
function MiniList({ title, icon, items, empty }) { return <div className="card" style={{ padding: 14 }}><h3 style={styles.sectionTitle}>{icon} {title} ({items.length})</h3>{items.length === 0 ? <p style={styles.muted}>{empty}</p> : <div style={{ display: 'grid', gap: 8 }}>{items.map(x => <div key={x.id} style={styles.docRow}><div><b style={{ color: 'var(--text-primary)' }}>{x.title}</b><p style={styles.muted}>{x.meta}</p></div></div>)}</div>}</div>; }
function Input({ label, value, onChange, type = 'text', required = false }) { return <div className="form-group"><label className="form-label">{label}</label><input className="form-input" type={type} value={value || ''} onChange={e => onChange(e.target.value)} required={required} /></div>; }
const styles = { sectionTitle: { color: 'var(--text-primary)', margin: '0 0 12px', fontSize: 16 }, infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }, infoLabel: { color: 'var(--text-muted)', fontSize: 12, marginBottom: 3 }, infoValue: { color: 'var(--text-primary)', fontSize: 14 }, muted: { margin: '3px 0 0', color: 'var(--text-muted)', fontSize: 12 }, docRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elevated)' } };
