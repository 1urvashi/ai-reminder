import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotificationsContext } from '../context/NotificationsContext';

// Floating stack of unread reminder nudges, shown on every authenticated page.
// Polls in the background (via the shared NotificationsContext) and lets the
// user dismiss (mark read) or snooze the underlying reminder directly from the
// nudge.
export default function NotificationCenter() {
  const { user } = useAuth();
  const { notifications, markAllRead, markRead } = useNotificationsContext();

  if (!user || notifications.length === 0) {
    return null;
  }

  async function snooze(notification, minutes) {
    if (notification.reminderId) {
      try {
        await client.post(`/reminders/${notification.reminderId}/snooze`, { minutes });
      } catch {
        // best-effort; dismissing still clears the nudge
      }
    }
    await markRead(notification.id);
  }

  return (
    <div className="toast-stack">
      <div className="spread">
        <strong>Reminders ({notifications.length})</strong>
        <button type="button" className="btn btn-sm btn-ghost" onClick={markAllRead}>Dismiss all</button>
      </div>
      {notifications.map((n) => (
        <div key={n.id} className="toast">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{n.title}</div>
          <div className="text-sm" style={{ marginBottom: 8 }}>{n.message}</div>
          <div className="row">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => markRead(n.id)}>Got it</button>
            {n.reminderId && (
              <>
                <button type="button" className="btn btn-sm" onClick={() => snooze(n, 10)}>+10m</button>
                <button type="button" className="btn btn-sm" onClick={() => snooze(n, 60)}>+1h</button>
                <button type="button" className="btn btn-sm" onClick={() => snooze(n, 1440)}>Tomorrow</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
