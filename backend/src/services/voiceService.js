import { anthropic, CLAUDE_MODEL } from '../config/anthropic.js';
import Reminder from '../models/Reminder.js';
import CallSession from '../models/CallSession.js';

const MAX_ITERATIONS = 5;

const VOICE_TOOLS = [
  {
    name: 'reschedule_reminder',
    description: 'Move the reminder to a new date/time when the caller asks to be reminded later.',
    input_schema: {
      type: 'object',
      properties: {
        datetime: { type: 'string', description: 'New reminder time as an ISO 8601 string.' },
      },
      required: ['datetime'],
    },
  },
  {
    name: 'mark_done',
    description: 'Mark the reminder complete when the caller confirms they have finished the task.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'end_conversation',
    description: 'End the call once the caller is done or says goodbye.',
    input_schema: { type: 'object', properties: {} },
  },
];

function buildSystemPrompt(reminder) {
  return (
    'You are calling the user on the phone to follow up on a reminder. Keep every reply to one or two ' +
    'short spoken sentences. Ask one question at a time. ' +
    `The reminder is "${reminder.title}", which was due at ${reminder.datetime.toISOString()}. ` +
    `The current time is ${new Date().toISOString()}. ` +
    'If they have done it, call mark_done. If they want a later reminder, resolve the time and call ' +
    'reschedule_reminder. When the conversation is finished, call end_conversation. Be warm and brief.'
  );
}

export function buildOpening(reminder) {
  return `Hello! This is your reminder assistant. You asked to be reminded about ${reminder.title}. Have you done it, or would you like me to remind you later?`;
}

export async function startVoiceSession(callSid, reminder) {
  return CallSession.create({
    callSid,
    reminder: reminder._id,
    user: reminder.user,
    messages: [{ role: 'assistant', content: buildOpening(reminder) }],
  });
}

async function executeVoiceTool(reminder, name, input) {
  if (name === 'reschedule_reminder') {
    const when = new Date(input?.datetime);
    if (Number.isNaN(when.getTime())) {
      return { result: { success: false, error: 'invalid datetime' }, end: false };
    }
    reminder.datetime = when;
    reminder.firedAt = null;
    reminder.completed = false;
    await reminder.save();
    return { result: { success: true, datetime: when.toISOString() }, end: false };
  }
  if (name === 'mark_done') {
    reminder.completed = true;
    await reminder.save();
    return { result: { success: true }, end: false };
  }
  if (name === 'end_conversation') {
    return { result: { success: true }, end: true };
  }
  return { result: { success: false, error: `unknown tool: ${name}` }, end: false };
}

function collectText(content) {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join(' ')
    .trim();
}

async function processToolUse(reminder, content) {
  const toolResults = [];
  let end = false;
  for (const block of content) {
    if (block.type !== 'tool_use') {
      continue;
    }
    const outcome = await executeVoiceTool(reminder, block.name, block.input);
    end = end || outcome.end;
    toolResults.push({
      type: 'tool_result',
      tool_use_id: block.id,
      content: JSON.stringify(outcome.result),
      is_error: !outcome.result.success,
    });
  }
  return { toolResults, end };
}

export async function runVoiceTurn(callSid, speech) {
  const session = await CallSession.findOne({ callSid });
  if (!session || session.ended) {
    return { reply: 'This call has already ended. Goodbye.', end: true };
  }
  const reminder = await Reminder.findById(session.reminder);
  if (!reminder) {
    return { reply: 'Sorry, I could not find that reminder. Goodbye.', end: true };
  }

  const messages = [...session.messages, { role: 'user', content: speech || '(no response)' }];
  let end = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      system: buildSystemPrompt(reminder),
      tools: VOICE_TOOLS,
      messages,
    });
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      session.messages = messages;
      session.ended = end;
      await session.save();
      return { reply: collectText(response.content) || 'Okay.', end };
    }

    const { toolResults, end: turnEnd } = await processToolUse(reminder, response.content);
    end = end || turnEnd;
    messages.push({ role: 'user', content: toolResults });
  }

  session.messages = messages;
  session.ended = true;
  await session.save();
  return { reply: 'Thanks, talk to you later. Goodbye.', end: true };
}
