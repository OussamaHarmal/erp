import { useEffect, useState } from 'react';
import { FileText, Receipt, Bell, ShieldCheck, UploadCloud, Activity } from 'lucide-react';
import { analyticsAPI } from '../../services/api';

const ICONS = {
  contract: FileText,
  invoice: Receipt,
  notification: Bell,
  audit: ShieldCheck,
  document: UploadCloud,
};

export default function ActivityTimeline({ limit = 10, title = 'Activity Timeline' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.activityTimeline({ limit })
      .then((res) => setItems(res.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [limit]);

  return (
    <div className="modern-panel activity-panel">
      <div className="modern-panel-head">
        <div><h3>{title}</h3><span>Dernières actions clients, contrats, factures et documents</span></div>
        <Activity size={20} />
      </div>
      {loading ? <div className="activity-loading">Chargement...</div> : (
        <div className="activity-timeline">
          {items.length === 0 && <div className="empty-state compact">Aucune activité pour le moment.</div>}
          {items.map((item, index) => {
            const Icon = ICONS[item.kind] || Activity;
            return (
              <div className={`activity-item activity-${item.status || 'info'}`} key={`${item.kind}-${index}-${item.date}`}>
                <div className="activity-dot"><Icon size={16} /></div>
                <div className="activity-content">
                  <div className="activity-row">
                    <strong>{item.title}</strong>
                    <time>{item.date ? new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</time>
                  </div>
                  <p>{item.message}</p>
                  {item.amount ? <em>{Number(item.amount).toLocaleString()} MAD</em> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
