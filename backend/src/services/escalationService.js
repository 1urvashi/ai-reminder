import Reminder from '../models/Reminder.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { dispatchExternalChannels } from './channels.js';
import { sendWhatsApp, isConfigured as twilioConfigured } from './twilioClient.js';

// The escalation ladder: how many minutes since the last nudge before the
// NEXT stage fires. Stage 1-2 re-nudge the user through their own channels
// (push/WhatsApp/call/email); the final stage alerts a backup contact —
// nobody else in the free-reminder-app space does this, and it's the whole
// point for someone who forgets even after being reminded repeatedly.
const STAGES = [
  { stage: 1, afterMinutes: 5 },
  { stage: 2, afterMinutes: 15 },
  { stage: 3, afterMinutes: 30 }, // final: notify caregiver, then stop
];

function minutesSince(date, now) {
  return (now.getTime() - new Date(date).getTime()) / 60000;
}

async function notifyCaregiver(reminder, user) {
  const caregiver = user?.caregiver;
  if (!caregiver?.phone || !twilioConfigured()) {
    return false;
  }
  const message = `⚠️ ${user.name || 'Someone'} hasn't responded to a reminder: "${reminder.title}". They may need a check-in.`;
  try {
    await sendWhatsApp(caregiver.phone, message);
    return true;
  } catch (err) {
    console.error('Caregiver notification failed:', err.message);
    return false;
  }
}

export async function runEscalationTick(now = new Date()) {
  const candidates = await Reminder.find({
    escalate: true,
    completed: false,
    firedAt: { $ne: null },
    escalationStage: { $lt: STAGES.length },
  }).limit(200);

  let escalated = 0;

  for (const reminder of candidates) {
    const nextStage = STAGES[reminder.escalationStage];
    if (!nextStage) continue;

    const sinceRef = reminder.lastEscalatedAt || reminder.firedAt;
    if (minutesSince(sinceRef, now) < nextStage.afterMinutes) continue;

    const recipientId = reminder.assignedTo || reminder.user;
    const user = await User.findById(recipientId);
    if (!user) continue;

    try {
      if (nextStage.stage < STAGES.length) {
        const message = `⏰ Still waiting: "${reminder.title}" — please mark it done or snooze it.`;
        await Notification.create({
          user: recipientId,
          reminder: reminder._id,
          title: `Still pending: ${reminder.title}`,
          message,
          dueAt: reminder.datetime,
        });
        await dispatchExternalChannels(user, `Still pending: ${reminder.title}`, message, reminder._id);
      } else {
        await notifyCaregiver(reminder, user);
      }
      reminder.escalationStage = nextStage.stage;
      reminder.lastEscalatedAt = now;
      await reminder.save();
      escalated += 1;
    } catch (err) {
      console.error(`Escalation failed for reminder ${reminder._id}:`, err.message);
    }
  }

  return escalated;
}
