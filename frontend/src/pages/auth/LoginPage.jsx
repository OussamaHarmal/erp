import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'directeur' ? '/director' : '/client');
    } catch (err) {
      setError(err.response?.data?.detail || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Background grid */}
      <div style={styles.grid} />
      <div style={styles.glow} />

      <div style={styles.container}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}><img src="/ui_logo.jpeg" alt="Universal Invest Strategy" style={styles.logoImage} /></div>
          <span style={styles.logoText}>Universal Invest Strategy</span>
        </div>

        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>Bienvenue</h1>
            <p style={styles.sub}>Connectez-vous à votre espace Universal Invest Strategy</p>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div style={styles.inputWrap}>
                <Mail size={16} style={styles.inputIcon} />
                <input
                  type="email" className="form-input" style={{ paddingLeft: 40 }}
                  placeholder="votre@email.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <div style={styles.inputWrap}>
                <Lock size={16} style={styles.inputIcon} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="form-input" style={{ paddingLeft: 40, paddingRight: 40 }}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" style={styles.eyeBtn} onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : (
                <><span>Se connecter</span><ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div style={styles.footer}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              Pas encore de compte ?{' '}
              <Link to="/register" style={{ color: 'var(--primary-light)', textDecoration: 'none', fontWeight: 500 }}>
                S'inscrire
              </Link>
            </p>
          </div>

          {/* Demo credentials */}
          <div style={styles.demo}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>Comptes de démonstration</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: 11, justifyContent: 'center' }}
                onClick={() => setForm({ email: 'admin@smartcms.ma', password: 'Admin@2024!' })}>
                🧑‍💼 Directeur
              </button>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: 11, justifyContent: 'center' }}
                onClick={() => setForm({ email: 'client@test.ma', password: 'Client@2024!' })}>
                👤 Client
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', background: 'var(--bg-base)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, position: 'relative', overflow: 'hidden',
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
    backgroundSize: '48px 48px',
  },
  glow: {
    position: 'absolute', top: '20%', left: '50%',
    transform: 'translateX(-50%)',
    width: 500, height: 300,
    background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  container: { width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 28 },
  logoIcon: {
    width: 92, height: 62, background: '#fff',
    border: '1px solid var(--border-accent)', borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%', objectFit: 'contain' },
  logoText: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', textAlign: 'center' },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '32px',
    boxShadow: 'var(--shadow-lg)',
  },
  header: { textAlign: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontWeight: 800 },
  sub: { fontSize: 14, color: 'var(--text-muted)', marginTop: 4 },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  inputWrap: { position: 'relative' },
  inputIcon: {
    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-muted)', pointerEvents: 'none',
  },
  eyeBtn: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
  },
  footer: { marginTop: 20 },
  demo: {
    marginTop: 20,
    padding: '14px',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
  },
};
