import User from '../models/User.js';
import Reminder from '../models/Reminder.js';

function dayKeyUTC(date) {
  return new Date(date).toISOString().slice(0, 10);
}

async function buildSummaryText(userId) {
  const todayKey = dayKeyUTC(new Date());
  const [pendingCount, missedCount, doneToday, staff] = await Promise.all([
    Reminder.countDocuments({ user: userId, completed: false, missed: false }),
    Reminder.countDocuments({ user: userId, missed: true, completed: false }),
    Reminder.countDocuments({
      user: userId,
      completed: true,
      datetime: { $gte: new Date(`${todayKey}T00:00:00.000Z`), $lt: new Date(`${todayKey}T23:59:59.999Z`) },
    }),
    User.find({ role: 'staff', createdBy: userId }).select('name'),
  ]);

  const lines = [`📋 Daily summary: ${pendingCount} pending, ${missedCount} missed, ${doneToday} completed today.`];
  for (const s of staff) {
    const [assignedPending, assignedDone] = await Promise.all([
      Reminder.countDocuments({ assignedTo: s._id, completed: false }),
      Reminder.countDocuments({ assignedTo: s._id, completed: true }),
    ]);
    lines.push(`• ${s.name}: ${assignedDone} done, ${assignedPending} pending`);
  }
  return lines.join('\n');
}

// Machine-to-machine endpoint (X-Api-Key, not a user JWT) for a scheduled
// automation tool like n8n to pull a ready-to-send WhatsApp summary and the
// user's phone number, without needing a short-lived login token.
// Identify the user via ?email= since this app is multi-tenant (every
// registered person has their own reminders).
export async function getDailySummary(req, res) {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ message: 'email query param is required' });
  }
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    return res.status(404).json({ message: 'No user with that email' });
  }

  const message = await buildSummaryText(user._id);
  res.json({
    message,
    phone: user.phone || null,
    whatsappEnabled: Boolean(user.channels?.whatsapp),
  });
}
