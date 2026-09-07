import mongoose from 'mongoose';
import Reminder from '../models/Reminder.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { isValidRecurrence } from '../services/recurrence.js';
import { dispatchExternalChannels } from '../services/channels.js';
import { awardTaskCompletion, awardHabitStreak, BADGE_LABELS } from '../services/gamification.js';

const PRIORITIES = ['low', 'normal', 'high'];
const STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
const MAX_SNOOZE_MINUTES = 60 * 24 * 30; // 30 days

function serialize(reminder) {
  return {
    id: reminder._id,
    title: reminder.title,
    datetime: reminder.datetime,
    recurrence: reminder.recurrence,
    completed: reminder.completed,
    leadMinutes: reminder.leadMinutes,
    priority: reminder.priority,
    category: reminder.category,
    recurrenceEnd: reminder.recurrenceEnd,
    recurrenceCount: reminder.recurrenceCount,
    notes: reminder.notes,
    subtasks: (reminder.subtasks || []).map((s) => ({ id: s._id, title: s.title, done: s.done })),
    missed: reminder.missed,
    rescheduleCount: reminder.rescheduleCount,
    assignedTo: reminder.assignedTo,
    status: reminder.status,
    order: reminder.order,
    habit: reminder.habit,
    streak: reminder.streak,
    longestStreak: reminder.longestStreak,
    lastCheckinDate: reminder.lastCheckinDate,
    escalate: reminder.escalate,
    escalationStage: reminder.escalationStage,
    location: reminder.location,
  };
}

// Validates and copies the optional reminder fields shared by create/update.
// Returns { update } on success or { error } with a message string.
function readOptionalFields(body) {
  const update = {};
  if (body.recurrence !== undefined) {
    if (!isValidRecurrence(body.recurrence)) {
      return { error: 'invalid recurrence' };
    }
    update.recurrence = body.recurrence;
  }
  if (body.leadMinutes !== undefined) {
    const lead = Number(body.leadMinutes);
    if (!Number.isFinite(lead) || lead < 0) {
      return { error: 'leadMinutes must be a non-negative number' };
    }
    update.leadMinutes = lead;
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) {
      return { error: 'invalid priority' };
    }
    update.priority = body.priority;
  }
  if (body.category !== undefined) {
    update.category = String(body.category).trim();
  }
  if (body.recurrenceEnd !== undefined) {
    if (body.recurrenceEnd === null || body.recurrenceEnd === '') {
      update.recurrenceEnd = null;
    } else {
      const end = new Date(body.recurrenceEnd);
      if (Number.isNaN(end.getTime())) {
        return { error: 'recurrenceEnd must be a valid date' };
      }
      update.recurrenceEnd = end;
    }
  }
  if (body.recurrenceCount !== undefined) {
    if (body.recurrenceCount === null || body.recurrenceCount === '') {
      update.recurrenceCount = null;
    } else {
      const count = Number(body.recurrenceCount);
      if (!Number.isInteger(count) || count < 1) {
        return { error: 'recurrenceCount must be a positive integer' };
      }
      update.recurrenceCount = count;
    }
  }
  if (body.notes !== undefined) {
    update.notes = String(body.notes).trim();
  }
  if (body.subtasks !== undefined) {
    if (!Array.isArray(body.subtasks)) {
      return { error: 'subtasks must be an array' };
    }
    const subtasks = [];
    for (const item of body.subtasks) {
      if (!item || typeof item.title !== 'string' || item.title.trim() === '') {
        return { error: 'each subtask needs a non-empty title' };
      }
      subtasks.push({ title: item.title.trim(), done: Boolean(item.done) });
    }
    update.subtasks = subtasks;
  }
  if (body.habit !== undefined) {
    update.habit = Boolean(body.habit);
  }
  if (body.escalate !== undefined) {
    update.escalate = Boolean(body.escalate);
  }
  if (body.location !== undefined) {
    if (body.location === null) {
      update.location = null;
    } else {
      const { lat, lng, radiusMeters, label } = body.location;
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
        return { error: 'location.lat must be between -90 and 90' };
      }
      if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
        return { error: 'location.lng must be between -180 and 180' };
      }
      const radius = radiusMeters === undefined ? 200 : Number(radiusMeters);
      if (!Number.isFinite(radius) || radius <= 0 || radius > 20000) {
        return { error: 'location.radiusMeters must be between 1 and 20000' };
      }
      update.location = { lat: latNum, lng: lngNum, radiusMeters: radius, label: String(label || '').trim() };
    }
  }
  return { update };
}

// Awards gamification points/badges to whoever completed a task (creator or
// assignee — either can be the one doing the work). Fires a Notification for
// any newly-earned badge.
async function awardCompletionPoints(userId, reminder) {
  const totalCompleted = await Reminder.countDocuments({
    $or: [{ user: userId }, { assignedTo: userId }],
    completed: true,
  });
  const actor = await User.findById(userId);
  if (!actor) return;
  const { newBadges } = await awardTaskCompletion(actor, { priority: reminder.priority, totalCompleted });
  for (const badge of newBadges) {
    await Notification.create({
      user: userId,
      title: `🏆 Badge earned: ${badge.label}`,
      message: `You earned the "${badge.label}" badge. Keep going!`,
      dueAt: new Date(),
    });
  }
}

export async function listReminders(req, res) {
  // A leftover `$or: undefined` here (instead of just omitting the key) used
  // to throw a Mongoose CastError — assigning `undefined` to a query key
  // doesn't remove it, and Mongoose's schema-aware cast rejects `undefined`
  // for an Array-typed operator like $or. Build a fresh filter per branch.
  const filter = req.query.assignedTo
    // Manager/admin/viewer filtering the board down to one team member's items.
    ? { assignedTo: req.query.assignedTo, user: req.userId }
    : { $or: [{ user: req.userId }, { assignedTo: req.userId }] };
  const reminders = await Reminder.find(filter).sort({ status: 1, order: 1, datetime: 1 });
  res.json({ reminders: reminders.map(serialize) });
}

export async function createReminder(req, res) {
  const { title, datetime, assignedTo } = req.body;

  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ message: 'title is required' });
  }
  const when = new Date(datetime);
  if (Number.isNaN(when.getTime())) {
    return res.status(400).json({ message: 'datetime must be a valid date' });
  }
  const optional = readOptionalFields(req.body);
  if (optional.error) {
    return res.status(400).json({ message: optional.error });
  }

  const reminder = await Reminder.create({
    user: req.userId,
    title: title.trim(),
    datetime: when,
    assignedTo: assignedTo || null,
    ...optional.update,
  });
  res.status(201).json({ reminder: serialize(reminder) });
}

// Both the creator and whoever a reminder is assigned to may act on it
// (update, snooze, complete). Only the creator can delete or reassign.
function ownedOrAssigned(req) {
  return { _id: req.params.id, $or: [{ user: req.userId }, { assignedTo: req.userId }] };
}

export async function updateReminder(req, res) {
  const optional = readOptionalFields(req.body);
  if (optional.error) {
    return res.status(400).json({ message: optional.error });
  }
  const update = optional.update;

  if (req.body.title !== undefined) {
    if (typeof req.body.title !== 'string' || req.body.title.trim() === '') {
      return res.status(400).json({ message: 'title must be a non-empty string' });
    }
    update.title = req.body.title.trim();
  }
  if (req.body.completed !== undefined) {
    update.completed = Boolean(req.body.completed);
    if (update.completed) {
      update.missed = false;
      update.status = 'completed';
    }
  }
  const reminder = await Reminder.findOne(ownedOrAssigned(req));
  if (!reminder) {
    return res.status(404).json({ message: 'Reminder not found' });
  }
  if (req.body.assignedTo !== undefined && String(reminder.user) === req.userId) {
    update.assignedTo = req.body.assignedTo || null; // only the creator may reassign
  }

  if (req.body.datetime !== undefined) {
    const when = new Date(req.body.datetime);
    if (Number.isNaN(when.getTime())) {
      return res.status(400).json({ message: 'datetime must be a valid date' });
    }
    update.datetime = when;
    update.firedAt = null; // rescheduling re-arms the reminder
    if (reminder.missed) {
      update.rescheduleCount = reminder.rescheduleCount + 1;
    }
    update.missed = false;
  }

  Object.assign(reminder, update);
  await reminder.save();
  res.json({ reminder: serialize(reminder) });
}

export async function snoozeReminder(req, res) {
  const minutes = Number(req.body.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_SNOOZE_MINUTES) {
    return res.status(400).json({ message: 'minutes must be between 1 and 43200' });
  }

  const reminder = await Reminder.findOne(ownedOrAssigned(req));
  if (!reminder) {
    return res.status(404).json({ message: 'Reminder not found' });
  }

  if (reminder.missed) {
    reminder.rescheduleCount += 1;
  }
  reminder.datetime = new Date(Date.now() + minutes * 60000);
  reminder.firedAt = null;
  reminder.completed = false;
  reminder.missed = false;
  reminder.status = 'pending';
  reminder.escalationStage = 0;
  reminder.lastEscalatedAt = null;
  await reminder.save();
  res.json({ reminder: serialize(reminder) });
}

// Called when the user responds to an "AI is calling" prompt at all — even
// an unclear or "not yet" reply — so a reminder with escalation enabled
// stops re-nudging simply because it was answered. This intentionally does
// NOT mark the task done; only completeReminder does that. Without this,
// any reply that didn't match a "done"/"snooze" keyword left the reminder
// fully untouched, so the escalation engine kept firing again exactly as if
// the call had never been answered.
export async function acknowledgeReminder(req, res) {
  const reminder = await Reminder.findOne(ownedOrAssigned(req));
  if (!reminder) {
    return res.status(404).json({ message: 'Reminder not found' });
  }
  // Reset to stage 0 but stamp lastEscalatedAt as *now*, not null — null
  // would make the escalation tick fall back to the original firedAt (still
  // in the past), so it would immediately re-escalate again on the very
  // next tick instead of giving a fresh grace period from this response.
  reminder.escalationStage = 0;
  reminder.lastEscalatedAt = new Date();
  await reminder.save();
  res.json({ reminder: serialize(reminder) });
}

export async function completeReminder(req, res) {
  const reminder = await Reminder.findOne(ownedOrAssigned(req));
  if (!reminder) {
    return res.status(404).json({ message: 'Reminder not found' });
  }
  const wasCompleted = reminder.completed;
  reminder.completed = true;
  reminder.missed = false;
  reminder.status = 'completed';
  reminder.escalationStage = 0;
  reminder.lastEscalatedAt = null;
  await reminder.save();

  if (!wasCompleted) {
    await awardCompletionPoints(req.userId, reminder);
  }

  res.json({ reminder: serialize(reminder) });
}

// Habit check-in: increments the streak once per day, independent of the
// completed/status lifecycle so recurring reminders keep firing normally.
function habitGapAllowedDays(recurrence) {
  if (recurrence === 'weekly') return 7;
  if (recurrence === 'monthly') return 31;
  if (recurrence === 'yearly') return 366;
  return 1; // daily or non-recurring habits reset if a day is skipped
}

export async function checkinHabit(req, res) {
  const reminder = await Reminder.findOne(ownedOrAssigned(req));
  if (!reminder) {
    return res.status(404).json({ message: 'Reminder not found' });
  }
  if (!reminder.habit) {
    return res.status(400).json({ message: 'This reminder is not marked as a habit' });
  }

  const now = new Date();
  const todayKey = dayKeyUTC(now);
  if (reminder.lastCheckinDate === todayKey) {
    return res.json({ reminder: serialize(reminder), alreadyCheckedIn: true, newBadges: [] });
  }

  if (reminder.lastCheckinDate) {
    const gapDays = Math.round(
      (new Date(`${todayKey}T00:00:00.000Z`) - new Date(`${reminder.lastCheckinDate}T00:00:00.000Z`)) / 86400000
    );
    reminder.streak = gapDays <= habitGapAllowedDays(reminder.recurrence) ? reminder.streak + 1 : 1;
  } else {
    reminder.streak = 1;
  }
  reminder.longestStreak = Math.max(reminder.longestStreak, reminder.streak);
  reminder.lastCheckinDate = todayKey;
  await reminder.save();

  let newBadges = [];
  const actor = await User.findById(req.userId);
  if (actor) {
    const result = await awardHabitStreak(actor, reminder.streak);
    newBadges = result.newBadges;
    for (const badge of newBadges) {
      await Notification.create({
        user: req.userId,
        title: `🏆 Badge earned: ${badge.label}`,
        message: `You earned the "${badge.label}" badge. Keep going!`,
        dueAt: now,
      });
    }
  }

  res.json({ reminder: serialize(reminder), newBadges });
}

// The Kanban drag-and-drop endpoint: moves a reminder to a new column/position.
// Dragging into "completed" also marks it done; dragging out of it reopens it.
export async function updateReminderStatus(req, res) {
  const { status, order } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ message: 'invalid status' });
  }

  const reminder = await Reminder.findOne(ownedOrAssigned(req));
  if (!reminder) {
    return res.status(404).json({ message: 'Reminder not found' });
  }

  const fromStatus = reminder.status;
  reminder.status = status;
  if (typeof order === 'number') {
    reminder.order = order;
  }
  reminder.completed = status === 'completed';
  reminder.missed = false;
  if (reminder.completed) {
    reminder.escalationStage = 0;
    reminder.lastEscalatedAt = null;
  }
  await reminder.save();

  if (fromStatus !== 'completed' && status === 'completed') {
    await awardCompletionPoints(req.userId, reminder);
  }

  // If the assignee (not the creator) moved it, let the creator know —
  // in-app always; WhatsApp/call best-effort if they've enabled it.
  if (fromStatus !== status && String(reminder.user) !== req.userId) {
    const creator = await User.findById(reminder.user);
    const mover = await User.findById(req.userId);
    if (creator) {
      const message = `${mover?.name || 'Someone'}: "${reminder.title}" moved from ${fromStatus.replace('_', ' ')} to ${status.replace('_', ' ')}.`;
      await Notification.create({
        user: creator._id,
        title: `${mover?.name || 'Someone'} updated a reminder`,
        message,
        reminder: reminder._id,
        dueAt: reminder.datetime,
      });
      dispatchExternalChannels(creator, `${mover?.name || 'Someone'} updated a reminder`, message, reminder._id).catch(
        (err) => console.error('Creator channel dispatch failed:', err.message)
      );
    }
  }

  res.json({ reminder: serialize(reminder) });
}

export async function deleteReminder(req, res) {
  const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!reminder) {
    return res.status(404).json({ message: 'Reminder not found' });
  }
  res.json({ success: true });
}

// Bulk-move every currently missed reminder to a new time. Body: optional
// { datetime } (ISO string, applied to all); defaults to one hour from now.
export async function rescheduleMissed(req, res) {
  let target = new Date(Date.now() + 60 * 60000);
  if (req.body.datetime !== undefined) {
    target = new Date(req.body.datetime);
    if (Number.isNaN(target.getTime())) {
      return res.status(400).json({ message: 'datetime must be a valid date' });
    }
  }

  const missedReminders = await Reminder.find({ user: req.userId, missed: true, completed: false });
  const updated = [];
  for (const reminder of missedReminders) {
    reminder.datetime = target;
    reminder.firedAt = null;
    reminder.missed = false;
    reminder.escalationStage = 0;
    reminder.lastEscalatedAt = null;
    reminder.rescheduleCount += 1;
    await reminder.save();
    updated.push(serialize(reminder));
  }
  res.json({ reminders: updated });
}

export async function getCategories(req, res) {
  const categories = await Reminder.distinct('category', { user: req.userId, category: { $ne: '' } });
  res.json({ categories: categories.sort() });
}

function dayKeyUTC(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export async function getStats(req, res) {
  const now = new Date();
  const todayKey = dayKeyUTC(now);
  const userObjectId = new mongoose.Types.ObjectId(req.userId);

  const [pendingCount, missedCount, doneToday, byCategoryRaw, byPriorityRaw, recentCompleted] =
    await Promise.all([
      Reminder.countDocuments({ user: req.userId, completed: false, missed: false }),
      Reminder.countDocuments({ user: req.userId, missed: true, completed: false }),
      Reminder.countDocuments({
        user: req.userId,
        completed: true,
        datetime: { $gte: new Date(`${todayKey}T00:00:00.000Z`), $lt: new Date(`${todayKey}T23:59:59.999Z`) },
      }),
      Reminder.aggregate([
        { $match: { user: userObjectId, category: { $ne: '' } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Reminder.aggregate([
        { $match: { user: userObjectId } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Reminder.find({ user: req.userId, completed: true })
        .select('datetime')
        .sort({ datetime: -1 })
        .limit(400),
    ]);

  const completedDays = new Set(recentCompleted.map((r) => dayKeyUTC(r.datetime)));
  let streak = 0;
  const cursor = new Date(now);
  // A day still "counts" toward the streak until it's over — don't break the
  // streak just because today hasn't had a completion yet.
  if (!completedDays.has(dayKeyUTC(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (completedDays.has(dayKeyUTC(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const me = await User.findById(req.userId).select('points badges');

  const staff = await User.find({ role: 'staff', createdBy: req.userId }).select('name');
  let byStaff = [];
  if (staff.length > 0) {
    const byStaffRaw = await Reminder.aggregate([
      { $match: { user: userObjectId, assignedTo: { $ne: null } } },
      { $group: { _id: { assignedTo: '$assignedTo', status: '$status' }, count: { $sum: 1 } } },
    ]);
    byStaff = staff.map((s) => {
      const rows = byStaffRaw.filter((r) => String(r._id.assignedTo) === String(s._id));
      const counts = { pending: 0, in_progress: 0, completed: 0, blocked: 0 };
      for (const r of rows) counts[r._id.status] = r.count;
      return { staffId: s._id, name: s.name, ...counts };
    });
  }

  res.json({
    pendingCount,
    missedCount,
    doneTodayCount: doneToday,
    streak,
    byCategory: byCategoryRaw.map((r) => ({ category: r._id, count: r.count })),
    byPriority: byPriorityRaw.map((r) => ({ priority: r._id, count: r.count })),
    byStaff,
    points: me?.points || 0,
    badges: (me?.badges || []).map((key) => ({ key, label: BADGE_LABELS[key] || key })),
  });
}
