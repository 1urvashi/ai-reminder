import crypto from 'node:crypto';

// Twilio request signing (https://www.twilio.com/docs/usage/security).
// The signature is HMAC-SHA1 over the full request URL followed by each POST
// parameter name and value, sorted by name and concatenated, base64-encoded.

export function computeSignature(authToken, url, params) {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

export function isValidTwilioSignature(authToken, signature, url, params) {
  if (!authToken || typeof signature !== 'string' || signature === '') {
    return false;
  }
  const expected = computeSignature(authToken, url, params || {});
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
