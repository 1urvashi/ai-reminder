// Minimal Twilio REST client built on the global fetch API — no SDK dependency.
// Every call is a no-op-safe: callers check isConfigured() first, and network
// failures throw so the channel dispatcher can log and continue.

const TWILIO_API_ROOT = 'https://api.twilio.com/2010-04-01';

export function isConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

function authHeader() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
}

async function postForm(resource, params) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const url = `${TWILIO_API_ROOT}/Accounts/${sid}/${resource}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Twilio ${resource} failed (${response.status}): ${data.message || 'unknown error'}`);
  }
  return data;
}

// Send a WhatsApp message. `to` must be a bare E.164 number; the whatsapp:
// prefix is added here and taken from TWILIO_WHATSAPP_FROM for the sender.
export async function sendWhatsApp(to, body) {
  if (typeof to !== 'string' || to.trim() === '') {
    throw new TypeError('sendWhatsApp requires a destination number');
  }
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) {
    throw new Error('TWILIO_WHATSAPP_FROM is not configured');
  }
  return postForm('Messages.json', {
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    To: `whatsapp:${to}`,
    Body: body,
  });
}

// Place an outbound voice call. Twilio fetches TwiML from `voiceUrl` when the
// call connects, which drives the conversational loop.
export async function createCall(to, voiceUrl) {
  if (typeof to !== 'string' || to.trim() === '') {
    throw new TypeError('createCall requires a destination number');
  }
  const from = process.env.TWILIO_VOICE_FROM;
  if (!from) {
    throw new Error('TWILIO_VOICE_FROM is not configured');
  }
  if (typeof voiceUrl !== 'string' || !voiceUrl.startsWith('http')) {
    throw new Error('createCall requires an absolute voiceUrl');
  }
  return postForm('Calls.json', { From: from, To: to, Url: voiceUrl });
}
