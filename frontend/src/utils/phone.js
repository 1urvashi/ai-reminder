// Backend requires strict E.164 (+countrycode...), but a non-technical user
// will just type their 10-digit number. Auto-add the country code they most
// likely meant instead of rejecting it — this app's primary audience is in
// India, so default to +91 when no "+" is present.
export function normalizePhone(raw) {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return trimmed;
  return `+91${digits}`;
}
