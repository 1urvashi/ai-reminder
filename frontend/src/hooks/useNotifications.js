import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';

const POLL_INTERVAL_MS = 30 * 1000;

// Fire a native browser notification if the user has granted permission.
function showBrowserNotification(item) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  try {
    // eslint-disable-next-line no-new -- Notification is used for its side effect
    new Notification(item.title || 'Reminder', { body: item.message, tag: item.id });
  } catch (err) {
    console.error('Browser notification failed:', err.message);
  }
}

// Polls the backend for unread reminder nudges while the user is logged in,
// raises a browser notification for each newly seen one, and exposes helpers
// to mark them read.
export function useNotifications(enabled) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenIds = useRef(new Set());

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await client.get('/notifications', { params: { unread: true } });
      const items = res.data.notifications || [];
      for (const item of items) {
        if (!seenIds.current.has(item.id)) {
          seenIds.current.add(item.id);
          showBrowserNotification(item);
        }
      }
      setNotifications(items);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err.message);
    }
  }, []);

  const markRead = useCallback(async (id) => {
    if (!id) return;
    await client.post(`/notifications/${id}/read`);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await client.post('/notifications/read-all');
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    fetchNotifications();
    const timer = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, fetchNotifications]);

  return { notifications, unreadCount, markRead, markAllRead, refresh: fetchNotifications };
}
