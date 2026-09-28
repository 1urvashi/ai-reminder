import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toClientError } from './aiError.js';

test('maps a low-credit 400 to a 402 with a user-safe message and technical detail', () => {
  const err = {
    status: 400,
    error: { error: { message: 'Your credit balance is too low to access the Anthropic API.' } },
  };
  const mapped = toClientError(err);
  assert.equal(mapped.status, 402);
  assert.match(mapped.detail, /out of credits/i);
  assert.doesNotMatch(mapped.message, /anthropic/i);
  assert.doesNotMatch(mapped.message, /console\./i);
});

test('maps 401 to an auth failure with detail hidden from the user-facing message', () => {
  const mapped = toClientError({ status: 401 });
  assert.equal(mapped.status, 502);
  assert.match(mapped.detail, /authentication/i);
  assert.doesNotMatch(mapped.message, /api.?key/i);
});

test('maps 429 to a rate-limit message', () => {
  const mapped = toClientError({ status: 429 });
  assert.equal(mapped.status, 503);
  assert.match(mapped.detail, /rate limited/i);
});

test('maps other API errors to 502 with the detail kept out of the user-facing message', () => {
  const mapped = toClientError({ status: 500, message: 'overloaded' });
  assert.equal(mapped.status, 502);
  assert.match(mapped.detail, /overloaded/);
  assert.doesNotMatch(mapped.message, /overloaded/);
});

test('returns null for a non-API error so it becomes a generic 500', () => {
  assert.equal(toClientError(new Error('mongo down')), null);
  assert.equal(toClientError(undefined), null);
});
