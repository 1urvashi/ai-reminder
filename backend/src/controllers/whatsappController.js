import User from '../models/User.js';
import Reminder from '../models/Reminder.js';
import { messageReply } from '../services/twiml.js';
import { parseReminderText } from '../services/localReminderParser.js';
import { detectQuestionType, answerBusinessQuestion } from '../services/businessQA.js';
import { nowInZone, zonedNaiveToUtc } from '../services/timezoneUtil.js';

function normalizePhone(whatsappFrom) {
  // Twilio sends "whatsapp:+919876543210" — we store plain E.164.
  return String(whatsappFrom || '').replace(/^whatsapp:/, '').trim();
}

// Inbound WhatsApp message handler — the "WhatsApp-first" experience. Works
// entirely within Twilio's free-form reply window (the sender messaged us
// first), so no WhatsApp Business template approval is needed, unlike
// pushing reminder notifications outbound. Text "remind me to..." to create
// a reminder, or ask a status question ("aaj pending kaam su chhe?").
export async function incoming(req, res) {
  const body = String(req.body.Body || '').trim();
  const phone = normalizePhone(req.body.From);

  if (!phone) {
    return res.type('text/xml').send(messageReply('Could not read your phone number. Please try again.'));
  }

  const user = await User.findOne({ phone });
  if (!user) {
    return res
      .type('text/xml')
      .send(
        messageReply(
          `This WhatsApp number isn't linked to a RemindAI account yet. Add ${phone} as your phone number in Profile → Account, then message again.`
        )
      );
  }

  if (!body) {
    return res.type('text/xml').send(messageReply('Send me something like "remind me to call mom tomorrow at 6pm".'));
  }

  const timeZone = user.timezone || 'UTC';

  const questionType = detectQuestionType(body);
  if (questionType) {
    const answer = await answerBusinessQuestion(questionType, user._id);
    if (answer) {
      return res.type('text/xml').send(messageReply(answer));
    }
  }

  try {
    const fields = parseReminderText(body, nowInZone(timeZone));
    const datetime = zonedNaiveToUtc(fields.datetime, timeZone);
    const reminder = await Reminder.create({
      user: user._id,
      title: fields.title,
      datetime,
      recurrence: fields.recurrence,
      priority: fields.priority,
    });
    const when = new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(
      reminder.datetime
    );
    return res
      .type('text/xml')
      .send(
        messageReply(
          `Confirmed: a reminder for "${reminder.title}" has been scheduled for ${when}. Please message again for any further request.`
        )
      );
  } catch (err) {
    console.error('WhatsApp inbound parse failed:', err.message);
    return res
      .type('text/xml')
      .send(
        messageReply(
          'This request could not be understood. Please try a format such as: "remind me to X tomorrow at 6pm".'
        )
      );
  }
}
