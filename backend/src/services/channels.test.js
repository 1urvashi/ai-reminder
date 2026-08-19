import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchExternalChannels } from './channels.js';

const SAVED_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...SAVED_ENV };
});

function clearProviders() {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.EMAIL_FROM;
}

test('returns all-false when no providers are configured', async () => {
  clearProviders();
  const user = { email: 'a@b.com', phone: '+911234567890', channels: { email: true, whatsapp: true, call: true } };
  const result = await dispatchExternalChannels(user, 'Standup', 'hi', 'abc');
  assert.deepEqual(result, { email: false, whatsapp: false, call: false, push: false });
});

test('returns all-false for a null user', async () => {
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'token';
  const result = await dispatchExternalChannels(null, 'Standup', 'hi', 'abc');
  assert.deepEqual(result, { email: false, whatsapp: false, call: false, push: false });
});

test('skips channels the user has turned off even when configured', async () => {
  clearProviders();
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'token';
  const user = { email: 'a@b.com', phone: '+911234567890', channels: { email: false, whatsapp: false, call: false } };
  const result = await dispatchExternalChannels(user, 'Standup', 'hi', 'abc');
  assert.deepEqual(result, { email: false, whatsapp: false, call: false, push: false });
});

test('skips WhatsApp/call when the user has no phone number', async () => {
  clearProviders();
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'token';
  const user = { email: '', phone: '', channels: { email: true, whatsapp: true, call: true } };
  const result = await dispatchExternalChannels(user, 'Standup', 'hi', 'abc');
  assert.deepEqual(result, { email: false, whatsapp: false, call: false, push: false });
});
