import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, gatherSpeech, sayAndHangup } from './twiml.js';

test('escapeXml escapes all five XML special characters', () => {
  assert.equal(escapeXml(`a & b < c > d " e ' f`), 'a &amp; b &lt; c &gt; d &quot; e &apos; f');
});

test('gatherSpeech embeds escaped text and the action URL', () => {
  const xml = gatherSpeech('Did you finish A & B?', 'https://x.io/api/voice/turn?reminderId=1');
  assert.match(xml, /<Gather input="speech"/);
  assert.match(xml, /Did you finish A &amp; B\?/);
  assert.match(xml, /action="https:\/\/x\.io\/api\/voice\/turn\?reminderId=1"/);
  assert.match(xml, /<\/Response>$/);
});

test('sayAndHangup speaks the text and hangs up', () => {
  const xml = sayAndHangup('Goodbye');
  assert.match(xml, /<Say>Goodbye<\/Say>/);
  assert.match(xml, /<Hangup\/>/);
});
