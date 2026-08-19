import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatInTimeZone, offsetLabel, describeNow } from './datetime.js';

const INSTANT = new Date('2026-07-22T13:00:00Z');

test('formatInTimeZone renders the instant in the given zone', () => {
  const kolkata = formatInTimeZone(INSTANT, 'Asia/Kolkata');
  // 13:00 UTC is 18:30 in IST.
  assert.match(kolkata, /6:30/);
  assert.match(kolkata, /2026/);
});

test('formatInTimeZone falls back gracefully for a bad zone', () => {
  const out = formatInTimeZone(INSTANT, 'Not/AZone');
  assert.equal(typeof out, 'string');
  assert.ok(out.length > 0);
});

test('formatInTimeZone handles invalid dates', () => {
  assert.equal(formatInTimeZone('not-a-date', 'UTC'), 'an unknown time');
});

test('offsetLabel returns the UTC offset for the zone', () => {
  assert.equal(offsetLabel(INSTANT, 'Asia/Kolkata'), 'GMT+05:30');
  assert.match(offsetLabel(INSTANT, 'UTC'), /GMT/);
});

test('describeNow mentions the zone, local time, and UTC', () => {
  const text = describeNow('Asia/Kolkata', INSTANT);
  assert.match(text, /Asia\/Kolkata/);
  assert.match(text, /GMT\+05:30/);
  assert.match(text, /2026-07-22T13:00:00\.000Z/);
});
