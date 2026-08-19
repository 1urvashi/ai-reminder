import { isConfigured as twilioConfigured, sendWhatsApp, createCall } from './twilioClient.js';
import { isConfigured as emailConfigured, sendEmail } from './emailClient.js';
import { isConfigured as pushConfigured, sendPushToUser } from './pushService.js';

// Decides which external channels a due reminder should reach and dispatches to
// each. In-app notifications are created by the scheduler regardless; this only
// handles email, WhatsApp and voice calls. Each channel is best-effort: a
// failure is logged and does not block the others.

function voiceWebhookUrl(reminderId) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) {
    return null;
  }
  return `${base}/api/voice/incoming?reminderId=${encodeURIComponent(String(reminderId))}`;
}

async function dispatchEmail(user, title, message) {
  if (!user.channels?.email || !user.email || !emailConfigured()) {
    return false;
  }
  await sendEmail(user.email, `Reminder: ${title}`, message);
  return true;
}

async function dispatchWhatsApp(user, message) {
  if (!user.channels?.whatsapp || !user.phone || !twilioConfigured()) {
    return false;
  }
  await sendWhatsApp(user.phone, message);
  return true;
}

async function dispatchCall(user, reminderId) {
  if (!user.channels?.call || !user.phone || !twilioConfigured()) {
    return false;
  }
  const url = voiceWebhookUrl(reminderId);
  if (!url) {
    console.error('Cannot place call: PUBLIC_BASE_URL is not configured');
    return false;
  }
  await createCall(user.phone, url);
  return true;
}

async function dispatchPush(user, title, message, reminderId) {
  if (!user.channels?.push || !pushConfigured()) {
    return false;
  }
  const { sent } = await sendPushToUser(user._id, {
    title,
    body: message,
    reminderId: reminderId ? String(reminderId) : null,
  });
  return sent > 0;
}

// user: reminder owner (email, phone, channels). title/message: the nudge.
// reminderId: used to build the voice webhook URL for the conversational call.
export async function dispatchExternalChannels(user, title, message, reminderId) {
  const result = { email: false, whatsapp: false, call: false, push: false };
  if (!user) {
    return result;
  }

  const attempts = [
    ['email', () => dispatchEmail(user, title, message)],
    ['whatsapp', () => dispatchWhatsApp(user, message)],
    ['call', () => dispatchCall(user, reminderId)],
    ['push', () => dispatchPush(user, title, message, reminderId)],
  ];

  for (const [channel, run] of attempts) {
    try {
      result[channel] = await run();
    } catch (err) {
      console.error(`${channel} dispatch failed:`, err.message);
    }
  }
  return result;
}

// Sends a test message immediately and returns a detailed per-channel report so
// the user can see exactly whether each channel worked and, if not, why.
// Voice is not dialled on test — only its readiness is reported.
export async function testNotifications(user) {
  const message = 'RemindAI test: your notifications are working! 🎉';
  const report = {};

  // Email
  if (!user.channels?.email) {
    report.email = { status: 'off', detail: 'Email channel is turned off in your profile.' };
  } else if (!emailConfigured()) {
    report.email = { status: 'not_configured', detail: 'Set SMTP_* in the backend .env.' };
  } else {
    try {
      await sendEmail(user.email, 'RemindAI test', message);
      report.email = { status: 'sent', detail: `Sent to ${user.email}.` };
    } catch (err) {
      report.email = { status: 'error', detail: err.message };
    }
  }

  // WhatsApp
  if (!user.channels?.whatsapp) {
    report.whatsapp = { status: 'off', detail: 'WhatsApp channel is turned off in your profile.' };
  } else if (!twilioConfigured()) {
    report.whatsapp = { status: 'not_configured', detail: 'Set TWILIO_* in the backend .env.' };
  } else if (!user.phone) {
    report.whatsapp = { status: 'no_phone', detail: 'Add your phone number in your profile.' };
  } else {
    try {
      await sendWhatsApp(user.phone, message);
      report.whatsapp = { status: 'sent', detail: `Sent to ${user.phone}. Check WhatsApp.` };
    } catch (err) {
      report.whatsapp = { status: 'error', detail: err.message };
    }
  }

  // Voice (readiness only — we do not place a call during a test)
  const callReady = user.channels?.call && twilioConfigured() && user.phone && process.env.PUBLIC_BASE_URL;
  report.call = user.channels?.call
    ? { status: callReady ? 'ready' : 'not_ready', detail: callReady ? 'Will call when a reminder fires.' : 'Needs Twilio, phone, and PUBLIC_BASE_URL.' }
    : { status: 'off', detail: 'Call channel is turned off in your profile.' };

  // Push (browser notification)
  if (!user.channels?.push) {
    report.push = { status: 'off', detail: 'Push channel is turned off in your profile.' };
  } else if (!pushConfigured()) {
    report.push = { status: 'not_configured', detail: 'Set VAPID_* in the backend .env.' };
  } else {
    try {
      const { sent } = await sendPushToUser(user._id, { title: 'RemindAI test', body: message });
      report.push = sent > 0
        ? { status: 'sent', detail: `Sent to ${sent} subscribed device(s).` }
        : { status: 'not_ready', detail: 'No subscribed device — enable push notifications in your browser first.' };
    } catch (err) {
      report.push = { status: 'error', detail: err.message };
    }
  }

  return report;
}
