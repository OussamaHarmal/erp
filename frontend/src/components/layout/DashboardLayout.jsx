import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ChatbotWidget from './ChatbotWidget';

export default function DashboardLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <TopBar />
        <main className="app-main">
          <Outlet />
        </main>
        <ChatbotWidget />
      </div>
    </div>
  );
}
