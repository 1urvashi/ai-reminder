import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { useNotificationsContext } from '../context/NotificationsContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useI18n } from '../i18n/I18nContext';
import { startRingtone, stopRingtone } from '../utils/ringtone';

const SPEECH_LANG = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };

const SNOOZE_WORDS = ['snooze', 'later', 'pachi', 'baad', 'wait', 'thoडी वार', 'थोड़ी देर', 'ek min', 'थोड़ी वार', 'थोडी वार'];
const DONE_WORDS = [
  'done', 'complete', 'finished', 'thai gayu', 'thai gayi', 'ho gaya', 'ho gayi', 'karyu', 'kar liya',
  'kari lidhu', 'pura', 'pooru', 'yaad che', 'yad che', 'khabar che', 'samajh gaya', 'samji gayu',
  'thik che', 'theek hai', 'ok', 'okay', 'haa', 'ha yaad che',
  'याद है', 'याद रहा', 'हो गया', 'हो गई', 'कर लिया', 'ठीक है', 'समझ गया',
  'યાદ છે', 'ખબર છે', 'થઈ ગયું', 'કરી લીધું', 'ઠીક છે', 'સમજી ગયો',
];

// A clear "yes/done"-style reply should end the matter for good — it should
// not keep calling back about the same occurrence. Ambiguous replies fall
// back to "ack": the call still ends, but the reminder itself is left alone
// so a genuinely unhandled one-time reminder can still surface as "missed".
function matchIntent(text) {
  const lower = text.toLowerCase();
  if (SNOOZE_WORDS.some((w) => lower.includes(w))) return 'snooze';
  if (DONE_WORDS.some((w) => lower.includes(w))) return 'done';
  return 'ack';
}

function speak(text, lang, onEnd) {
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

// A free, in-browser "AI is calling you" experience: rings (synthesized tone,
// no audio asset), speaks the due reminder aloud via the browser's built-in
// Text-to-Speech, then listens for a spoken reply (Web Speech API) and takes
// a best-effort action (snooze/complete) based on simple keyword matching.
// Requires no third-party service and costs nothing to run.
export default function IncomingCallOverlay() {
  const { notifications, markRead } = useNotificationsContext();
  const { t, lang } = useI18n();
  const speech = useSpeechRecognition();

  const [queue, setQueue] = useState([]);
  const [phase, setPhase] = useState('ringing'); // ringing | speaking | listening | done
  const [heard, setHeard] = useState('');
  const presentedIds = useRef(new Set());

  const current = queue[0] || null;

  // Enqueue any notification we haven't shown a call for yet.
  useEffect(() => {
    const fresh = notifications.filter((n) => !presentedIds.current.has(n.id));
    if (fresh.length === 0) return;
    fresh.forEach((n) => presentedIds.current.add(n.id));
    setQueue((prev) => [...prev, ...fresh]);
  }, [notifications]);

  // Ring whenever a new call becomes current.
  useEffect(() => {
    if (current) {
      setPhase('ringing');
      setHeard('');
      startRingtone();
      return () => stopRingtone();
    }
    return undefined;
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function advanceQueue() {
    stopRingtone();
    speech.stop();
    window.speechSynthesis?.cancel();
    setQueue((prev) => prev.slice(1));
  }

  async function finishCall(notification, intent) {
    try {
      if (intent === 'snooze' && notification.reminderId) {
        await client.post(`/reminders/${notification.reminderId}/snooze`, { minutes: 10 });
      } else if (intent === 'done' && notification.reminderId) {
        await client.post(`/reminders/${notification.reminderId}/complete`);
      }
    } catch {
      // best-effort — the call still ends even if the follow-up action fails
    }
    try {
      await markRead(notification.id);
    } catch {
      // even if marking read fails (network blip), still advance the queue —
      // otherwise this same call could reappear after a page reload.
    }
    advanceQueue();
  }

  function handleAnswer() {
    stopRingtone();
    setPhase('speaking');
    const speechLang = SPEECH_LANG[lang] || 'en-IN';
    speak(current.message || current.title, speechLang, () => {
      setPhase('listening');
      speech.start(speechLang, (transcript) => {
        setHeard(transcript);
        const intent = matchIntent(transcript);
        setPhase('done');
        setTimeout(() => finishCall(current, intent), 1200);
      });
    });
  }

  function handleDecline() {
    if (!current) return;
    stopRingtone();
    window.speechSynthesis?.cancel();
    markRead(current.id);
    advanceQueue();
  }

  if (!current) return null;

  return (
    <div className="call-overlay">
      <div className="call-card">
        <div className={`call-avatar ${phase === 'ringing' ? 'pulse' : ''}`}>📞</div>
        <h2 style={{ margin: '0.5rem 0 0.2rem' }}>{current.title}</h2>
        <p className="muted text-sm">{current.message}</p>

        {phase === 'ringing' && (
          <div className="row" style={{ justifyContent: 'center', marginTop: '1.2rem' }}>
            <button type="button" className="btn btn-danger" onClick={handleDecline}>{t('call.decline')}</button>
            <button type="button" className="btn btn-primary" onClick={handleAnswer}>{t('call.answer')}</button>
          </div>
        )}
        {phase === 'speaking' && <p className="alert alert-info">{t('call.speaking')}</p>}
        {phase === 'listening' && (
          <p className="alert alert-info">
            🎙️ {t('call.listening')}
            {speech.interim && <> — “{speech.interim}”</>}
          </p>
        )}
        {phase === 'done' && (
          <p className="alert alert-ok">
            {heard ? <>{t('call.heardYouSay')} “{heard}”</> : t('call.acknowledged')}
          </p>
        )}
        {phase === 'listening' && !speech.supported && (
          <p className="muted text-sm">{t('call.noMic')}</p>
        )}
      </div>
    </div>
  );
}
