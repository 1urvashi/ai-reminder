import { anthropic, CLAUDE_MODEL } from '../config/anthropic.js';
import { formatInTimeZone } from './datetime.js';

// Builds the human-facing nudge text for a due reminder. Tries Claude for a
// warm, natural one-liner and falls back to a deterministic template when the
// API key is missing or the call fails — the reminder must fire either way.
// Handles both "coming up" (fired early via lead time) and "overdue" phrasing.

function isUpcoming(dueAt, now) {
  return dueAt instanceof Date && dueAt.getTime() > now.getTime();
}

function fallbackMessage(title, dueAt, timeZone, now) {
  const when = formatInTimeZone(dueAt, timeZone);
  if (isUpcoming(dueAt, now)) {
    return `This is a reminder that "${title}" is scheduled for ${when}. Please confirm once it has been completed.`;
  }
  return `This is a follow-up regarding "${title}", which was scheduled for ${when}. Kindly update its status at your earliest convenience.`;
}

function buildPrompt(title, dueAt, recurrence, timeZone, now) {
  const when = formatInTimeZone(dueAt, timeZone);
  const repeats = recurrence && recurrence !== 'none' ? ` It repeats ${recurrence}.` : '';
  const framing = isUpcoming(dueAt, now)
    ? `It is scheduled for ${when}. Ask, in a professional and courteous tone, whether they are prepared for it.`
    : `It was due at ${when}. Ask, in a professional and courteous tone, whether it has been completed or is still pending.`;
  return (
    'Write a single short, professionally-toned reminder notification (max 25 words) for this task, ' +
    'as a business assistant would phrase it — polite and formal, not casual or exclamatory. ' +
    `Task: "${title}".${repeats} ${framing} Return only the message text.`
  );
}

export async function generateNudge(title, dueAt, recurrence = 'none', options = {}) {
  if (typeof title !== 'string' || title.trim() === '') {
    throw new TypeError('generateNudge requires a non-empty title');
  }
  const { timeZone = 'UTC', now = new Date() } = options;

  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackMessage(title, dueAt, timeZone, now);
  }

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 100,
      messages: [{ role: 'user', content: buildPrompt(title, dueAt, recurrence, timeZone, now) }],
    });

    const text = (response.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .trim();

    return text.length > 0 ? text : fallbackMessage(title, dueAt, timeZone, now);
  } catch (err) {
    console.error('generateNudge failed, using fallback:', err.message);
    return fallbackMessage(title, dueAt, timeZone, now);
  }
}
