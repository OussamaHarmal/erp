import { useEffect, useMemo, useState } from 'react';
import { analyticsAPI } from '../../services/api';
import { Users, FileText, Receipt, TrendingUp, Database, Wallet, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import ActivityTimeline from '../../components/layout/ActivityTimeline';

export default function DirectorDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await analyticsAPI.dashboard();
      setStats(response.data);
    } catch (err) {
      setError(err.response?.data?.detail?.message || err.response?.data?.detail || 'Impossible d’actualiser le dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const revenue = useMemo(() => stats?.monthly_revenue || [], [stats]);
  const invoiceStatus = useMemo(() => ([
    { name: 'Payées', value: Number(stats?.paid_invoices || 0) },
    { name: 'Impayées', value: Number(stats?.unpaid_invoices || 0) },
    { name: 'En retard', value: Number(stats?.overdue_invoices || 0) },
  ]), [stats]);

  if (loading) {
    return <div className="modern-grid-4">{Array.from({ length: 8 }).map((_, i) => <div className="skeleton-card modern-skeleton" key={i} />)}</div>;
  }

  if (!stats) return <div className="alert alert-error">Erreur chargement dashboard.</div>;

  return (
    <div className="modern-page">
      <section className="modern-hero dashboard-hero-clean">
        <div>
          <span className="modern-kicker">ERP Direction</span>
          <h1>Tableau de bord</h1>
          <p>Dashboard premium : analytics, activité temps réel, revenus, contrats, factures, clients et export Sage dans une seule vue décisionnelle.</p>
        </div>
      </section>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="modern-grid-4">
        <Metric icon={<Wallet/>} label="CA encaissé" value={`${Number(stats.total_revenue || 0).toLocaleString()} MAD`} sub="Factures payées" tone="green" trend="+ performance" />
        <Metric icon={<Users/>} label="Clients" value={stats.total_clients || 0} sub="Portefeuille total" tone="blue" trend="CRM" />
        <Metric icon={<FileText/>} label="Contrats actifs" value={stats.active_contracts || 0} sub={`${stats.total_contracts || 0} contrats au total`} tone="purple" trend={`${stats.expired_contracts || 0} expirés`} />
        <Metric icon={<Database/>} label="Sage" value={stats.sage_pending_invoices || 0} sub="Factures non exportées" tone="orange" trend="à traiter" />
      </div>



      <div className="modern-grid-3 spaced">
        <div className="modern-panel wide premium-command-center">
          <div className="modern-panel-head">
            <div><h3>Analytics Premium</h3><span>CA encaissé vs factures émises</span></div><TrendingUp size={20}/>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, color: 'var(--text-primary)' }}/>
              <Line type="monotone" dataKey="revenue" name="CA payé" stroke="var(--success)" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="issued" name="Factures émises" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="modern-panel premium-alerts">
          <div className="modern-panel-head"><div><h3>Centre d’alerte</h3><span>Actions prioritaires</span></div><BellIcon /></div>
          <div className="premium-alert-list">
            {(stats.alerts || []).slice(0,4).map((a, i) => <div className={`premium-alert premium-alert-${a.type}`} key={i}><strong>{a.title}</strong><span>{a.message}</span></div>)}
            {(stats.alerts || []).length === 0 && <div className="empty-state compact">Aucune alerte critique.</div>}
          </div>
        </div>
      </div>

      <div className="modern-grid-3 spaced">
        <div className="modern-panel wide">
          <div className="modern-panel-head">
            <div><h3>Évolution du chiffre d’affaires</h3><span>Montants payés par mois</span></div>
            <ArrowUpRight size={20}/>
          </div>
          <ResponsiveContainer width="100%" height={315}>
            <AreaChart data={revenue}>
              <defs>
                <linearGradient id="revClean" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, color: 'var(--text-primary)' }}/>
              <Area type="monotone" dataKey="revenue" name="CA payé" stroke="var(--primary)" strokeWidth={3} fill="url(#revClean)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="modern-panel">
          <div className="modern-panel-head"><div><h3>Facturation</h3><span>Répartition par statut</span></div><Receipt size={20}/></div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={invoiceStatus} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={4}>
                {invoiceStatus.map((entry, index) => <Cell key={entry.name} fill={["var(--success)", "var(--warning)", "var(--danger)"][index]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, color: 'var(--text-primary)' }}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="modern-list">
            {invoiceStatus.map((item, i) => <div className="modern-list-row" key={item.name}><b>{i + 1}</b><div><strong>{item.name}</strong><span>{item.value} facture(s)</span></div></div>)}
          </div>
        </div>
      </div>

      <div className="modern-grid-2 spaced">
        <div className="modern-panel">
          <div className="modern-panel-head"><div><h3>Résumé opérationnel</h3><span>Indicateurs essentiels</span></div><CheckCircle2 size={20}/></div>
          <div className="dashboard-summary">
            <Summary label="Montant impayé" value={`${Number(stats.unpaid_amount || 0).toLocaleString()} MAD`} text="Factures à recouvrer" />
            <Summary label="Documents" value={stats.total_documents || 0} text="Fichiers stockés" />
            <Summary label="Contrats expirés" value={stats.expired_contracts || 0} text="À vérifier manuellement" />
          </div>
        </div>

        <div className="modern-panel">
          <div className="modern-panel-head"><div><h3>Top clients</h3><span>Par chiffre d’affaires payé</span></div><Users size={20}/></div>
          <div className="modern-list">
            {(stats.top_clients || []).slice(0,5).map((c, i) => (
              <div className="modern-list-row" key={c.id || i}>
                <b>#{i + 1}</b>
                <div><strong>{c.email || c.full_name || 'Client'}</strong><span>{c.invoice_count || 0} facture(s)</span></div>
                <em>{Number(c.revenue || 0).toLocaleString()} MAD</em>
              </div>
            ))}
            {(stats.top_clients || []).length === 0 && <div className="empty-state compact">Aucun client payé.</div>}
          </div>
        </div>
      </div>

      <ActivityTimeline limit={12} title="Activity Timeline Direction" />

      <div className="modern-panel spaced">
        <div className="modern-panel-head"><div><h3>Performance mensuelle</h3><span>Volume d’activité</span></div><TrendingUp size={20}/></div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={revenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
            <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, color: 'var(--text-primary)' }}/>
            <Bar dataKey="revenue" name="CA payé" fill="var(--accent)" radius={[12,12,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BellIcon(){ return <span className="live-pulse">Live</span>; }

function Metric({ icon, label, value, sub, tone, trend='ERP' }) {
  return (
    <div className={`kpi-card kpi-${tone}`}>
      <div className="kpi-top">
        <div className="kpi-icon">{icon}</div>
        <span className="kpi-trend">{trend}</span>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

function Summary({ label, value, text }) {
  return <div className="summary-card"><span>{label}</span><strong>{value}</strong><p>{text}</p></div>;
}
