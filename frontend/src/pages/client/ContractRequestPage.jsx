import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { contractsAPI, clientsAPI } from '../../services/api';
import { Building2, CheckCircle2, FileText, Send, UserRound, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DURATION_PRICES = { 1: 65, 3: 130, 6: 390 };

const emptyForm = {
  contract_type: 'Domiciliation Juridique',
  start_date: new Date().toISOString().slice(0, 10),
  duration_months: '1',
  company_name: '',
  company_ice: '',
  company_rc: '',
  company_address: '',
  company_activity: '',
  company_email: '',
  company_phone: '',
};

export default function ContractRequestPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    setLoadingProfile(true);
    clientsAPI.get(user.id)
      .then(r => {
        const p = r.data?.profile || {};
        setProfile(p);
        setForm(prev => ({
          ...prev,
          company_name: p.company_name || '',
          company_ice: p.company_ice || '',
          company_rc: p.company_rc || '',
          company_address: p.company_address || '',
          company_activity: p.company_activity || '',
          company_email: p.company_email || '',
          company_phone: p.company_phone || p.phone || '',
        }));
      })
      .catch(() => setError('Impossible de charger votre profil.'))
      .finally(() => setLoadingProfile(false));
  }, [user?.id]);

  const price = useMemo(() => DURATION_PRICES[Number(form.duration_months)] || 0, [form.duration_months]);
  const endDate = useMemo(() => {
    if (!form.start_date || !form.duration_months) return '';
    const d = new Date(form.start_date);
    d.setMonth(d.getMonth() + Number(form.duration_months));
    return d.toISOString().slice(0, 10);
  }, [form.start_date, form.duration_months]);

  const missingProfile = useMemo(() => {
    const required = [
      ['first_name', 'Prénom'], ['last_name', 'Nom'], ['cin_number', 'CIN'],
      ['phone', 'Téléphone'], ['address', 'Adresse'], ['city', 'Ville'],
    ];
    return required.filter(([k]) => !profile?.[k]).map(([, label]) => label);
  }, [profile]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    if (missingProfile.length > 0) {
      setSaving(false);
      setError(`Complétez d’abord votre profil : ${missingProfile.join(', ')}.`);
      return;
    }

    try {
      const payload = {
        ...form,
        duration_months: Number(form.duration_months),
        start_date: new Date(form.start_date).toISOString(),
      };
      await contractsAPI.request(payload);
      setMessage('Demande envoyée avec succès. Le contrat et la facture sont générés automatiquement. Vos informations de profil ont été réutilisées sans répétition.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l’envoi de la demande.');
    } finally {
      setSaving(false);
    }
  };

  const clientName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || user?.email || '—';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Demande de contrat de domiciliation</h1>
          <p className="page-subtitle">Vos informations personnelles sont reprises automatiquement depuis votre profil. Vous ne remplissez ici que le contrat et les informations société.</p>
        </div>
      </div>

      {message && <div className="alert alert-success" style={{ marginBottom: 16 }}><CheckCircle2 size={16} /> {message}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><AlertCircle size={16} /> {String(error)}</div>}

      <div style={styles.grid}>
        <form onSubmit={handleSubmit} className="card" style={styles.formCard}>
          <SectionTitle icon={<UserRound size={18} />} title="Informations du représentant" />
          {loadingProfile ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner" /></div>
          ) : (
            <div style={styles.profileBox}>
              <div style={styles.lockHeader}><Lock size={15} /> Informations récupérées depuis votre profil</div>
              <div style={styles.profileGrid}>
                <Info label="Nom complet" value={clientName} />
                <Info label="CIN" value={profile?.cin_number} />
                <Info label="Téléphone" value={profile?.phone} />
                <Info label="Ville" value={profile?.city} />
                <Info label="Adresse" value={profile?.address} />
                <Info label="Naissance" value={profile?.birth_date ? profile.birth_date.slice(0, 10) : '—'} />
              </div>
              {missingProfile.length > 0 && (
                <div className="alert alert-warning" style={{ marginTop: 12 }}>
                  Profil incomplet : {missingProfile.join(', ')}. <Link to="/client/profile" style={{ color: 'inherit', fontWeight: 800 }}>Compléter mon profil</Link>
                </div>
              )}
            </div>
          )}

          <SectionTitle icon={<Building2 size={18} />} title="Informations de la société domiciliée" />
          <p style={styles.helpText}>Ces champs sont préremplis depuis votre profil si disponibles. Si vous les modifiez ici, le backend mettra aussi votre profil à jour.</p>
          <div style={styles.twoCols}>
            <Input label="Nom société" value={form.company_name} onChange={v => updateField('company_name', v)} required />
            <Input label="ICE" value={form.company_ice} onChange={v => updateField('company_ice', v)} />
            <Input label="RC" value={form.company_rc} onChange={v => updateField('company_rc', v)} />
            <Input label="Activité" value={form.company_activity} onChange={v => updateField('company_activity', v)} />
            <Input label="Email société" type="email" value={form.company_email} onChange={v => updateField('company_email', v)} />
            <Input label="Téléphone société" value={form.company_phone} onChange={v => updateField('company_phone', v)} />
          </div>
          <Input label="Adresse société" value={form.company_address} onChange={v => updateField('company_address', v)} />

          <SectionTitle icon={<FileText size={18} />} title="Contrat & durée" />

<div style={styles.twoCols}>
  <div className="form-group">
    <label className="form-label">Type de contrat</label>
    <select
      className="form-input"
      value={form.contract_type}
      onChange={e => updateField('contract_type', e.target.value)}
      required
    >
      <option value="Domiciliation Juridique">Domiciliation Juridique</option>
      <option value="Centre d’Affaires">Centre d’Affaires</option>
      <option value="Conseil Juridique – Fiscal et Comptable">
        Conseil Juridique – Fiscal et Comptable
      </option>
    </select>
  </div>

  <div className="form-group">
    <label className="form-label">Durée</label>
    <select
      className="form-input"
      value={form.duration_months}
      onChange={e => {
        const months = Number(e.target.value);
        updateField('duration_months', months);

        if (form.start_date) {
          const start = new Date(form.start_date);
          const end = new Date(start);
          end.setMonth(end.getMonth() + months);

          updateField('end_date', end.toISOString().split('T')[0]);
          updateField('amount', months * 65);
        } else {
          updateField('amount', months * 65);
        }
      }}
      required
    >
      <option value="1">1 mois — 65 MAD</option>
      <option value="3">3 mois — 195 MAD</option>
      <option value="6">6 mois — 390 MAD</option>
    </select>
    </div>

    <div className="form-group">
      <label className="form-label">Date début</label>
      <input
        type="date"
        className="form-input"
        value={form.start_date}
        onChange={e => {
          const startDate = e.target.value;
          const months = Number(form.duration_months || 1);

          updateField('start_date', startDate);

          if (startDate) {
            const start = new Date(startDate);
            const end = new Date(start);
            end.setMonth(end.getMonth() + months);

            updateField('end_date', end.toISOString().split('T')[0]);
            updateField('amount', months * 65);
          }
        }}
        required
      />
    </div>

    <div className="form-group">
      <label className="form-label">Date fin</label>
      <input
        type="date"
        className="form-input"
        value={form.end_date}
        onChange={e => updateField('end_date', e.target.value)}
        required
      />
    </div>

    <div className="form-group">
      <label className="form-label">Montant total</label>
      <input
        type="text"
        className="form-input"
        value={`${Number(form.duration_months || 1) * 65} MAD`}
        readOnly
      />
    </div>
  </div>

          <div style={styles.priceBox}>
            <span>Prix automatique</span>
            <strong>{price.toLocaleString()} MAD</strong>
          </div>
          <div style={styles.periodBox}>
            <span>Période facture/contrat</span>
            <strong>{form.start_date || '—'} → {endDate || '—'}</strong>
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving || loadingProfile || missingProfile.length > 0} style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
            {saving ? <span className="spinner" /> : <Send size={16} />}
            {saving ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </form>

        <aside className="card" style={styles.previewCard}>
          <h3 style={{ marginTop: 0 }}>Aperçu du contrat</h3>
          <p style={styles.muted}>Partie fixe</p>
          <div style={styles.fixedBox}>
            <strong>UNIVERSAL INVEST STRATEGY SARL AU</strong><br />
            Directeur : YOUSSEF BACHRA<br />
            Adresse : Angle Rue Al AARAR et Av Lalla El Yacout 3ème, imm1 Appartement 8<br />
            Tél : +212600800747<br />
            Email : contact@ui-strategy.com<br />
            RC : 496151 · IF : 50137892 · ICE : 002752348000050
          </div>

          <p style={styles.muted}>Partie variable client</p>
          <div style={styles.previewLine}><span>Client</span><strong>{clientName}</strong></div>
          <div style={styles.previewLine}><span>CIN</span><strong>{profile?.cin_number || '—'}</strong></div>
          <div style={styles.previewLine}><span>Société</span><strong>{form.company_name || '—'}</strong></div>
          <div style={styles.previewLine}><span>ICE / RC</span><strong>{form.company_ice || '—'} / {form.company_rc || '—'}</strong></div>
          <div style={styles.previewLine}><span>Date début</span><strong>{form.start_date || '—'}</strong></div>
          <div style={styles.previewLine}><span>Date fin calculée</span><strong>{endDate || '—'}</strong></div>
          <div style={styles.previewLine}><span>Durée</span><strong>{form.duration_months} mois</strong></div>
          <div style={styles.previewLine}><span>Prix</span><strong>{price} MAD</strong></div>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return <h2 style={styles.sectionTitle}>{icon}{title}</h2>;
}

function Input({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required ? ' *' : ''}</label>
      <input className="form-input" type={type} value={value || ''} onChange={e => onChange(e.target.value)} required={required} />
    </div>
  );
}

function Info({ label, value }) {
  return <div><div style={styles.infoLabel}>{label}</div><div style={styles.infoValue}>{value || '—'}</div></div>;
}

const styles = {
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' },
  formCard: { padding: 24 },
  previewCard: { padding: 24, position: 'sticky', top: 20 },
  twoCols: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 },
  sectionTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, margin: '22px 0 14px', color: 'var(--text-primary)' },
  profileBox: { padding: 16, borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' },
  lockHeader: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 },
  profileGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  infoLabel: { color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 },
  infoValue: { color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 },
  helpText: { color: 'var(--text-muted)', fontSize: 13, marginTop: -6, marginBottom: 14 },
  priceBox: { marginTop: 12, padding: 16, borderRadius: 14, background: 'rgba(16, 185, 129, 0.10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--success)' },
  periodBox: { marginTop: 10, padding: 14, borderRadius: 14, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)' },
  fixedBox: { fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' },
  muted: { color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 18 },
  previewLine: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' },
};
