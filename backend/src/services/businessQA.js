import Reminder from '../models/Reminder.js';
import User from '../models/User.js';

// Free, rule-based Q&A for common business questions — no AI call, so it
// answers instantly and works even when Anthropic credits are exhausted.
// Runs BEFORE the AI/parsing chat flow: if the message looks like a
// question about status (not a new reminder to create), answer it
// directly from the database instead.

function matchesAny(text, words) {
  return words.some((w) => text.includes(w));
}

const TODAY_WORDS = ['today', 'aaj', 'આજ', 'आज'];
const TOMORROW_WORDS = ['kal', 'kale', 'kaal', 'કાલે', 'आवती काल', 'कल'];
const PAST_MARKERS = ['hatu', 'hata', 'hati', 'tha', 'thi', 'the', 'gayu', 'gayeli', 'gai'];
const PENDING_WORDS = ['pending', 'baki', 'बाकी', 'બાકી', 'due', 'kaam', 'kam', 'काम', 'કામ', 'task'];
const STAFF_WORDS = ['staff', 'team', 'employee', 'kone', 'કોણે', 'कौन'];
const WEEK_WORDS = ['week', 'adhavadiye', 'अठवाड़िये', 'અઠવાડિયે', 'हफ्ते'];
const STATS_WORDS = ['points', 'streak', 'badge', 'score'];
const QUESTION_MARKERS = [
  'kya', 'su', 'शु', 'क्या', 'शुं', 'शू', 'केटला', 'कितने',
  'ketla', 'ketli', 'ketlu', 'kitla', 'kitli', 'kitna', 'kitne', 'kitni', 'kai', 'shu', 'kem',
];

export function detectQuestionType(rawText) {
  const text = rawText.toLowerCase();
  const looksLikeQuestion = text.includes('?') || matchesAny(text, QUESTION_MARKERS);
  const hasPending = matchesAny(text, PENDING_WORDS);

  if (matchesAny(text, STAFF_WORDS) && hasPending) return 'staff_status';
  if (matchesAny(text, STATS_WORDS)) return 'my_stats';
  if (matchesAny(text, WEEK_WORDS) && hasPending) return 'week_reminders';
  if (matchesAny(text, TOMORROW_WORDS) && hasPending && looksLikeQuestion) {
    return matchesAny(text, PAST_MARKERS) ? 'yesterday_pending' : 'tomorrow_pending';
  }
  if (matchesAny(text, TODAY_WORDS) && (hasPending || looksLikeQuestion)) {
    return 'today_pending';
  }
  if (hasPending && looksLikeQuestion) return 'today_pending';
  return null;
}

function timeLabel(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function dayRange(offsetDays) {
  const start = new Date();
  start.setDate(start.getDate() + offsetDays);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function answerPendingForDay(userId, offsetDays, emptyMessage, heading) {
  const { start, end } = dayRange(offsetDays);
  const reminders = await Reminder.find({
    $or: [{ user: userId }, { assignedTo: userId }],
    completed: false,
    datetime: { $gte: start, $lte: end },
  })
    .sort({ datetime: 1 })
    .limit(10);
  if (reminders.length === 0) return emptyMessage;
  const lines = reminders.map((r) => `• ${r.title} (${timeLabel(r.datetime)})`);
  return `${heading} (${reminders.length}):\n${lines.join('\n')}`;
}

async function answerTodayPending(userId) {
  return answerPendingForDay(userId, 0, 'Aaje koi pending kaam baki nathi.', 'Aajna pending kaam ni yaadi');
}

async function answerTomorrowPending(userId) {
  return answerPendingForDay(userId, 1, 'Kale koi kaam baki nathi.', 'Kal na kaam ni yaadi');
}

async function answerYesterdayPending(userId) {
  return answerPendingForDay(
    userId,
    -1,
    'Gai kale koi kaam baki nahotu rahi gayu — badhu thai gayu hatu.',
    'Gai kale je kaam baki rahi gaya hata te'
  );
}

async function answerStaffStatus(userId) {
  const staff = await User.find({ role: 'staff', createdBy: userId }).select('name _id');
  if (staff.length === 0) return 'Tamare koi staff members nathi ume-rela.';
  const lines = [];
  for (const s of staff) {
    const pending = await Reminder.countDocuments({ assignedTo: s._id, completed: false });
    lines.push(`• ${s.name}: ${pending} pending kaam`);
  }
  return `Staff status:\n${lines.join('\n')}`;
}

async function answerWeekReminders(userId) {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60000);
  const reminders = await Reminder.find({
    $or: [{ user: userId }, { assignedTo: userId }],
    completed: false,
    datetime: { $gte: now, $lte: weekEnd },
  })
    .sort({ datetime: 1 })
    .limit(15);
  if (reminders.length === 0) return 'Aa week ma koi reminder nathi.';
  const lines = reminders.map((r) => `• ${r.title} — ${new Date(r.datetime).toLocaleDateString('en-IN')}`);
  return `Aa week na reminders (${reminders.length}):\n${lines.join('\n')}`;
}

async function answerMyStats(userId) {
  const user = await User.findById(userId).select('points badges');
  const totalCompleted = await Reminder.countDocuments({
    $or: [{ user: userId }, { assignedTo: userId }],
    completed: true,
  });
  const badgeCount = (user?.badges || []).length;
  return `Points: ${user?.points || 0}. Total completed tasks: ${totalCompleted}. Badges earned: ${badgeCount}.`;
}

export async function answerBusinessQuestion(questionType, userId) {
  switch (questionType) {
    case 'today_pending':
      return answerTodayPending(userId);
    case 'tomorrow_pending':
      return answerTomorrowPending(userId);
    case 'yesterday_pending':
      return answerYesterdayPending(userId);
    case 'staff_status':
      return answerStaffStatus(userId);
    case 'week_reminders':
      return answerWeekReminders(userId);
    case 'my_stats':
      return answerMyStats(userId);
    default:
      return null;
  }
}
