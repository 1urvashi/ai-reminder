import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSignature, isValidTwilioSignature } from './twilioSignature.js';

// Reference vector adapted from Twilio's documented signing algorithm.
const TOKEN = '12345';
const URL = 'https://mycompany.com/myapp.php?foo=1&bar=2';
const PARAMS = { Digits: '1234', To: '+18005551212', From: '+14158675309', Caller: '+14158675309' };

test('computeSignature is deterministic and order-independent', () => {
  const a = computeSignature(TOKEN, URL, PARAMS);
  const reordered = { From: PARAMS.From, To: PARAMS.To, Caller: PARAMS.Caller, Digits: PARAMS.Digits };
  const b = computeSignature(TOKEN, URL, reordered);
  assert.equal(a, b);
  assert.equal(typeof a, 'string');
  assert.ok(a.length > 0);
});

test('isValidTwilioSignature accepts a correct signature', () => {
  const sig = computeSignature(TOKEN, URL, PARAMS);
  assert.equal(isValidTwilioSignature(TOKEN, sig, URL, PARAMS), true);
});

test('isValidTwilioSignature rejects a tampered body', () => {
  const sig = computeSignature(TOKEN, URL, PARAMS);
  const tampered = { ...PARAMS, Digits: '9999' };
  assert.equal(isValidTwilioSignature(TOKEN, sig, URL, tampered), false);
});

test('isValidTwilioSignature rejects wrong token, empty signature, and missing token', () => {
  const sig = computeSignature(TOKEN, URL, PARAMS);
  assert.equal(isValidTwilioSignature('wrong', sig, URL, PARAMS), false);
  assert.equal(isValidTwilioSignature(TOKEN, '', URL, PARAMS), false);
  assert.equal(isValidTwilioSignature('', sig, URL, PARAMS), false);
});
