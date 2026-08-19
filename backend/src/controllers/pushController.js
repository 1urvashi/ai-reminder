import PushSubscription from '../models/PushSubscription.js';
import { isConfigured } from '../services/pushService.js';

export async function getPublicKey(req, res) {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null, configured: isConfigured() });
}

export async function subscribe(req, res) {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ message: 'endpoint and keys.p256dh/keys.auth are required' });
  }
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { user: req.userId, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    { upsert: true }
  );
  res.status(201).json({ success: true });
}

export async function unsubscribe(req, res) {
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ message: 'endpoint is required' });
  }
  await PushSubscription.deleteOne({ endpoint, user: req.userId });
  res.json({ success: true });
}
