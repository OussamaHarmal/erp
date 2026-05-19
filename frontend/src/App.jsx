import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Director pages
import DirectorDashboard from './pages/director/Dashboard';
import ClientsPage from './pages/director/ClientsPage';
import DirectorContractsPage from './pages/director/ContractsPage';
import DirectorInvoicesPage from './pages/director/InvoicesPage';
import ErpSagePage from './pages/director/ErpSagePage';

// Client pages
import ClientDashboard from './pages/client/Dashboard';
import MyContractsPage from './pages/client/MyContractsPage';
import ContractRequestPage from './pages/client/ContractRequestPage';
import MyInvoicesPage from './pages/client/MyInvoicesPage';
import MyDocumentsPage from './pages/client/MyDocumentsPage';
import MyProfilePage from './pages/client/MyProfilePage';
import NotificationsPage from './pages/shared/NotificationsPage';

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f' }}>
      <div className="spinner" />
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'directeur' ? '/director' : '/client'} replace />;
  }

  return children;
}

function RoleRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <Navigate to={user?.role === 'directeur' ? '/director' : '/client'} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<RoleRedirect />} />

          {/* Director routes */}
          <Route path="/director" element={
            <ProtectedRoute requiredRole="directeur">
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<DirectorDashboard />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="contracts" element={<DirectorContractsPage />} />
            <Route path="invoices" element={<DirectorInvoicesPage />} />
            <Route path="erp-sage" element={<ErpSagePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* Client routes */}
          <Route path="/client" element={
            <ProtectedRoute requiredRole="client">
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<ClientDashboard />} />
            <Route path="contracts" element={<MyContractsPage />} />
            <Route path="contract-request" element={<ContractRequestPage />} />
            <Route path="invoices" element={<MyInvoicesPage />} />
            <Route path="documents" element={<MyDocumentsPage />} />
            <Route path="profile" element={<MyProfilePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
