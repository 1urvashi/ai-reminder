import { anthropic, CLAUDE_MODEL } from '../config/anthropic.js';
import Reminder from '../models/Reminder.js';
import { describeNow } from './datetime.js';

const CREATE_REMINDER_TOOL = {
  name: 'create_reminder',
  description:
    'Create a reminder for the user once you have a clear title, date, and time. ' +
    'Call this as soon as those details are known — do not wait for the user to confirm.',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short description of what the reminder is for, e.g. "Call mom"',
      },
      datetime: {
        type: 'string',
        description:
          'The reminder date and time as an ISO 8601 string (e.g. "2026-07-15T17:00:00"), ' +
          'resolved from the current date/time given in the system prompt.',
      },
      recurrence: {
        type: 'string',
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
        description: 'How often the reminder repeats. Use "none" for a one-time reminder.',
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high'],
        description: 'How urgent the task is. Default to "normal" unless the user signals otherwise.',
      },
      category: {
        type: 'string',
        description: 'Optional short tag like "Work", "Health", "Bills". Leave empty if unclear.',
      },
      leadMinutes: {
        type: 'integer',
        description: 'Notify this many minutes before the due time. 0 means notify exactly at the due time.',
      },
    },
    required: ['title', 'datetime'],
  },
};

const MAX_ITERATIONS = 5;

function buildSystemPrompt(timeZone) {
  return (
    'You are a helpful assistant that helps the user create reminders through natural conversation. ' +
    `${describeNow(timeZone)} ` +
    'Resolve relative dates ("tomorrow", "next Monday", "in an hour") against the user\'s local time, ' +
    'and output the datetime as an ISO 8601 string that includes the user\'s UTC offset. ' +
    'When the user describes something they want to be reminded of, call the create_reminder tool ' +
    'with the title, resolved datetime, and recurrence. Pick up priority and category from what the ' +
    'user says (e.g. "urgent", "important" → high priority; "for work", "health checkup" → category) ' +
    'but never ask about them explicitly. Ask a brief clarifying question only if the time or task is ' +
    'genuinely ambiguous; otherwise make a reasonable assumption and proceed.'
  );
}

async function executeCreateReminder(userId, input) {
  const datetime = new Date(input.datetime);
  if (Number.isNaN(datetime.getTime())) {
    return { success: false, error: `Invalid datetime: ${input.datetime}` };
  }

  const reminder = await Reminder.create({
    user: userId,
    title: input.title,
    datetime,
    recurrence: input.recurrence || 'none',
    priority: input.priority || 'normal',
    category: input.category || '',
    leadMinutes: Number.isFinite(input.leadMinutes) ? input.leadMinutes : 0,
  });

  return {
    success: true,
    reminder: {
      id: reminder._id,
      title: reminder.title,
      datetime: reminder.datetime,
      recurrence: reminder.recurrence,
      priority: reminder.priority,
      category: reminder.category,
    },
  };
}

export async function runChatTurn(userId, history, userMessage, timeZone = 'UTC') {
  const messages = [...history, { role: 'user', content: userMessage }];
  const createdReminders = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(timeZone),
      tools: [CREATE_REMINDER_TOOL],
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      const reply = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
      return { reply, history: messages, reminders: createdReminders };
    }

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      if (block.name === 'create_reminder') {
        const result = await executeCreateReminder(userId, block.input);
        if (result.success) {
          createdReminders.push(result.reminder);
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
          is_error: !result.success,
        });
      } else {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Unknown tool: ${block.name}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  throw new Error('Chat turn exceeded maximum tool-use iterations');
}
