import { runChatTurn } from '../services/chatService.js';
import { toClientError } from '../services/aiError.js';
import { parseReminderText } from '../services/localReminderParser.js';
import { detectQuestionType, answerBusinessQuestion } from '../services/businessQA.js';
import { nowInZone, zonedNaiveToUtc } from '../services/timezoneUtil.js';
import User from '../models/User.js';
import Reminder from '../models/Reminder.js';

// When the AI is unavailable (out of credits, misconfigured, rate-limited),
// fall back to free local parsing so the reminder still gets created instead
// of the whole chat failing. parseReminderText works in naive wall-clock
// time, so "now" and the parsed result must both be anchored to the user's
// timezone (not the server's) — otherwise "5pm" silently becomes 5pm
// server-local, which then displays as some other time entirely once
// converted to the user's zone.
async function fallbackToLocalParsing(userId, message, timeZone, mapped) {
  const fields = parseReminderText(message, nowInZone(timeZone));
  const datetime = zonedNaiveToUtc(fields.datetime, timeZone);
  const reminder = await Reminder.create({
    user: userId,
    title: fields.title,
    datetime,
    recurrence: fields.recurrence,
    priority: fields.priority,
  });
  const when = new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(reminder.datetime);
  return {
    reply:
      `⚡ ${mapped.message} I've created "${reminder.title}" for ${when} using simple text ` +
      `understanding instead — please check it and edit if it's not quite right.`,
    history: [],
    reminders: [
      {
        id: reminder._id,
        title: reminder.title,
        datetime: reminder.datetime,
        recurrence: reminder.recurrence,
        priority: reminder.priority,
      },
    ],
  };
}

export async function sendMessage(req, res) {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ message: 'message is required' });
  }
  if (history !== undefined && !Array.isArray(history)) {
    return res.status(400).json({ message: 'history must be an array' });
  }

  const user = await User.findById(req.userId).select('timezone');
  const timeZone = user?.timezone || 'UTC';

  // Status questions ("what's pending today?", "staff status?") are
  // answered directly from the database — free, instant, and works even
  // when the AI is unavailable. Only reminder-creation requests fall
  // through to the AI/local-parsing flow below.
  const questionType = detectQuestionType(message);
  if (questionType) {
    const answer = await answerBusinessQuestion(questionType, req.userId);
    if (answer) {
      return res.json({ reply: answer, history: history || [], reminders: [] });
    }
  }

  try {
    const result = await runChatTurn(req.userId, history || [], message, timeZone);
    res.json(result);
  } catch (err) {
    const mapped = toClientError(err);
    if (!mapped) {
      throw err; // let the global handler return a generic 500
    }
    console.error('AI unavailable, falling back to local parsing:', mapped.detail);
    try {
      const fallback = await fallbackToLocalParsing(req.userId, message, timeZone, mapped);
      res.json(fallback);
    } catch {
      res.status(mapped.status).json({ message: mapped.message });
    }
  }
}
