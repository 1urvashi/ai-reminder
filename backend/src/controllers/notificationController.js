import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { testNotifications } from '../services/channels.js';

const MAX_RESULTS = 50;

function serialize(notification) {
  return {
    id: notification._id,
    reminderId: notification.reminder,
    title: notification.title,
    message: notification.message,
    dueAt: notification.dueAt,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}

export async function listNotifications(req, res) {
  const onlyUnread = req.query.unread === 'true';
  const filter = { user: req.userId };
  if (onlyUnread) {
    filter.read = false;
  }

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(MAX_RESULTS);

  const unreadCount = await Notification.countDocuments({ user: req.userId, read: false });
  res.json({ notifications: notifications.map(serialize), unreadCount });
}

export async function markRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    { read: true },
    { new: true }
  );
  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }
  res.json({ notification: serialize(notification) });
}

export async function sendTest(req, res) {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const report = await testNotifications(user);
  res.json({ report });
}

export async function markAllRead(req, res) {
  const result = await Notification.updateMany(
    { user: req.userId, read: false },
    { read: true }
  );
  res.json({ success: true, modified: result.modifiedCount });
}
