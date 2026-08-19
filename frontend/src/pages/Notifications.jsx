import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/format';

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const tz = user?.timezone;

  function load() {
    client
      .get('/notifications')
      .then((res) => setItems(res.data.notifications))
      .catch(() => setError('Could not load notifications'));
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id) {
    try {
      await client.post(`/notifications/${id}/read`);
      load();
    } catch {
      setError('Could not update notification');
    }
  }

  async function markAllRead() {
    try {
      await client.post('/notifications/read-all');
      load();
    } catch {
      setError('Could not update notifications');
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Activity</h1>
        {items.some((n) => !n.read) && (
          <button type="button" className="btn btn-sm" onClick={markAllRead}>Mark all read</button>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {items.map((n) => (
        <div
          key={n.id}
          className="rem-item"
          style={{ borderLeftColor: n.read ? 'var(--border)' : 'var(--primary)' }}
        >
          <div className="spread">
            <span className="rem-title">{n.title}</span>
            {!n.read && <span className="badge" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>new</span>}
          </div>
          <div className="text-sm">{n.message}</div>
          <div className="rem-meta spread">
            <span>Sent {formatDateTime(n.createdAt, tz)}</span>
            {!n.read && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => markRead(n.id)}>Mark read</button>
            )}
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="muted">No notifications yet.</p>}
    </div>
  );
}
