import { isValidTwilioSignature } from '../services/twilioSignature.js';

const REJECT_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Unauthorized request.</Say><Hangup/></Response>';

// Rejects any voice webhook whose Twilio signature does not verify. Requires
// PUBLIC_BASE_URL so the signed URL matches exactly what Twilio requested.
export function verifyTwilioSignature(req, res, next) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return res.status(500).type('text/xml').send(REJECT_TWIML);
  }

  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const url = base + req.originalUrl;
  const signature = req.headers['x-twilio-signature'];

  if (!isValidTwilioSignature(authToken, signature, url, req.body)) {
    return res.status(403).type('text/xml').send(REJECT_TWIML);
  }
  next();
}
