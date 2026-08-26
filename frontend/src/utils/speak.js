// Free, built-in browser Text-to-Speech (no API, no cost) — shared by the
// "AI is calling" overlay and the reminder form's voice-confirmation loop.
export function speak(text, lang, onEnd) {
  if (typeof window.speechSynthesis === 'undefined') {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}
