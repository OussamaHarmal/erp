import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { contractsAPI, renewalRequestsAPI } from '../../services/api';
import { CheckCircle, Download, Edit, FileText, Save, Search, X, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_MAP = { draft: 'Brouillon', pending: 'En attente', approved: 'Approuvé', active: 'Actif', rejected: 'Rejeté', expired: 'Expiré', terminated: 'Résilié' };
const PRICE_BY_DURATION = { 1: 67, 3: 195, 6: 390 };
const DAILY_RENEWAL_RATE = 67;

export default function DirectorContractsPage() {
  const [searchParams] = useSearchParams();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [renewalRequests, setRenewalRequests] = useState([]);

  const load = () => {
    setLoading(true);
    Promise.all([contractsAPI.list(), renewalRequestsAPI.directorList()])
      .then(([contractsResponse, renewalResponse]) => {
        setContracts(contractsResponse.data);
        setRenewalRequests(renewalResponse.data || []);
      })
      .catch(() => setError('Impossible de charger les contrats.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const contractId = searchParams.get('contractId');
    if (!contractId || contracts.length === 0) return;
    const target = contracts.find((contract) => contract.id === contractId);
    if (target) setSelected(target);
  }, [contracts, searchParams]);

  const profileOf = (c) => c.client?.profile || {};
  const fullName = (c) => {
    const p = profileOf(c);
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || c.client?.email || '—';
  };
  const companyName = (c) => profileOf(c).company_name || '—';

  const daysBetween = (a, b) => {
    if (!a || !b) return null;
    const d1 = new Date(a);
    const d2 = new Date(b);
    const ms = d2.getTime() - d1.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const today = () => new Date();
  const realConsumedDays = (contract) => {
    const end = contract?.end_date;
    if (!end) return 0;
    const diff = daysBetween(end, today());
    return Math.max(0, diff ?? 0);
  };
  const droitConsDays = (contract) => {
    const start = contract?.start_date;
    const end = contract?.end_date;
    const diff = daysBetween(start, end);
    return Math.max(0, diff ?? 0);
  };
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const realConsumedMonths = (contract) => round2(realConsumedDays(contract) / 30);
  const surplusDays = (contract) => round2(realConsumedDays(contract) - droitConsDays(contract));
  const surplusMonths = (contract) => round2(surplusDays(contract) / 30);
  const isEchue = (contract) => {
    if (!contract?.end_date) return 'Non échue';
    return new Date() >= new Date(contract.end_date) ? 'Échue' : 'Non échue';
  };
  const valeurHT = (contract) => {
    const base = Number(contract?.price || contract?.value || 0);
    if (base > 0) return base;
    return round2(realConsumedMonths(contract) * DAILY_RENEWAL_RATE);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter(c => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const text = `${c.contract_number} ${fullName(c)} ${companyName(c)} ${c.contract_type || ''} ${profileOf(c).cin_number || ''}`.toLowerCase();
      return matchesStatus && (!q || text.includes(q));
    });
  }, [contracts, statusFilter, search]);

  const counts = useMemo(() => {
    const base = { all: contracts.length };
    contracts.forEach(c => { base[c.status] = (base[c.status] || 0) + 1; });
    return base;
  }, [contracts]);

  const extractErrorMessage = async (err) => {
    const data = err?.response?.data;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const json = JSON.parse(text);
        return json.detail || text;
      } catch { return 'Erreur de téléchargement'; }
    }
    return data?.detail || err?.message || 'Erreur action contrat';
  };

  const downloadBlob = async (request, filename) => {
    const response = await request();
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownload = async (c, type) => {
    setActionLoading(`${type}-${c.id}`);
    setError('');
    try {
      if (type === 'pdf') await downloadBlob(() => contractsAPI.downloadPdf(c.id), `${c.contract_number}.pdf`);
      else await downloadBlob(() => contractsAPI.downloadWord(c.id), `${c.contract_number}.docx`);
    } catch (err) {
      setError(await extractErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const approve = async (c) => {
    setActionLoading(`approve-${c.id}`);

    try {
      await contractsAPI.approve(c.id);

      setContracts(prev =>
        prev.map(contract =>
          contract.id === c.id
            ? {
                ...contract,
                status: 'approved'
              }
            : contract
        )
      );

      if (selected?.id === c.id) {
        setSelected({
          ...selected,
          status: 'approved'
        });
      }

    } catch (err) {
      setError(await extractErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async (contractId) => {
    const reason = window.prompt("Motif du refus ?");
    if (!reason) return;

    setActionLoading(`reject-${contractId}`);

    try {
      await contractsAPI.reject(contractId, reason);

      setContracts(prev =>
        prev.map(contract =>
          contract.id === contractId
            ? { ...contract, status: "rejected" }
            : contract
        )
      );

      if (selected?.id === contractId) {
        setSelected({ ...selected, status: "rejected" });
      }

    } catch (err) {
      const msg = await extractErrorMessage(err);
      setError(msg);
      alert(msg);
    } finally {
      setActionLoading("");
    }
  };

  const startEdit = (c) => {
    const p = profileOf(c);
    setEditing(c.id);
    setSelected(c);
    setError('');
    setEditForm({
      title: c.title || 'Contrat de domiciliation',
      contract_type: c.contract_type || 'Domiciliation Juridique',
      duration_months: c.duration_months || 1,
      price: c.price || c.value || 0,
      status: c.status || 'pending',
      terms: c.terms || '',
      notes: c.notes || '',
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      cin_number: p.cin_number || '',
      birth_date: p.birth_date ? p.birth_date.slice(0, 10) : '',
      phone: p.phone || '',
      address: p.address || '',
      city: p.city || '',
      company_name: p.company_name || '',
      company_ice: p.company_ice || '',
      company_rc: p.company_rc || '',
      company_address: p.company_address || '',
      company_activity: p.company_activity || '',
      company_email: p.company_email || '',
      company_phone: p.company_phone || '',
    });
  };

  const updateEdit = (field, value) => {
    const next = { ...editForm, [field]: value };
    if (field === 'duration_months') {
      next.duration_months = Number(value);
      next.price = PRICE_BY_DURATION[Number(value)] || next.price;
    }
    setEditForm(next);
  };

  const saveEdit = async () => {
    if (!selected) return;

    setActionLoading(`save-${selected.id}`);

    try {
      const payload = {
        ...editForm,
        duration_months: Number(editForm.duration_months),
        price: Number(editForm.price),
        value: Number(editForm.price),
      };

      await contractsAPI.update(selected.id, payload);

      const updatedContract = {
        ...selected,
        ...payload,
      };

      setContracts(prev =>
        prev.map(contract =>
          contract.id === selected.id
            ? updatedContract
            : contract
        )
      );

      setSelected(updatedContract);
      setEditing(null);

    } catch (err) {
      setError(await extractErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const sendRenewalInvitation = async (contract) => {
    setActionLoading(`renewal-invite-${contract.id}`);
    setError('');
    try {
      await contractsAPI.sendRenewalInvitation(contract.id);
      load();
    } catch (err) {
      setError(await extractErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const decideRenewal = async (requestId, status) => {
    setActionLoading(`renewal-${requestId}`);
    try {
      await renewalRequestsAPI.decide(requestId, { status });
      load();
    } catch (err) {
      setError(await extractErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contrats</h1>
          <p className="page-subtitle">Listing directeur clair comme les clients/factures : recherche, filtre, actions et détail.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{String(error)}</div>}

      {renewalRequests.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Demandes de renouvellement</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {renewalRequests.map((request) => (
              <div key={request.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{request.contract?.contract_number || request.contract_id}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{request.client?.email} - {request.message || 'Sans message'}</div>
                </div>
                {request.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" disabled={actionLoading === `renewal-${request.id}`} onClick={() => decideRenewal(request.id, 'approved')}>
                      Accepter
                    </button>
                    <button className="btn btn-danger btn-sm" disabled={actionLoading === `renewal-${request.id}`} onClick={() => decideRenewal(request.id, 'rejected')}>
                      Refuser
                    </button>
                  </div>
                ) : (
                  <span className={`badge badge-${request.status}`}>{request.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={styles.toolbar}>
        <div style={styles.searchBox}>
          <Search size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher contrat, client, société, CIN..." />
        </div>
        <div style={styles.tabs}>
          {['all', 'pending', 'approved', 'active', 'rejected', 'expired', 'terminated'].map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'Tous' : STATUS_MAP[s]} ({counts[s] || 0})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><FileText size={48} /><h3>Aucun contrat trouvé</h3></div>
      ) : (
        <div className="table-wrapper contracts-table-wrapper">
          <table className="contracts-table">
            <thead>
              <tr>
                <th>REF</th>
                <th>NOM SOCIÉTÉ</th>
                <th>DATE CRÉATION</th>
                <th>DATE DÉBUT</th>
                <th>DATE FIN</th>
                <th>STATUT</th>
                <th>DROIT CONS. (j)</th>
                <th>RÉEL/J</th>
                <th>RÉEL/MOIS</th>
                <th>VALEUR (HT)</th>
                <th>SURPLUS/J</th>
                <th>SURPLUS/MOIS</th>
                <th>ECHUES</th>
                <th>INTERLOCUTEUR</th>
                <th>REMARQUE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td><code style={{ color: 'var(--accent)', fontSize: 12 }}>{c.contract_number}</code></td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{companyName(c)}</td>
                  <td>{safeDate(c.created_at)}</td>
                  <td>{safeDate(c.start_date)}</td>
                  <td>{safeDate(c.end_date)}</td>
                  <td><span className={`badge badge-${c.status}`}>{STATUS_MAP[c.status] || c.status}</span></td>
                  <td>{droitConsDays(c)}</td>
                  <td>{realConsumedDays(c)}</td>
                  <td>{realConsumedMonths(c)}</td>
                  <td style={{ fontWeight: 800, color: 'var(--success)' }}>{valeurHT(c).toLocaleString()} {c.currency}</td>
                  <td>{surplusDays(c)}</td>
                  <td>{surplusMonths(c)}</td>
                  <td>{isEchue(c)}</td>
                  <td>{fullName(c)}</td>
                  <td style={{ maxWidth: 260, whiteSpace: 'normal' }}>{c.description || c.notes || '—'}</td>
                  <td>
                    <div style={styles.actions}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelected(c)}
                      >
                        Détails
                      </button>

                      {c.status === 'expired' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={actionLoading === `renewal-invite-${c.id}`}
                          onClick={() => sendRenewalInvitation(c)}
                        >
                          Envoyer au client pour renouveler
                        </button>
                      )}

                      {c.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={actionLoading === `approve-${c.id}`}
                            onClick={() => approve(c)}
                          >
                            <CheckCircle size={14} /> Approuver
                          </button>

                          <button
                            className="btn btn-danger btn-sm"
                            disabled={actionLoading === `reject-${c.id}`}
                            onClick={() => handleReject(c.id)}
                          >
                            <XCircle size={14} /> Refuser
                          </button>
                        </>
                      )}

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEdit(c)}
                      >
                        <Edit size={14} /> Modifier
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={actionLoading === `pdf-${c.id}`}
                        onClick={() => handleDownload(c, 'pdf')}
                      >
                        <Download size={14} /> PDF
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={actionLoading === `word-${c.id}`}
                        onClick={() => handleDownload(c, 'word')}
                      >
                        <Download size={14} /> Word
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ maxWidth: 920 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Modifier contrat' : 'Détail contrat'} — {selected.contract_number}</h2>
              <button className="btn btn-secondary btn-sm" onClick={closeModal}><X size={14} /></button>
            </div>
            {editing === selected.id ? <EditModal /> : <DetailModal c={selected} />}
          </div>
        </div>
      )}
    </div>
  );

  function closeModal() { setSelected(null); setEditing(null); }

  function DetailModal({ c }) {
    const p = profileOf(c);
    return <div>
      <div style={styles.detailGrid}>
        <Info label="Client" value={fullName(c)} />
        <Info label="Email" value={c.client?.email} />
        <Info label="CIN / téléphone" value={`${p.cin_number || '—'} · ${p.phone || '—'}`} />
        <Info label="Adresse" value={`${p.address || '—'} ${p.city || ''}`} />
        <Info label="Société" value={p.company_name} />
        <Info label="ICE / RC" value={`${p.company_ice || '—'} / ${p.company_rc || '—'}`} />
        <Info label="Activité" value={p.company_activity} />
        <Info label="Email société" value={p.company_email} />
        <Info label="Type / durée" value={`${c.contract_type || '—'} / ${c.duration_months || '—'} mois`} />
        <Info label="Période" value={`${safeDate(c.start_date)} → ${safeDate(c.end_date)}`} />
        <Info label="Prix" value={`${(c.price || c.value || 0).toLocaleString()} ${c.currency}`} />
        <Info label="Statut" value={STATUS_MAP[c.status] || c.status} />
      </div>
      <div style={styles.modalActions}>
        <button className="btn btn-secondary" onClick={() => startEdit(c)}><Edit size={14} /> Modifier</button>
        {c.status === 'expired'
          ? <button className="btn btn-secondary" onClick={() => sendRenewalInvitation(c)}>Envoyer au client pour renouveler</button>
          : !['approved', 'active'].includes(c.status) && <button className="btn btn-primary" onClick={() => approve(c)}><CheckCircle size={14} /> Approuver</button>}
        <button className="btn btn-secondary" onClick={() => handleDownload(c, 'pdf')}><Download size={14} /> PDF</button>
        <button className="btn btn-secondary" onClick={() => handleDownload(c, 'word')}><Download size={14} /> Word</button>
      </div>
    </div>;
  }

  function EditModal() {
    return <div>
      <Block title="Contrat">
        <Input label="Titre" value={editForm.title} onChange={v => updateEdit('title', v)} />
        <Select label="Type" value={editForm.contract_type} onChange={v => updateEdit('contract_type', v)} options={['Domiciliation Juridique', 'Centre d’Affaires', 'Conseil Juridique – Fiscal et Comptable']} />
        <Select label="Durée" value={editForm.duration_months} onChange={v => updateEdit('duration_months', v)} options={[1, 3, 6]} labels={{ 1: '1 mois', 3: '3 mois', 6: '6 mois' }} />
        <Input label="Prix" type="number" value={editForm.price} onChange={v => updateEdit('price', v)} />
        <Select label="Statut" value={editForm.status} onChange={v => updateEdit('status', v)} options={['draft', 'pending', 'approved', 'active', 'rejected', 'expired', 'terminated']} labels={STATUS_MAP} />
      </Block>
      <Block title="Représentant client">
        <Input label="Prénom" value={editForm.first_name} onChange={v => updateEdit('first_name', v)} />
        <Input label="Nom" value={editForm.last_name} onChange={v => updateEdit('last_name', v)} />
        <Input label="CIN" value={editForm.cin_number} onChange={v => updateEdit('cin_number', v)} />
        <Input label="Date naissance" type="date" value={editForm.birth_date} onChange={v => updateEdit('birth_date', v)} />
        <Input label="Téléphone" value={editForm.phone} onChange={v => updateEdit('phone', v)} />
        <Input label="Adresse" value={editForm.address} onChange={v => updateEdit('address', v)} />
        <Input label="Ville" value={editForm.city} onChange={v => updateEdit('city', v)} />
      </Block>
      <Block title="Société domiciliée">
        <Input label="Nom société" value={editForm.company_name} onChange={v => updateEdit('company_name', v)} />
        <Input label="ICE" value={editForm.company_ice} onChange={v => updateEdit('company_ice', v)} />
        <Input label="RC" value={editForm.company_rc} onChange={v => updateEdit('company_rc', v)} />
        <Input label="Activité" value={editForm.company_activity} onChange={v => updateEdit('company_activity', v)} />
        <Input label="Email société" type="email" value={editForm.company_email} onChange={v => updateEdit('company_email', v)} />
        <Input label="Téléphone société" value={editForm.company_phone} onChange={v => updateEdit('company_phone', v)} />
        <Input label="Adresse société" value={editForm.company_address} onChange={v => updateEdit('company_address', v)} wide />
      </Block>
      <div style={styles.modalActions}>
        <button className="btn btn-primary" disabled={actionLoading === `save-${selected?.id}`} onClick={saveEdit}><Save size={14} /> Enregistrer</button>
        <button className="btn btn-secondary" onClick={closeModal}><X size={14} /> Annuler</button>
      </div>
    </div>;
  }
}

function safeDate(value) {
  if (!value) return '—';
  try { return format(new Date(value), 'dd/MM/yyyy'); } catch { return '—'; }
}
function Info({ label, value }) { return <div><div style={styles.infoLabel}>{label}</div><div style={styles.infoValue}>{value || '—'}</div></div>; }
function Block({ title, children }) { return <div style={{ marginBottom: 18 }}><h4 style={styles.blockTitle}>{title}</h4><div style={styles.editGrid}>{children}</div></div>; }
function Input({ label, value, onChange, type = 'text', wide = false }) { return <div className="form-group" style={wide ? { gridColumn: '1 / -1' } : undefined}><label className="form-label">{label}</label><input className="form-input" type={type} value={value || ''} onChange={e => onChange(e.target.value)} /></div>; }
function Select({ label, value, onChange, options, labels = {} }) { return <div className="form-group"><label className="form-label">{label}</label><select className="form-input" value={value || ''} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o} value={o}>{labels[o] || o}</option>)}</select></div>; }

const styles = {
  toolbar: { padding: 16, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 14 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: '1px solid var(--border)', borderRadius: 18, background: 'linear-gradient(180deg, var(--bg-card), var(--bg-elevated))', boxShadow: 'var(--shadow-sm)' },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 },
  infoLabel: { color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 },
  infoValue: { color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 20 },
  blockTitle: { color: 'var(--text-primary)', margin: '0 0 10px', borderBottom: '1px solid var(--border)', paddingBottom: 8 },
  editGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 },
};
