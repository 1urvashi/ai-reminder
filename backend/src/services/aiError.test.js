import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toClientError } from './aiError.js';

test('maps a low-credit 400 to a 402 with billing guidance', () => {
  const err = {
    status: 400,
    error: { error: { message: 'Your credit balance is too low to access the Anthropic API.' } },
  };
  const mapped = toClientError(err);
  assert.equal(mapped.status, 402);
  assert.match(mapped.message, /out of credits/i);
});

test('maps 401 to an auth message', () => {
  assert.equal(toClientError({ status: 401 }).status, 502);
  assert.match(toClientError({ status: 401 }).message, /authentication/i);
});

test('maps 429 to a rate-limit message', () => {
  assert.equal(toClientError({ status: 429 }).status, 503);
});

test('maps other API errors to 502 with the detail', () => {
  const mapped = toClientError({ status: 500, message: 'overloaded' });
  assert.equal(mapped.status, 502);
  assert.match(mapped.message, /overloaded/);
});

test('returns null for a non-API error so it becomes a generic 500', () => {
  assert.equal(toClientError(new Error('mongo down')), null);
  assert.equal(toClientError(undefined), null);
});
