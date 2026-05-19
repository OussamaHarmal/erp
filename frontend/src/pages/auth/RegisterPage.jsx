import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    password: '', phone: '', cin_number: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(form);
      navigate('/client');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.grid} />
      <div style={styles.container}>
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}><img src="/ui_logo.jpeg" alt="Universal Invest Strategy" style={styles.logoImage} /></div>
          <span style={styles.logoText}>Universal Invest Strategy</span>
        </div>

        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>Créer un compte</h1>
            <p style={styles.sub}>Créez votre espace client Universal Invest Strategy</p>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Prénom *</label>
                <input className="form-input" value={form.first_name} onChange={set('first_name')} required placeholder="Mohammed" />
              </div>
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input className="form-input" value={form.last_name} onChange={set('last_name')} required placeholder="Alami" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" className="form-input" value={form.email} onChange={set('email')} required placeholder="email@exemple.com" />
            </div>

            <div className="form-group">
              <label className="form-label">Mot de passe * (min 8 chars)</label>
              <input type="password" className="form-input" value={form.password} onChange={set('password')} required placeholder="••••••••" />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input className="form-input" value={form.phone} onChange={set('phone')} placeholder="+212 6xx xxx xxx" />
              </div>
              <div className="form-group">
                <label className="form-label">CIN</label>
                <input className="form-input" value={form.cin_number} onChange={set('cin_number')} placeholder="AB123456" />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : (
                <><span>Créer mon compte</span><ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
            Déjà inscrit ?{' '}
            <Link to="/login" style={{ color: 'var(--primary-light)', textDecoration: 'none', fontWeight: 500 }}>
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', background: 'var(--bg-base)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, position: 'relative',
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
    backgroundSize: '48px 48px', pointerEvents: 'none',
  },
  container: { width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 28 },
  logoIcon: { width: 92, height: 62, background: '#fff', border: '1px solid var(--border-accent)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%', objectFit: 'contain' },
  logoText: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, textAlign: 'center' },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 32, boxShadow: 'var(--shadow-lg)' },
  header: { textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 800 },
  sub: { fontSize: 14, color: 'var(--text-muted)', marginTop: 4 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
};
