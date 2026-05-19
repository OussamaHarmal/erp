import { useState, useEffect } from 'react';
import { analyticsAPI, contractsAPI, invoicesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FileText, Receipt, Clock, TrendingUp, CheckCircle, AlertCircle, UploadCloud, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ActivityTimeline from '../../components/layout/ActivityTimeline';

const STATUS_MAP_CONTRACT = { draft: 'Brouillon', pending: 'En attente', approved: 'Approuvé', active: 'Actif', rejected: 'Rejeté', expired: 'Expiré', terminated: 'Résilié' };
const STATUS_MAP_INVOICE  = { pending: 'En attente', paid: 'Payé', overdue: 'En retard', cancelled: 'Annulé' };

export default function ClientDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [portal, setPortal] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsAPI.myStats(),
      analyticsAPI.clientPortal(),
      contractsAPI.list({ limit: 5 }),
      invoicesAPI.list({ limit: 5 }),
      contractsAPI.expiringSoon(30),
    ])
      .then(([s, p, c, i, e]) => {
        setStats(s.data);
        setPortal(p.data);
        setContracts(c.data || []);
        setInvoices(i.data || []);
        setExpiring(e.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="modern-grid-4">{Array.from({ length: 8 }).map((_, i) => <div className="skeleton-card modern-skeleton" key={i} />)}</div>;

  const displayName = user?.profile?.full_name || user?.email || 'Client';

  return (
    <div className="client-portal-page">
      <section className="client-portal-hero">
        <div>
          <span className="modern-kicker">Espace Client ULTRA PRO</span>
          <h1>Bienvenue, {displayName}</h1>
          <p>Suivez vos contrats, factures, documents, alertes et actions rapides dans une interface moderne.</p>
          <div className="client-hero-actions">
            <Link className="btn btn-primary" to="/client/contract-request">Demander un contrat <ArrowRight size={16}/></Link>
            <Link className="btn btn-secondary" to="/client/documents">Uploader document</Link>
          </div>
        </div>
        <div className="portal-score-card">
          <span>Profil complet</span>
          <strong>{portal?.profile_completion || 0}%</strong>
          <div className="portal-progress"><i style={{ width: `${portal?.profile_completion || 0}%` }} /></div>
          <p>Plus votre dossier est complet, plus le traitement est rapide.</p>
        </div>
      </section>

      {expiring.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <b>Notification contrat :</b> votre contrat {expiring[0].contract_number} expire bientôt
          {expiring[0].end_date ? ` (${format(new Date(expiring[0].end_date), 'dd MMM yyyy', { locale: fr })})` : ''}.
        </div>
      )}

      <div className="modern-grid-4" style={{ marginBottom: 24 }}>
        <PortalMetric icon={<FileText />} label="Contrats actifs" value={portal?.active_contracts ?? stats?.contracts ?? 0} tone="blue" />
        <PortalMetric icon={<Receipt />} label="Factures en attente" value={portal?.pending_invoices ?? stats?.pending_invoices ?? 0} tone="orange" />
        <PortalMetric icon={<UploadCloud />} label="Documents" value={portal?.documents ?? 0} tone="purple" />
        <PortalMetric icon={<TrendingUp />} label="Total payé" value={`${Number(portal?.total_paid ?? stats?.total_paid ?? 0).toLocaleString()} MAD`} tone="green" />
      </div>

      <div className="modern-grid-3 spaced">
        <div className="modern-panel wide">
          <div className="modern-panel-head"><div><h3>Centre client</h3><span>Actions rapides et prochaines échéances</span></div><ShieldCheck size={20}/></div>
          <div className="client-action-grid">
            {(portal?.quick_actions || []).map((action) => <Link to={action.url} className={`client-action-card client-action-${action.type}`} key={action.url}>{action.label}<ArrowRight size={16}/></Link>)}
          </div>
          <div className="client-next-grid">
            <NextBox title="Prochaine facture" empty="Aucune facture en attente" item={portal?.next_invoice} type="invoice" />
            <NextBox title="Contrat proche expiration" empty="Aucun contrat proche expiration" item={portal?.expiring_contract} type="contract" />
          </div>
        </div>
        <ActivityTimeline limit={6} title="Mon Activity Timeline" />
      </div>

      <div className="modern-grid-2 spaced">
        <RecentContracts contracts={contracts} />
        <RecentInvoices invoices={invoices} />
      </div>
    </div>
  );
}

function PortalMetric({ icon, label, value, tone }) {
  return <div className={`kpi-card kpi-${tone}`}><div className="kpi-top"><div className="kpi-icon">{icon}</div><span className="kpi-trend">Client</span></div><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div></div>;
}

function NextBox({ title, empty, item, type }) {
  return <div className="client-next-box"><span>{title}</span>{item ? <><strong>{type === 'invoice' ? item.invoice_number : item.contract_number}</strong><p>{type === 'invoice' ? `${Number(item.total || 0).toLocaleString()} MAD · ${item.status}` : `Expiration : ${new Date(item.end_date).toLocaleDateString('fr-FR')}`}</p></> : <p>{empty}</p>}</div>;
}

function RecentContracts({ contracts }) {
  return <div className="card modern-mini-card"><div className="mini-head"><h3>Mes Contrats Récents</h3><span>{contracts.length} contrat(s)</span></div>{contracts.length === 0 ? <EmptyMini icon={<FileText size={32} />} text="Aucun contrat" /> : <div className="modern-list">{contracts.slice(0,4).map(c => <div className="modern-list-row" key={c.id}><b><FileText size={16}/></b><div><strong>{c.title}</strong><span>{format(new Date(c.start_date), 'dd MMM yyyy', { locale: fr })} · {c.contract_number}</span></div><em>{STATUS_MAP_CONTRACT[c.status]}</em></div>)}</div>}</div>;
}

function RecentInvoices({ invoices }) {
  return <div className="card modern-mini-card"><div className="mini-head"><h3>Mes Factures Récentes</h3><span>{invoices.length} facture(s)</span></div>{invoices.length === 0 ? <EmptyMini icon={<Receipt size={32} />} text="Aucune facture" /> : <div className="modern-list">{invoices.slice(0,4).map(inv => <div className="modern-list-row" key={inv.id}><b>{inv.status === 'paid' ? <CheckCircle size={16}/> : inv.status === 'overdue' ? <AlertCircle size={16}/> : <Clock size={16}/>}</b><div><strong>{inv.invoice_number}</strong><span>Échéance : {format(new Date(inv.due_date), 'dd MMM yyyy', { locale: fr })}</span></div><em>{Number(inv.total).toLocaleString()} {inv.currency} · {STATUS_MAP_INVOICE[inv.status]}</em></div>)}</div>}</div>;
}

function EmptyMini({ icon, text }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px', color: 'var(--text-muted)', gap: 10 }}><div style={{ opacity: 0.35 }}>{icon}</div><span style={{ fontSize: 13 }}>{text}</span></div>;
}
