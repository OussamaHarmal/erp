/**
 * Sidebar — Role-based navigation
 */
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, FileText, ClipboardPlus, Receipt,
  FolderOpen, User, LogOut, ChevronRight,
  Briefcase, Database, Bell
} from 'lucide-react';

const directorNav = [
  { path: '/director', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/director/clients', label: 'Clients', icon: Users },
  { path: '/director/contracts', label: 'Contrats', icon: FileText },
  { path: '/director/invoices', label: 'Factures', icon: Receipt },
  { path: '/director/notifications', label: 'Notifications', icon: Bell },
  { path: '/director/erp-sage', label: 'ERP Sage', icon: Database },
];

const clientNav = [
  { path: '/client', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/client/contracts', label: 'Mes Contrats', icon: FileText },
  { path: '/client/contract-request', label: 'Demande Contrat', icon: ClipboardPlus },
  { path: '/client/invoices', label: 'Mes Factures', icon: Receipt },
  { path: '/client/notifications', label: 'Notifications', icon: Bell },
  { path: '/client/documents', label: 'Mes Documents', icon: FolderOpen },
  { path: '/client/profile', label: 'Mon Profil', icon: User },
];

export default function Sidebar() {
  const { user, logout, isDirecteur } = useAuth();
  const navigate = useNavigate();
  const navItems = isDirecteur ? directorNav : clientNav;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>
        <div style={styles.logoIcon}>
          <img src="/ui_logo.jpeg" alt="Universal Invest Strategy" style={styles.logoImage} />
        </div>
        <div>
          <div style={styles.logoText}>Universal Invest Strategy</div>
          <div style={styles.logoSub}>Client & Contract System</div>
        </div>
      </div>

      {/* Role badge */}
      <div style={styles.roleBadge}>
        <span className={`badge badge-${user?.role}`}>
          {isDirecteur ? '🧑‍💼 Directeur' : '👤 Client'}
        </span>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        <div style={styles.navLabel}>Navigation</div>
        {navItems.map(({ path, label, icon: Icon, exact }) => (
          <NavLink
            key={path}
            to={path}
            end={exact}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {})
            })}
          >
            <Icon size={18} />
            <span style={styles.navLabel2}>{label}</span>
            <ChevronRight size={14} style={styles.chevron} />
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div style={styles.footer}>
        <div style={styles.userInfo}>
          <div style={styles.avatar}>
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={styles.userName}>{user?.email}</div>
            <div style={styles.userRole}>{user?.role}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          <LogOut size={16} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 'var(--sidebar-width)',
    height: '100vh',
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    position: 'fixed',
    top: 0, left: 0,
    zIndex: 50,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '24px 20px 20px',
    borderBottom: '1px solid var(--border)',
  },
  logoIcon: {
    width: 52, height: 52,
    background: '#fff',
    borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--border-accent)',
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%', objectFit: 'contain' },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800, fontSize: 16,
    color: 'var(--text-primary)',
  },
  logoSub: { fontSize: 11, color: 'var(--text-muted)', marginTop: 1 },
  roleBadge: { padding: '12px 20px' },
  nav: { flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 },
  navLabel: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
    color: 'var(--text-muted)', textTransform: 'uppercase',
    padding: '8px 8px 6px',
  },
  navLabel2: { flex: 1 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    textDecoration: 'none',
    color: 'var(--text-secondary)',
    fontSize: 14, fontWeight: 500,
    transition: 'all 0.15s',
  },
  navItemActive: {
    background: 'var(--primary-dim)',
    color: 'var(--primary-light)',
    borderLeft: '2px solid var(--primary)',
  },
  chevron: { opacity: 0.3, marginLeft: 'auto' },
  footer: {
    padding: '16px 16px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  userInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36,
    background: 'var(--primary-dim)',
    border: '1px solid var(--border-accent)',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-display)', fontWeight: 700,
    fontSize: 14, color: 'var(--primary-light)',
    flexShrink: 0,
  },
  userName: { fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    fontSize: 13, cursor: 'pointer',
    transition: 'all 0.15s',
    width: '100%',
  },
};
