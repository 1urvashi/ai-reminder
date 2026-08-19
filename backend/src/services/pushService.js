import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

export function isConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function ensureConfigured() {
  if (configured || !isConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

// Sends a browser push notification to every device the user has subscribed
// from. Best-effort per device: a dead subscription (410/404) is removed so
// it stops being retried; other failures are just logged.
export async function sendPushToUser(userId, payload) {
  if (!isConfigured()) {
    return { sent: 0 };
  }
  ensureConfigured();

  const subs = await PushSubscription.find({ user: userId });
  if (subs.length === 0) {
    return { sent: 0 };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          body
        );
        sent += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          console.error('Push send failed:', err.message);
        }
      }
    })
  );
  return { sent };
}
