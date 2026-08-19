import Reminder from '../models/Reminder.js';
import { startVoiceSession, buildOpening, runVoiceTurn } from '../services/voiceService.js';
import { gatherSpeech, sayAndHangup } from '../services/twiml.js';

function turnActionUrl(reminderId) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return `${base}/api/voice/turn?reminderId=${encodeURIComponent(String(reminderId))}`;
}

// First webhook Twilio hits when the call connects: greet and start listening.
export async function incoming(req, res) {
  const reminderId = req.query.reminderId;
  const callSid = req.body.CallSid;

  if (!reminderId || !callSid) {
    return res.type('text/xml').send(sayAndHangup('Missing call details. Goodbye.'));
  }

  const reminder = await Reminder.findById(reminderId);
  if (!reminder) {
    return res.type('text/xml').send(sayAndHangup('Sorry, that reminder no longer exists. Goodbye.'));
  }

  await startVoiceSession(callSid, reminder);
  res.type('text/xml').send(gatherSpeech(buildOpening(reminder), turnActionUrl(reminderId)));
}

// Subsequent webhooks: run the caller's speech through the AI and reply.
export async function turn(req, res) {
  const reminderId = req.query.reminderId;
  const callSid = req.body.CallSid;
  const speech = req.body.SpeechResult || '';

  if (!callSid) {
    return res.type('text/xml').send(sayAndHangup('Missing call details. Goodbye.'));
  }

  const { reply, end } = await runVoiceTurn(callSid, speech);
  if (end) {
    return res.type('text/xml').send(sayAndHangup(reply));
  }
  res.type('text/xml').send(gatherSpeech(reply, turnActionUrl(reminderId)));
}
