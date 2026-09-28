// A raw IANA timezone string (e.g. "Asia/Kolkata") means nothing to a
// non-technical user asked to type it correctly. This turns it into a
// pick-from-a-list experience instead.

export const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

export function getAllTimezones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return COMMON_TIMEZONES;
  }
}

export function timezoneLabel(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(
      new Date()
    );
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value || '';
    return `${tz.replace(/_/g, ' ')} (${offset})`;
  } catch {
    return tz;
  }
}
