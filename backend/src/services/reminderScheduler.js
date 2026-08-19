import Reminder from '../models/Reminder.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { generateNudge } from './nudgeService.js';
import { computeRecurrenceUpdate } from './recurrence.js';
import { dispatchExternalChannels } from './channels.js';

// Background automation: on each tick it finds reminders whose time has passed
// and that have not yet been notified for the current occurrence, then creates
// an AI nudge and either completes (one-time) or rolls forward (recurring).

const DEFAULT_INTERVAL_MS = 60 * 1000;
const MAX_PER_TICK = 100;

let timer = null;
let running = false;

// A reminder needs a nudge when its effective fire time (datetime minus the
// lead-minutes) has passed and the current occurrence has not been fired yet
// (firedAt is null or predates the current datetime).
async function findDueReminders(now) {
  return Reminder.find({
    completed: false,
    $expr: {
      $and: [
        { $lte: [{ $subtract: ['$datetime', { $multiply: ['$leadMinutes', 60000] }] }, now] },
        { $or: [{ $eq: ['$firedAt', null] }, { $lt: ['$firedAt', '$datetime'] }] },
      ],
    },
  })
    .sort({ datetime: 1 })
    .limit(MAX_PER_TICK);
}

async function fireReminder(reminder, now) {
  // Nudge whoever the reminder is FOR — the assignee if it was handed to a
  // staff member, otherwise the creator themself.
  const recipientId = reminder.assignedTo || reminder.user;
  const user = await User.findById(recipientId);
  const timeZone = user?.timezone || 'UTC';
  const message = await generateNudge(reminder.title, reminder.datetime, reminder.recurrence, {
    timeZone,
    now,
  });

  await Notification.create({
    user: recipientId,
    reminder: reminder._id,
    title: reminder.title,
    message,
    dueAt: reminder.datetime,
  });

  if (user) {
    await dispatchExternalChannels(user, reminder.title, message, reminder._id);
  }

  reminder.firedAt = now;

  // Recurring reminders roll forward to their next occurrence right away —
  // they don't sit in a "missed" state. One-time reminders stay pending;
  // markMissedReminders() below is what flags them once overdue.
  if (reminder.recurrence !== 'none') {
    const update = computeRecurrenceUpdate(reminder, now);
    reminder.completed = update.completed;
    reminder.recurrenceCount = update.recurrenceCount;
    if (!update.completed) {
      reminder.datetime = update.datetime;
      reminder.firedAt = null;
      reminder.missed = false;
    }
  }

  await reminder.save();
}

// One-time reminders that passed their due time without being completed
// become "missed" so the UI can prompt the user to reschedule them. Recurring
// reminders are excluded — fireReminder() above rolls them forward instead of
// leaving them overdue.
async function markMissedReminders(now) {
  await Reminder.updateMany(
    { completed: false, missed: false, recurrence: 'none', datetime: { $lt: now } },
    { $set: { missed: true } }
  );
}

export async function runSchedulerTick(now = new Date()) {
  const due = await findDueReminders(now);
  let fired = 0;

  for (const reminder of due) {
    try {
      await fireReminder(reminder, now);
      fired += 1;
    } catch (err) {
      console.error(`Failed to fire reminder ${reminder._id}:`, err.message);
    }
  }

  await markMissedReminders(now);
  return fired;
}

export function startScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) {
    return timer;
  }

  timer = setInterval(async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const fired = await runSchedulerTick();
      if (fired > 0) {
        console.log(`Scheduler fired ${fired} reminder(s)`);
      }
    } catch (err) {
      console.error('Scheduler tick failed:', err.message);
    } finally {
      running = false;
    }
  }, intervalMs);

  console.log(`Reminder scheduler started (every ${intervalMs / 1000}s)`);
  return timer;
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
