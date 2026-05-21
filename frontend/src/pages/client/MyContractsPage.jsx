/**
 * MyContractsPage — Client view of their own contracts
 * Read-only: clients cannot create/delete contracts
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { contractsAPI, renewalRequestsAPI } from '../../services/api';
import { FileText, Calendar, DollarSign, Info, Download, RefreshCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_MAP = {
  draft: 'Brouillon',
  pending: 'En attente',
  approved: 'Approuvé',
  active: 'Actif',
  rejected: 'Rejeté',
  expired: 'Expiré',
  terminated: 'Résilié',
};

const STATUS_DESC = {
  draft: 'Ce contrat est en cours de préparation.',
  pending: 'Votre demande est envoyée et attend la validation du directeur.',
  approved: 'Votre demande a été approuvée par le directeur.',
  active: 'Ce contrat est en vigueur.',
  rejected: 'Cette demande a été rejetée.',
  expired: 'Ce contrat est arrivé à échéance.',
  terminated: 'Ce contrat a été résilié.',
};

export default function MyContractsPage() {
  const [searchParams] = useSearchParams();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [filter, setFilter]       = useState('all');
  const [renewMonths, setRenewMonths] = useState(1);
  const [message, setMessage] = useState('');

  useEffect(() => {
    contractsAPI.list()
      .then(r => setContracts(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const contractId = searchParams.get('contractId');
    if (!contractId || contracts.length === 0) return;
    const target = contracts.find((contract) => contract.id === contractId);
    if (target) setSelected(target);
  }, [contracts, searchParams]);

  const filtered = filter === 'all'
    ? contracts
    : contracts.filter(c => c.status === filter);

  const daysLeft = (contract) => {
    if (!contract?.end_date) return null;
    return Math.ceil((new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24));
  };
  const isExpiringSoon = (contract) => {
    const d = daysLeft(contract);
    return d !== null && d >= 0 && d <= 30 && ['approved', 'active'].includes(contract.status);
  };
  const expiringSoon = contracts.filter(isExpiringSoon);
  const canRenew = (contract) => ['approved', 'active', 'expired'].includes(contract.status);

  const downloadBlob = async (request, filename) => {
    const response = await request();
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleRenew = async (contractId) => {
    setMessage('');
    await renewalRequestsAPI.create(contractId, {
      message: `Demande de renouvellement ${renewMonths} mois.`,
    });
    const r = await contractsAPI.list();
    setContracts(r.data);
    setSelected(null);
    setMessage('Demande de renouvellement envoyee au directeur.');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes Contrats</h1>
          <p className="page-subtitle">{contracts.length} contrat(s) à votre nom</p>
        </div>
      </div>

      {message && (
        <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <CheckCircle size={16} /> {message}
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
            <AlertTriangle size={17} /> Contrat proche de l'expiration
          </div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            {expiringSoon[0].contract_number} expire dans {daysLeft(expiringSoon[0])} jour(s). Vous pouvez demander le renouvellement depuis le détail du contrat.
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={styles.tabs}>
        {['all', 'pending', 'approved', 'active', 'draft', 'rejected', 'expired', 'terminated'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...styles.tab,
              ...(filter === f ? styles.tabActive : {}),
            }}
          >
            {f === 'all' ? 'Tous' : STATUS_MAP[f]}
            <span style={styles.tabCount}>
              {f === 'all' ? contracts.length : contracts.filter(c => c.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>Aucun contrat trouvé</h3>
          <p style={{ fontSize: 14 }}>Contactez votre gestionnaire pour plus d'informations.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map(c => (
            <div
              key={c.id}
              className="card card-hover"
              style={styles.contractCard}
              onClick={() => setSelected(c)}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={styles.contractIcon}>
                  <FileText size={18} color="var(--primary-light)" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <span className={`badge badge-${c.status}`}>{STATUS_MAP[c.status]}</span>
                  {isExpiringSoon(c) && <span className="badge badge-overdue">Expire dans {daysLeft(c)}j</span>}
                </div>
              </div>

              {/* Title */}
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                {c.title}
              </h3>
              <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.contract_number}</code>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <DetailRow icon={<DollarSign size={13} />} label="Prix">
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                    {(c.price || c.value || 0).toLocaleString()} {c.currency}
                  </span>
                </DetailRow>
                <DetailRow icon={<Calendar size={13} />} label="Début">
                  {format(new Date(c.start_date), 'dd MMM yyyy', { locale: fr })}
                </DetailRow>
                {c.end_date && (
                  <DetailRow icon={<Calendar size={13} />} label="Fin">
                    {format(new Date(c.end_date), 'dd MMM yyyy', { locale: fr })}
                  </DetailRow>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={styles.viewBtn}>
                  <Info size={13} /> Voir détails
                </button>
                <button type="button" style={styles.viewBtn} onClick={(e) => { e.stopPropagation(); downloadBlob(() => contractsAPI.downloadPdf(c.id), `${c.contract_number}.pdf`); }}>
                  <Download size={13} /> PDF
                </button>
                <button type="button" style={styles.viewBtn} onClick={(e) => { e.stopPropagation(); downloadBlob(() => contractsAPI.downloadWord(c.id), `${c.contract_number}.docx`); }}>
                  <Download size={13} /> Word
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h2 className="modal-title">{selected.title}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <span className={`badge badge-${selected.status}`}>{STATUS_MAP[selected.status]}</span>
              <code style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '22px' }}>
                {selected.contract_number}
              </code>
            </div>

            {selected.description && (
              <div style={styles.infoBox}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {selected.description}
                </p>
              </div>
            )}

            <div style={styles.detailGrid}>
              <InfoField label="Prix du contrat">
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>
                  {(selected.price || selected.value || 0).toLocaleString()} {selected.currency}
                </span>
              </InfoField>
              <InfoField label="Type / Durée">
                {selected.contract_type || '—'} / {selected.duration_months || '—'} mois
              </InfoField>
              <InfoField label="Date de début">
                {format(new Date(selected.start_date), 'dd MMMM yyyy', { locale: fr })}
              </InfoField>
              {selected.end_date && (
                <InfoField label="Date de fin">
                  {format(new Date(selected.end_date), 'dd MMMM yyyy', { locale: fr })}
                </InfoField>
              )}
              <InfoField label="Statut">
                <span className={`badge badge-${selected.status}`}>{STATUS_MAP[selected.status]}</span>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {STATUS_DESC[selected.status]}
                </p>
              </InfoField>
            </div>

            {selected.terms && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Conditions
                </p>
                <div style={styles.termsBox}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {selected.terms}
                  </p>
                </div>
              </div>
            )}

            {canRenew(selected) && (
              <div style={{ marginTop: 18, padding: 12, background: 'var(--bg-elevated)', borderRadius: 10 }}>
                <label className="form-label">Renouvellement à 167 DH/mois</label>
                <input className="form-input" type="number" min="1" max="24" value={renewMonths} onChange={e => setRenewMonths(e.target.value)} />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Total renouvellement: {Number(renewMonths || 0) * 167} MAD HT. La facture est créée automatiquement après votre demande.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => downloadBlob(() => contractsAPI.downloadPdf(selected.id), `${selected.contract_number}.pdf`)}>
                <Download size={14} /> PDF
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => downloadBlob(() => contractsAPI.downloadWord(selected.id), `${selected.contract_number}.docx`)}>
                <Download size={14} /> Word
              </button>
              {canRenew(selected) && (
                <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleRenew(selected.id)}>
                  <RefreshCcw size={14} /> Demander renouvellement
                </button>
              )}
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSelected(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, children }) {

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ color: 'var(--text-muted)', minWidth: 40 }}>{label}</span>
      <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto' }}>{children}</span>
    </div>
  );
}

function InfoField({ label, children }) {

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </p>
      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{children}</div>
    </div>
  );
}

const styles = {
  tabs: {
    display: 'flex', gap: 6, marginBottom: 24,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10, padding: 5,
    width: 'fit-content',
  },
  tab: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 7,
    background: 'transparent', border: 'none',
    fontSize: 13, fontWeight: 500,
    color: 'var(--text-muted)', cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
  tabCount: {
    background: 'var(--border)',
    borderRadius: 99, fontSize: 11,
    padding: '1px 6px', color: 'var(--text-muted)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 20,
  },
  contractCard: {
    cursor: 'pointer',
    display: 'flex', flexDirection: 'column',
  },
  contractIcon: {
    width: 40, height: 40, borderRadius: 10,
    background: 'var(--primary-dim)',
    border: '1px solid var(--border-accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  viewBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    marginTop: 14, padding: '7px 14px',
    background: 'var(--primary-dim)',
    border: '1px solid var(--border-accent)',
    borderRadius: 7, fontSize: 12,
    color: 'var(--primary-light)', cursor: 'pointer',
    fontWeight: 500, width: 'fit-content',
  },
  infoBox: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8, padding: '12px 16px',
    marginBottom: 16,
  },
  detailGrid: { display: 'flex', flexDirection: 'column' },
  termsBox: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8, padding: '14px 16px',
    maxHeight: 200, overflowY: 'auto',
  },
};
