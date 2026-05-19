import { useEffect, useMemo, useState } from 'react';
import { Bell, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function NotificationBell() {
  const navigate = useNavigate();
  const { isDirecteur } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');

  const loadNotifications = async ({ generate = true } = {}) => {
    try {
      const response = await notificationsAPI.list({ limit: 8, generate });
      setNotifications(response.data || []);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(() => loadNotifications({ generate: true }), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const resolveActionUrl = (url) => {
    if (!url || !isDirecteur) return url;
    if (url.startsWith('/client/contracts')) return url.replace('/client/contracts', '/director/contracts');
    if (url.startsWith('/client/invoices')) return url.replace('/client/invoices', '/director/invoices');
    return url;
  };

  const handleNotificationClick = async (notification) => {
    const notificationId = notification.id;
    setBusy(`read-${notificationId}`);
    try {
      await notificationsAPI.markRead(notificationId);
      await loadNotifications();
      setOpen(false);
    } finally {
      setBusy('');
    }
    const targetUrl = resolveActionUrl(notification.action_url);
    if (targetUrl) {
      navigate(targetUrl);
    }
  };

  const deleteAll = async () => {
    setBusy('delete-all');
    try {
      await notificationsAPI.deleteAll();
      await loadNotifications({ generate: false });
      setOpen(false);
    } finally {
      setBusy('');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen((value) => !value)} style={styles.bellButton}>
        <Bell size={16} />
        {unreadCount > 0 && <span style={styles.counter}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <div style={styles.menu}>
          <div style={styles.headerRow}>
            <div style={styles.header}><Wifi size={13} /> Temps réel</div>
            <button
              className="btn btn-danger btn-sm"
              onClick={deleteAll}
              disabled={busy === 'delete-all'}
              style={{ height: 30 }}
            >
              {busy === 'delete-all' ? '...' : 'Effacer tout'}
            </button>
          </div>
          {(notifications || []).length === 0 ? (
            <div style={styles.empty}>Aucune notification.</div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                style={{
                  ...styles.item,
                  opacity: notification.is_read ? 0.7 : 1,
                }}
                disabled={busy === `read-${notification.id}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div style={styles.title}>{notification.title}</div>
                <div style={styles.message}>{notification.message}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  menu: {
    position: 'absolute',
    top: 42,
    right: 0,
    width: 360,
    maxHeight: 420,
    overflowY: 'auto',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    zIndex: 9999,
    boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
    padding: 8,
  },
  bellButton: {
    position: 'relative',
  },
  counter: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 18,
    height: 18,
    padding: '0 5px',
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--danger)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-primary)',
    padding: '8px 10px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '4px 2px 6px',
  },
  empty: {
    fontSize: 12,
    color: 'var(--text-muted)',
    padding: '10px 12px',
  },
  item: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 8,
    cursor: 'pointer',
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  message: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
};
