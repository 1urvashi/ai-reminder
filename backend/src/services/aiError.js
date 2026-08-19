// Maps an Anthropic SDK error into a client-friendly { status, message }.
// Returns null when the error is not a recognised upstream AI error, so the
// caller can fall through to a generic 500.

function extractMessage(err) {
  return err?.error?.error?.message || err?.message || 'unknown AI error';
}

export function toClientError(err) {
  const status = typeof err?.status === 'number' ? err.status : null;
  if (status === null) {
    return null;
  }

  const detail = extractMessage(err);
  if (status === 400 && /credit balance is too low/i.test(detail)) {
    return {
      status: 402,
      message:
        'The AI service is out of credits. Add credits to your Anthropic account ' +
        '(console.anthropic.com → Plans & Billing) to use chat and voice reminders. ' +
        'You can still create reminders manually on the dashboard.',
    };
  }
  if (status === 401) {
    return { status: 502, message: 'AI service authentication failed. Check ANTHROPIC_API_KEY.' };
  }
  if (status === 429) {
    return { status: 503, message: 'AI service is rate limited. Please try again in a moment.' };
  }
  return { status: 502, message: `AI service error: ${detail}` };
}
