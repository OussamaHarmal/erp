/**
 * MyInvoicesPage — Client view of their own invoices
 * Read-only with status tracking and payment status display
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { invoicesAPI } from '../../services/api';
import { Receipt, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, XCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_MAP = {
  pending:   { label: 'En attente',  icon: Clock,        color: 'var(--warning)', bg: 'var(--warning-dim)' },
  paid:      { label: 'Payé',        icon: CheckCircle,  color: 'var(--success)', bg: 'var(--success-dim)' },
  overdue:   { label: 'En retard',   icon: AlertCircle,  color: 'var(--danger)',  bg: 'var(--danger-dim)'  },
  cancelled: { label: 'Annulé',      icon: XCircle,      color: 'var(--text-muted)', bg: 'rgba(148,148,184,0.1)' },
};

export default function MyInvoicesPage() {
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(null);
  const [filter, setFilter]       = useState('all');
  const [downloadError, setDownloadError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');

  useEffect(() => {
    invoicesAPI.list()
      .then(r => setInvoices(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const invoiceId = searchParams.get('invoiceId');
    if (!invoiceId || invoices.length === 0) return;
    const target = invoices.find((invoice) => invoice.id === invoiceId);
    if (target) setExpanded(target.id);
  }, [invoices, searchParams]);

  const extractErrorMessage = async (err) => {
    const data = err?.response?.data;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const json = JSON.parse(text);
        return json.detail || text;
      } catch {
        return 'Impossible de télécharger la facture';
      }
    }
    return data?.detail || err?.message || 'Impossible de télécharger la facture';
  };

  const handleDownloadInvoice = async (inv, event) => {
    event?.stopPropagation();
    setDownloadError('');
    setDownloadingId(inv.id);
    try {
      const response = await invoicesAPI.downloadPdf(inv.id);
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(await extractErrorMessage(err));
    } finally {
      setDownloadingId('');
    }
  };


  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);

  const totalPaid    = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.total, 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes Factures</h1>
          <p className="page-subtitle">{invoices.length} facture(s) au total</p>
        </div>
      </div>

      {downloadError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{downloadError}</div>}

      {/* Summary cards */}
      {!loading && invoices.length > 0 && (
        <div className="grid-3" style={{ marginBottom: 28 }}>
          <SummaryCard label="Total Payé" amount={totalPaid} color="var(--success)" bg="var(--success-dim)" icon={<CheckCircle size={18} />} />
          <SummaryCard label="En Attente" amount={totalPending} color="var(--warning)" bg="var(--warning-dim)" icon={<Clock size={18} />} />
          <SummaryCard label="En Retard"  amount={totalOverdue} color="var(--danger)"  bg="var(--danger-dim)"  icon={<AlertCircle size={18} />} />
        </div>
      )}

      {/* Filter tabs */}
      <div style={styles.tabs}>
        {['all', 'pending', 'paid', 'overdue', 'cancelled'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...styles.tab, ...(filter === f ? styles.tabActive : {}) }}
          >
            {f === 'all' ? 'Toutes' : STATUS_MAP[f].label}
            <span style={styles.tabCount}>
              {f === 'all' ? invoices.length : invoices.filter(i => i.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><Receipt size={48} /><h3>Aucune facture trouvée</h3></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(inv => {
            const status = STATUS_MAP[inv.status] || STATUS_MAP.pending;
            const StatusIcon = status.icon;
            const isOpen = expanded === inv.id;

            return (
              <div key={inv.id} style={{ ...styles.invoiceCard, borderColor: isOpen ? 'var(--border-accent)' : 'var(--border)' }}>
                {/* Main row */}
                <div style={styles.invoiceRow} onClick={() => setExpanded(isOpen ? null : inv.id)}>
                  {/* Status icon */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: status.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <StatusIcon size={18} color={status.color} />
                  </div>

                  {/* Invoice info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <code style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{inv.invoice_number}</code>
                      <span className={`badge badge-${inv.status}`} style={{ fontSize: 11 }}>{status.label}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Émise le {format(new Date(inv.issue_date), 'dd MMM yyyy', { locale: fr })}
                      {inv.service_start_date && <> · Période : {format(new Date(inv.service_start_date), 'dd MMM yyyy', { locale: fr })} → {inv.service_end_date ? format(new Date(inv.service_end_date), 'dd MMM yyyy', { locale: fr }) : '—'}</>}
                      {' · '}
                      Échéance : <span style={{ color: inv.status === 'overdue' ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {format(new Date(inv.due_date), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </p>
                  </div>

                  {/* Amount */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--success)' }}>
                      {inv.total.toLocaleString()} {inv.currency}
                    </div>
                    {inv.paid_date && (
                      <p style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>
                        Payé le {format(new Date(inv.paid_date), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 8 }}
                      disabled={downloadingId === inv.id}
                      onClick={(event) => handleDownloadInvoice(inv, event)}
                    >
                      <Download size={14} /> {downloadingId === inv.id ? 'Téléchargement...' : 'PDF'}
                    </button>
                  </div>

                  {/* Expand toggle */}
                  <div style={{ color: 'var(--text-muted)', marginLeft: 10 }}>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded line items */}
                {isOpen && inv.items?.length > 0 && (
                  <div style={styles.expanded}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                      Détail des lignes
                    </p>
                    <table style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr>
                          {['Description', 'Qté', 'Prix unitaire', 'Total'].map(h => (
                            <th key={h} style={{ textAlign: h === 'Description' ? 'left' : 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {inv.items.map((item, i) => (
                          <tr key={i}>
                            <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{item.description}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.quantity}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.unit_price.toLocaleString()}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{item.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                        <span>Sous-total</span><span>{inv.subtotal.toLocaleString()} {inv.currency}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                        <span>TVA ({inv.tax_rate}%)</span><span>{inv.tax_amount.toLocaleString()} {inv.currency}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, color: 'var(--success)', marginTop: 4 }}>
                        <span>Total</span><span>{inv.total.toLocaleString()} {inv.currency}</span>
                      </div>
                    </div>
                    {inv.notes && (
                      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 7, fontSize: 13, color: 'var(--text-muted)' }}>
                        📝 {inv.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, amount, color, bg, icon }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 18, fontWeight: 800, color }}>{amount.toLocaleString()} MAD</p>
      </div>
    </div>
  );
}

const styles = {
  tabs: {
    display: 'flex', gap: 4, marginBottom: 20,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10, padding: 5,
    width: 'fit-content', flexWrap: 'wrap',
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
    background: 'var(--border)', borderRadius: 99,
    fontSize: 11, padding: '1px 6px', color: 'var(--text-muted)',
  },
  invoiceCard: {
    background: 'var(--bg-card)',
    border: '1px solid',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    transition: 'border-color 0.2s',
  },
  invoiceRow: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '16px 20px', cursor: 'pointer',
  },
  expanded: {
    padding: '0 20px 16px',
    borderTop: '1px solid var(--border)',
    marginTop: 0,
    paddingTop: 14,
  },
};
