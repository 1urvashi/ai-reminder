// The local NLP date parser (localReminderParser.js) was written assuming
// browser-local semantics — it reads/writes a Date's LOCAL getters and
// expects them to reflect the user's own wall-clock time. That's true in
// the browser (mic button), but on the server (e.g. the WhatsApp webhook)
// the process's local timezone is the server's, whatever that happens to be
// configured as — never assume it's UTC. These helpers measure the actual
// server offset via the built-in getTimezoneOffset() (never guessed) and
// shift a reference Date so its LOCAL getters report a specific user's IANA
// timezone's wall clock instead, letting the same parser run correctly for
// that user from server-side code. zonedNaiveToUtc() reverses the shift
// afterwards to recover the true UTC instant.

function targetOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(date);
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
  const match = tzName.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  return sign * (hours * 60 + minutes) * 60000;
}

// getTimezoneOffset() returns (UTC - local) in minutes, so negate for
// (local - UTC), matching targetOffsetMs's sign convention.
function serverOffsetMs(date) {
  return -date.getTimezoneOffset() * 60000;
}

export function nowInZone(timeZone) {
  const now = new Date();
  return new Date(now.getTime() + (targetOffsetMs(now, timeZone) - serverOffsetMs(now)));
}

export function zonedNaiveToUtc(naiveDate, timeZone) {
  return new Date(naiveDate.getTime() - (targetOffsetMs(naiveDate, timeZone) - serverOffsetMs(naiveDate)));
}
