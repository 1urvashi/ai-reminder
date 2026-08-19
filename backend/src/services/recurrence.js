// Pure date helpers for recurring reminders. No I/O, no dependencies — kept
// separate so the roll-forward logic can be unit tested in isolation.

const RECURRENCE_VALUES = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

// Cap on how many periods we will skip forward in one call. Guards against an
// unbounded loop if the app was offline for a very long time (Power-of-10 R2).
const MAX_ADVANCE_STEPS = 5000;

export function isValidRecurrence(recurrence) {
  return RECURRENCE_VALUES.includes(recurrence);
}

// Advance a Date by exactly one period of the given recurrence.
// Returns a new Date; never mutates the input.
export function addOnePeriod(date, recurrence) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('addOnePeriod requires a valid Date');
  }

  const next = new Date(date.getTime());
  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      throw new RangeError(`Cannot advance non-recurring value: ${recurrence}`);
  }
  return next;
}

// Given the current occurrence time, return the next occurrence strictly after
// `after` (defaults to now). If the app missed several periods, this skips all
// past ones in a single, bounded pass. Returns null for one-time reminders.
export function nextOccurrence(date, recurrence, after = new Date()) {
  if (recurrence === 'none' || !isValidRecurrence(recurrence)) {
    return null;
  }
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('nextOccurrence requires a valid Date');
  }

  let next = addOnePeriod(date, recurrence);
  let steps = 0;
  while (next.getTime() <= after.getTime() && steps < MAX_ADVANCE_STEPS) {
    next = addOnePeriod(next, recurrence);
    steps += 1;
  }
  return next;
}

// Decides a reminder's state immediately after it has fired. Pure: takes the
// current fields, returns the next fields. Recurring reminders roll forward
// unless a recurrenceEnd date or a recurrenceCount (remaining fires including
// the one that just happened) stops them.
export function computeRecurrenceUpdate(reminder, now = new Date()) {
  const { datetime, recurrence, recurrenceEnd = null, recurrenceCount = null } = reminder;

  if (recurrence === 'none' || !isValidRecurrence(recurrence)) {
    return { completed: true, datetime, recurrenceCount };
  }

  let remaining = recurrenceCount;
  if (typeof remaining === 'number') {
    remaining -= 1;
    if (remaining <= 0) {
      return { completed: true, datetime, recurrenceCount: 0 };
    }
  }

  const next = nextOccurrence(datetime, recurrence, now);
  if (recurrenceEnd && next.getTime() > new Date(recurrenceEnd).getTime()) {
    return { completed: true, datetime, recurrenceCount: remaining };
  }
  return { completed: false, datetime: next, recurrenceCount: remaining };
}
