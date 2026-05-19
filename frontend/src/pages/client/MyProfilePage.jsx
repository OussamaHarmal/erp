/**
 * MyProfilePage — Client profile editor
 * View and update personal information
 */
import { useState, useEffect } from 'react';
import { clientsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { User, Save, Mail, Phone, MapPin, Building2, CreditCard, Calendar, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function MyProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');

  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '',
    address: '', city: '', country: 'Morocco',
    company_name: '', birth_date: '',
  });

  useEffect(() => {
    if (!user?.id) return;
    clientsAPI.get(user.id)
      .then(r => {
        const p = r.data?.profile;
        setProfile(p);
        if (p) {
          setForm({
            first_name:   p.first_name   || '',
            last_name:    p.last_name    || '',
            phone:        p.phone        || '',
            address:      p.address      || '',
            city:         p.city         || '',
            country:      p.country      || 'Morocco',
            company_name: p.company_name || '',
            birth_date:   p.birth_date ? p.birth_date.substring(0, 10) : '',
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.birth_date) delete payload.birth_date;
      await clientsAPI.updateProfile(user.id, payload);
      setSuccess('Profil mis à jour avec succès !');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur mise à jour');
    } finally { setSaving(false); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" /></div>
  );

  const initials = `${form.first_name.charAt(0)}${form.last_name.charAt(0)}`.toUpperCase() || user?.email?.charAt(0).toUpperCase();

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mon Profil</h1>
          <p className="page-subtitle">Gérez vos informations personnelles</p>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: 20 }}>✅ {success}</div>}
      {error   && <div className="alert alert-error"   style={{ marginBottom: 20 }}>⚠️ {error}</div>}

      {/* Profile header card */}
      <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={styles.avatar}>{initials || '?'}</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>
            {form.first_name || '—'} {form.last_name || ''}
          </h2>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={styles.infoChip}><Mail size={12} /> {user?.email}</span>
            {form.phone && <span style={styles.infoChip}><Phone size={12} /> {form.phone}</span>}
            {form.city && <span style={styles.infoChip}><MapPin size={12} /> {form.city}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span className="badge badge-client" style={{ fontSize: 12 }}>Client</span>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Membre depuis {user?.created_at ? format(new Date(user.created_at), 'MMM yyyy', { locale: fr }) : '—'}
          </p>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave}>
        {/* Personal info section */}
        <SectionTitle icon={<User size={15} />} label="Informations personnelles" />
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="grid-2" style={{ gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Prénom *</label>
              <input className="form-input" value={form.first_name} onChange={set('first_name')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Nom *</label>
              <input className="form-input" value={form.last_name} onChange={set('last_name')} required />
            </div>
            <div className="form-group">
              <label className="form-label"><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />Téléphone</label>
              <input className="form-input" value={form.phone} onChange={set('phone')} placeholder="+212 6xx xxx xxx" />
            </div>
            <div className="form-group">
              <label className="form-label"><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />Date de naissance</label>
              <input type="date" className="form-input" value={form.birth_date} onChange={set('birth_date')} />
            </div>
          </div>
        </div>

        {/* Address section */}
        <SectionTitle icon={<MapPin size={15} />} label="Adresse" />
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Adresse</label>
              <input className="form-input" value={form.address} onChange={set('address')} placeholder="123 Rue Mohammed V" />
            </div>
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Ville</label>
                <input className="form-input" value={form.city} onChange={set('city')} placeholder="Casablanca" />
              </div>
              <div className="form-group">
                <label className="form-label">Pays</label>
                <select className="form-input" value={form.country} onChange={set('country')}>
                  <option value="Morocco">Maroc</option>
                  <option value="France">France</option>
                  <option value="Belgium">Belgique</option>
                  <option value="Other">Autre</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Professional section */}
        <SectionTitle icon={<Building2 size={15} />} label="Informations professionnelles" />
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-group">
            <label className="form-label">Nom de l'entreprise (optionnel)</label>
            <input className="form-input" value={form.company_name} onChange={set('company_name')} placeholder="Mon Entreprise SARL" />
          </div>
        </div>

        {/* Account info (read-only) */}
        <SectionTitle icon={<Shield size={15} />} label="Informations du compte" />
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="grid-2" style={{ gap: 16 }}>
            <ReadonlyField label="Email" value={user?.email} icon={<Mail size={13} />} />
            <ReadonlyField label="Rôle" value="Client" icon={<Shield size={13} />} />
            {profile?.cin_number && (
              <ReadonlyField label="Numéro CIN" value={profile.cin_number} icon={<CreditCard size={13} />} />
            )}
            <ReadonlyField
              label="Membre depuis"
              value={user?.created_at ? format(new Date(user.created_at), 'dd MMMM yyyy', { locale: fr }) : '—'}
              icon={<Calendar size={13} />}
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ padding: '12px 32px' }} disabled={saving}>
          {saving
            ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sauvegarde...</>
            : <><Save size={16} /> Sauvegarder les modifications</>
          }
        </button>
      </form>
    </div>
  );
}

function SectionTitle({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ color: 'var(--primary-light)' }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

function ReadonlyField({ label, value, icon }) {
  return (
    <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{value || '—'}</p>
    </div>
  );
}

const styles = {
  avatar: {
    width: 72, height: 72,
    background: 'var(--primary-dim)',
    border: '2px solid var(--border-accent)',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-display)',
    fontWeight: 800, fontSize: 24,
    color: 'var(--primary-light)',
    flexShrink: 0,
  },
  infoChip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 12, color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 99, padding: '3px 10px',
  },
};
