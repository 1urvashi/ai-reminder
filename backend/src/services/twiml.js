// Small helpers for building Twilio Voice TwiML responses as strings. All
// user/AI text is XML-escaped so arbitrary reminder content is safe to embed.

export function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Speak `text`, then listen for the caller's speech and POST the result to
// `actionUrl`. If nothing is heard, the trailing line ends the call politely.
export function gatherSpeech(text, actionUrl) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Response>' +
    `<Gather input="speech" action="${escapeXml(actionUrl)}" method="POST" ` +
    'speechTimeout="auto" language="en-IN">' +
    `<Say>${escapeXml(text)}</Say>` +
    '</Gather>' +
    '<Say>Sorry, I did not hear anything. Goodbye.</Say>' +
    '<Hangup/>' +
    '</Response>'
  );
}

// Speak `text` and end the call.
export function sayAndHangup(text) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Response>' +
    `<Say>${escapeXml(text)}</Say>` +
    '<Hangup/>' +
    '</Response>'
  );
}
