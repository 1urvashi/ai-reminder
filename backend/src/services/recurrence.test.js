import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addOnePeriod,
  isValidRecurrence,
  nextOccurrence,
  computeRecurrenceUpdate,
} from './recurrence.js';

test('isValidRecurrence accepts known values and rejects others', () => {
  for (const value of ['none', 'daily', 'weekly', 'monthly', 'yearly']) {
    assert.equal(isValidRecurrence(value), true);
  }
  assert.equal(isValidRecurrence('hourly'), false);
  assert.equal(isValidRecurrence(''), false);
});

test('addOnePeriod advances daily and weekly without mutating input', () => {
  const base = new Date('2026-07-22T09:00:00Z');
  const daily = addOnePeriod(base, 'daily');
  const weekly = addOnePeriod(base, 'weekly');

  assert.equal(daily.toISOString(), '2026-07-23T09:00:00.000Z');
  assert.equal(weekly.toISOString(), '2026-07-29T09:00:00.000Z');
  assert.equal(base.toISOString(), '2026-07-22T09:00:00.000Z');
});

test('addOnePeriod advances monthly and yearly', () => {
  const base = new Date('2026-01-15T12:00:00Z');
  assert.equal(addOnePeriod(base, 'monthly').getUTCMonth(), 1); // February
  assert.equal(addOnePeriod(base, 'yearly').getUTCFullYear(), 2027);
});

test('addOnePeriod throws on non-recurring and invalid dates', () => {
  assert.throws(() => addOnePeriod(new Date('2026-01-01'), 'none'), RangeError);
  assert.throws(() => addOnePeriod(new Date('invalid'), 'daily'), TypeError);
});

test('nextOccurrence returns null for one-time reminders', () => {
  assert.equal(nextOccurrence(new Date('2026-07-22T09:00:00Z'), 'none'), null);
});

test('nextOccurrence returns the next future occurrence for a fresh daily reminder', () => {
  const due = new Date('2026-07-22T09:00:00Z');
  const now = new Date('2026-07-22T09:00:30Z'); // just fired
  const next = nextOccurrence(due, 'daily', now);
  assert.equal(next.toISOString(), '2026-07-23T09:00:00.000Z');
});

test('nextOccurrence skips all missed periods in one pass (app was offline)', () => {
  const due = new Date('2026-07-01T09:00:00Z');
  const now = new Date('2026-07-22T10:00:00Z'); // 21+ days later
  const next = nextOccurrence(due, 'daily', now);
  assert.ok(next.getTime() > now.getTime());
  assert.equal(next.toISOString(), '2026-07-23T09:00:00.000Z');
});

test('nextOccurrence rolls a weekly reminder forward past now', () => {
  const due = new Date('2026-07-01T09:00:00Z');
  const now = new Date('2026-07-20T09:00:00Z');
  const next = nextOccurrence(due, 'weekly', now);
  assert.ok(next.getTime() > now.getTime());
  assert.equal(next.toISOString(), '2026-07-22T09:00:00.000Z');
});

test('nextOccurrence throws on an invalid date', () => {
  assert.throws(() => nextOccurrence(new Date('nope'), 'daily'), TypeError);
});

test('computeRecurrenceUpdate completes a one-time reminder', () => {
  const now = new Date('2026-07-22T09:00:30Z');
  const upd = computeRecurrenceUpdate({ datetime: new Date('2026-07-22T09:00:00Z'), recurrence: 'none' }, now);
  assert.equal(upd.completed, true);
});

test('computeRecurrenceUpdate rolls a daily reminder to the next day', () => {
  const now = new Date('2026-07-22T09:00:30Z');
  const upd = computeRecurrenceUpdate(
    { datetime: new Date('2026-07-22T09:00:00Z'), recurrence: 'daily', recurrenceEnd: null, recurrenceCount: null },
    now
  );
  assert.equal(upd.completed, false);
  assert.equal(upd.datetime.toISOString(), '2026-07-23T09:00:00.000Z');
});

test('computeRecurrenceUpdate stops when the next occurrence passes recurrenceEnd', () => {
  const now = new Date('2026-07-22T09:00:30Z');
  const upd = computeRecurrenceUpdate(
    {
      datetime: new Date('2026-07-22T09:00:00Z'),
      recurrence: 'daily',
      recurrenceEnd: new Date('2026-07-22T23:59:00Z'),
      recurrenceCount: null,
    },
    now
  );
  assert.equal(upd.completed, true);
});

test('computeRecurrenceUpdate decrements recurrenceCount and stops at zero', () => {
  const now = new Date('2026-07-22T09:00:30Z');
  const base = { datetime: new Date('2026-07-22T09:00:00Z'), recurrence: 'daily', recurrenceEnd: null };

  const twoLeft = computeRecurrenceUpdate({ ...base, recurrenceCount: 2 }, now);
  assert.equal(twoLeft.completed, false);
  assert.equal(twoLeft.recurrenceCount, 1);

  const lastOne = computeRecurrenceUpdate({ ...base, recurrenceCount: 1 }, now);
  assert.equal(lastOne.completed, true);
  assert.equal(lastOne.recurrenceCount, 0);
});
