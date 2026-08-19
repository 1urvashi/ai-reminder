// Timezone helpers built on the Intl API. All reminders are stored as UTC
// instants; these helpers render and describe them in a user's IANA timezone
// (e.g. "Asia/Kolkata") for prompts, nudges, and display.

function safeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') {
    return 'UTC';
  }
  try {
    // Throws RangeError for an unknown zone; validates before use.
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

// Human-readable local time, e.g. "Jul 22, 2026, 6:30 PM".
export function formatInTimeZone(date, timeZone) {
  const when = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(when.getTime())) {
    return 'an unknown time';
  }
  const zone = safeZone(timeZone);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(when);
}

// The UTC offset label for a zone at a given instant, e.g. "GMT+05:30".
export function offsetLabel(date, timeZone) {
  const zone = safeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const found = parts.find((part) => part.type === 'timeZoneName');
  return found ? found.value : 'GMT';
}

// A sentence describing "now" in the user's zone, for grounding the AI when it
// resolves relative dates like "tomorrow at 9".
export function describeNow(timeZone, now = new Date()) {
  const zone = safeZone(timeZone);
  return (
    `The user's timezone is ${zone}. The current local time there is ` +
    `${formatInTimeZone(now, zone)} (${offsetLabel(now, zone)}). ` +
    `In UTC that is ${now.toISOString()}.`
  );
}
