import { useEffect, useMemo, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { isDirecteur } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationsAPI.list({ limit: 200, generate: true });
      setNotifications(response.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const markRead = async (id) => {
    await notificationsAPI.markRead(id);
    await loadNotifications();
  };

  const markAllRead = async () => {
    await notificationsAPI.markAllRead();
    await loadNotifications();
  };

  const deleteAll = async () => {
    await notificationsAPI.deleteAll();
    // reload without regenerating immediately
    setLoading(true);
    const response = await notificationsAPI.list({ limit: 200, generate: false });
    setNotifications(response.data || []);
    setLoading(false);
  };

  const resolveActionUrl = (url) => {
    if (!url || !isDirecteur) return url;
    if (url.startsWith('/client/contracts')) return url.replace('/client/contracts', '/director/contracts');
    if (url.startsWith('/client/invoices')) return url.replace('/client/invoices', '/director/invoices');
    return url;
  };

  const openNotification = async (notification) => {
    await notificationsAPI.markRead(notification.id);
    const targetUrl = resolveActionUrl(notification.action_url);
    if (targetUrl) {
      navigate(targetUrl);
      return;
    }
    await loadNotifications();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unreadCount} non lue(s)</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={markAllRead}>
            <Check size={15} /> Tout marquer comme lu
          </button>
          <button className="btn btn-danger" onClick={deleteAll}>
            Effacer tout
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <Bell size={48} />
          <h3>Aucune notification</h3>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className="card"
              style={{ borderLeft: notification.is_read ? '3px solid var(--border)' : '3px solid var(--primary)', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => openNotification(notification)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{notification.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{notification.message}</div>
                </div>
                {!notification.is_read && (
                  <button className="btn btn-secondary btn-sm" onClick={(event) => { event.stopPropagation(); markRead(notification.id); }}>
                    Marquer lu
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
