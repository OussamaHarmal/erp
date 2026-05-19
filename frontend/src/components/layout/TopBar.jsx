import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggleButton } from '../../context/ThemeContext';
import NotificationBell from '../notifications/NotificationBell';

const pageNames = {
  '/director': 'Tableau de bord',
  '/director/clients': 'Gestion des Clients',
  '/director/contracts': 'Gestion des Contrats',
  '/director/invoices': 'Gestion des Factures',
  '/director/erp-sage': 'ERP Sage',
  '/director/notifications': 'Notifications',
  '/client': 'Mon Dashboard',
  '/client/contracts': 'Mes Contrats',
  '/client/contract-request': 'Demande de Contrat',
  '/client/invoices': 'Mes Factures',
  '/client/documents': 'Mes Documents',
  '/client/profile': 'Mon Profil',
  '/client/notifications': 'Notifications',
};

export default function TopBar() {
  const { pathname } = useLocation();
  const { user, isDirecteur } = useAuth();
  const title = pageNames[pathname] || 'Universal Invest Strategy CMS';

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <header className="topbar">
      <div>
        <h1 className="topbar-title">{title}</h1>
        <p className="topbar-date">{today}</p>
      </div>
      <div className="topbar-actions">
        <NotificationBell />
        <ThemeToggleButton />
        <div className="user-chip">
          <div className="user-chip-dot" />
          <span className="user-chip-email">{user?.email}</span>
          <span className={`badge badge-${user?.role}`} style={{ fontSize: 11 }}>
            {isDirecteur ? 'Admin' : 'Client'}
          </span>
        </div>
      </div>
    </header>
  );
}
