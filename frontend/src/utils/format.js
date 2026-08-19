// Format a stored UTC datetime in the user's timezone for display.
export function formatDateTime(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const options = { dateStyle: 'medium', timeStyle: 'short' };
  if (timeZone) {
    options.timeZone = timeZone;
  }
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function isOverdue(reminder) {
  return !reminder.completed && new Date(reminder.datetime).getTime() < Date.now();
}
