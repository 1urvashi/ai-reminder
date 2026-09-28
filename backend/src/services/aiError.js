// Maps an Anthropic SDK error into a client-friendly { status, message, detail }.
// `message` is safe to show an ordinary end user (no product/vendor names,
// no config keys, no URLs) — `detail` carries the technical diagnosis and is
// meant for server-side logs only. Returns null when the error is not a
// recognised upstream AI error, so the caller can fall through to a generic
// 500.

function extractMessage(err) {
  return err?.error?.error?.message || err?.message || 'unknown AI error';
}

const FALLBACK_NOTICE = 'The smart AI assistant is temporarily unavailable, so a simpler helper created this instead.';

export function toClientError(err) {
  const status = typeof err?.status === 'number' ? err.status : null;
  if (status === null) {
    return null;
  }

  const detail = extractMessage(err);
  if (status === 400 && /credit balance is too low/i.test(detail)) {
    return {
      status: 402,
      message: FALLBACK_NOTICE,
      detail: `Anthropic account is out of credits (console.anthropic.com -> Plans & Billing). ${detail}`,
    };
  }
  if (status === 401) {
    return {
      status: 502,
      message: FALLBACK_NOTICE,
      detail: `AI service authentication failed. Check ANTHROPIC_API_KEY. ${detail}`,
    };
  }
  if (status === 429) {
    return {
      status: 503,
      message: FALLBACK_NOTICE,
      detail: `AI service is rate limited. ${detail}`,
    };
  }
  return {
    status: 502,
    message: FALLBACK_NOTICE,
    detail: `AI service error: ${detail}`,
  };
}
