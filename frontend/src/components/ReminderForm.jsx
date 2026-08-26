import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useWhisperTranscription } from '../hooks/useWhisperTranscription';
import { parseReminderText } from '../utils/parseReminderText';
import { speak } from '../utils/speak';
import { formatDateTime } from '../utils/format';

const WHISPER_LANG = { en: 'en', hi: 'hi', gu: 'gu' };
const TTS_LANG = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };

const YES_WORDS = ['yes', 'ha', 'haa', 'yeah', 'yep', 'correct', 'sahi', 'हाँ', 'हा', 'ठीक है', 'સાચું', 'હા', 'બરાબર'];
const NO_WORDS = ['no', 'na', 'nahi', 'nope', 'wrong', 'galat', 'नहीं', 'ना', 'ના', 'નહીં', 'ખોટું'];

const EMPTY = {
  title: '',
  datetime: '',
  recurrence: 'none',
  leadMinutes: 0,
  priority: 'normal',
  category: '',
  recurrenceEnd: '',
  recurrenceCount: '',
  notes: '',
  subtasks: [],
  assignedTo: '',
  habit: false,
  location: null,
  escalate: false,
};

const RADIUS_OPTIONS = [100, 200, 500, 1000];

// Convert a stored ISO datetime to the value a datetime-local input expects
// (local wall-clock time, no timezone suffix).
function toLocalInput(iso) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromInitial(initial) {
  if (!initial) {
    return { ...EMPTY };
  }
  return {
    title: initial.title || '',
    datetime: toLocalInput(initial.datetime),
    recurrence: initial.recurrence || 'none',
    leadMinutes: initial.leadMinutes ?? 0,
    priority: initial.priority || 'normal',
    category: initial.category || '',
    recurrenceEnd: initial.recurrenceEnd ? toLocalInput(initial.recurrenceEnd).slice(0, 10) : '',
    recurrenceCount: initial.recurrenceCount ?? '',
    notes: initial.notes || '',
    subtasks: (initial.subtasks || []).map((s) => ({ title: s.title, done: !!s.done })),
    assignedTo: initial.assignedTo || '',
    habit: Boolean(initial.habit),
    location: initial.location || null,
    escalate: Boolean(initial.escalate),
  };
}

function toPayload(form) {
  return {
    title: form.title.trim(),
    datetime: new Date(form.datetime).toISOString(),
    recurrence: form.recurrence,
    leadMinutes: Number(form.leadMinutes) || 0,
    priority: form.priority,
    category: form.category.trim(),
    recurrenceEnd: form.recurrenceEnd ? new Date(form.recurrenceEnd).toISOString() : null,
    recurrenceCount: form.recurrenceCount === '' ? null : Number(form.recurrenceCount),
    notes: form.notes.trim(),
    subtasks: form.subtasks.filter((s) => s.title.trim() !== ''),
    assignedTo: form.assignedTo || null,
    habit: form.habit,
    location: form.location,
    escalate: form.escalate,
  };
}

export default function ReminderForm({ initial, onSubmit, onCancel, staffOptions }) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState(() => fromInitial(initial));
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [confirmPhase, setConfirmPhase] = useState('idle'); // idle | asking | listening
  const whisper = useWhisperTranscription();
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const recurring = form.recurrence !== 'none';

  // Free, local parsing (no AI API call) — good-enough guess that the user
  // reviews/edits in the form before saving. Shared by the mic (speech
  // transcript) and the "Parse" button (whatever's typed in the title box) —
  // typing is always accurate, so it's the reliable fallback when the
  // browser's speech recognition mishears Gujarati/Hindi. Returns the
  // parsed fields (or null on failure) so the mic path can drive the
  // voice-confirmation loop without waiting on React state to settle.
  function applyParsedText(text) {
    setParsing(true);
    setError('');
    let parsed = null;
    try {
      const f = parseReminderText(text);
      parsed = f;
      setForm((prev) => ({
        ...prev,
        title: f.title || prev.title,
        datetime: toLocalInput(f.datetime),
        recurrence: f.recurrence || prev.recurrence,
        priority: f.priority || prev.priority,
      }));
    } catch {
      setForm((prev) => ({ ...prev, title: text }));
      setError('Could not understand the date/time — filled the title, please set it manually');
    } finally {
      setParsing(false);
    }
    return parsed;
  }

  // Fully hands-free loop: after the mic parses a reminder, the AI reads it
  // back and listens for a yes/no — so someone who doesn't want to look at
  // or touch the screen never has to. Built directly from the freshly
  // parsed fields (not the `form` state) so it can't submit a stale value
  // while waiting on speech/listening delays.
  async function confirmByVoice(parsed) {
    const ttsLang = TTS_LANG[lang] || 'en-IN';
    const whisperLang = WHISPER_LANG[lang] || 'en';
    const when = formatDateTime(parsed.datetime);
    const question = t('form.confirmQuestion', { title: parsed.title, when });

    setConfirmPhase('asking');
    speak(question, ttsLang, () => {
      setConfirmPhase('listening');
      whisper.start(whisperLang, async (answer) => {
        const lower = answer.toLowerCase();
        const isYes = YES_WORDS.some((w) => lower.includes(w));
        const isNo = NO_WORDS.some((w) => lower.includes(w));
        setConfirmPhase('idle');

        if (isYes && !isNo) {
          try {
            await onSubmit({
              title: parsed.title.trim(),
              datetime: new Date(parsed.datetime).toISOString(),
              recurrence: parsed.recurrence,
              leadMinutes: 0,
              priority: parsed.priority,
              category: '',
              recurrenceEnd: null,
              recurrenceCount: null,
              notes: '',
              subtasks: [],
              assignedTo: null,
              habit: false,
              location: null,
              escalate: false,
            });
            speak(t('form.confirmSaved'), ttsLang);
            if (!initial) setForm({ ...EMPTY });
          } catch (err) {
            setError(err.response?.data?.message || 'Could not save reminder');
          }
        } else {
          setError(t('form.confirmFallback'));
        }
      });
    });
  }

  function handleVoiceTranscript(transcript) {
    const parsed = applyParsedText(transcript);
    if (parsed) {
      confirmByVoice(parsed);
    }
  }

  function handleMicClick() {
    if (whisper.status === 'recording') {
      whisper.stop();
      return;
    }
    whisper.start(WHISPER_LANG[lang] || 'en', handleVoiceTranscript);
  }

  function handleParseTyped() {
    if (!form.title.trim()) return;
    applyParsedText(form.title);
  }

  function toggleHabit(e) {
    setForm((prev) => ({ ...prev, habit: e.target.checked }));
  }

  function toggleEscalate(e) {
    setForm((prev) => ({ ...prev, escalate: e.target.checked }));
  }

  function toggleLocation(e) {
    setForm((prev) => ({
      ...prev,
      location: e.target.checked ? { lat: null, lng: null, radiusMeters: 200, label: '' } : null,
    }));
  }

  function setLocationField(key, value) {
    setForm((prev) => ({ ...prev, location: { ...prev.location, [key]: value } }));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocationField('lat', pos.coords.latitude);
        setLocationField('lng', pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setError('Could not get your current location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function updateSubtask(index, patch) {
    setForm((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addSubtask() {
    setForm((prev) => ({ ...prev, subtasks: [...prev.subtasks, { title: '', done: false }] }));
  }

  function removeSubtask(index) {
    setForm((prev) => ({ ...prev, subtasks: prev.subtasks.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.datetime) {
      setError('Title and date/time are required');
      return;
    }
    if (form.location && (form.location.lat === null || form.location.lng === null)) {
      setError('Pick a location for the location reminder, or turn it off');
      return;
    }
    setError('');
    try {
      await onSubmit(toPayload(form));
      if (!initial) {
        setForm({ ...EMPTY });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save reminder');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>{t('form.title')}</label>
        <div className="row" style={{ gap: '0.4rem' }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="e.g. Team standup"
            value={form.title}
            onChange={set('title')}
            required
          />
          {whisper.supported && (
            <button
              type="button"
              className={`btn btn-sm ${whisper.status === 'recording' ? 'btn-danger' : ''}`}
              onClick={handleMicClick}
              disabled={parsing || whisper.status === 'loading' || whisper.status === 'transcribing'}
              title={t('form.voiceHint')}
            >
              {whisper.status === 'loading' || whisper.status === 'transcribing' || parsing
                ? '…'
                : whisper.status === 'recording'
                  ? '⏹️'
                  : '🎙️'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleParseTyped}
            disabled={parsing || !form.title.trim()}
            title={t('form.parseHint')}
          >
            ✨
          </button>
        </div>
        {whisper.supported && whisper.status === 'idle' && (
          <small className="muted">{t('form.voiceHint')}</small>
        )}
        <small className="muted" style={{ display: 'block' }}>{t('form.parseHint')}</small>
        {whisper.status === 'loading' && (
          <small className="muted">{t('form.voiceModelLoading', { percent: whisper.progress })}</small>
        )}
        {whisper.status === 'recording' && confirmPhase === 'idle' && (
          <small className="muted">🎙️ {t('form.voiceRecording')}</small>
        )}
        {whisper.status === 'transcribing' && confirmPhase === 'idle' && (
          <small className="muted">{t('form.voiceParsing')}</small>
        )}
        {confirmPhase === 'asking' && <small className="muted">🔊 {t('form.confirmAsking')}</small>}
        {confirmPhase === 'listening' && (
          <small className="muted">🎙️ {t('form.confirmListening')}</small>
        )}
        {whisper.error && (
          <small className="muted" style={{ color: 'var(--danger)' }}>{whisper.error}</small>
        )}
        {parsing && <small className="muted">{t('form.voiceParsing')}</small>}
      </div>
      <div className="row" style={{ gap: '0.75rem' }}>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>{t('form.when')}</label>
          <input className="input" type="datetime-local" value={form.datetime} onChange={set('datetime')} required />
        </div>
        <div className="field" style={{ width: 130 }}>
          <label>{t('form.notifyBefore')}</label>
          <input className="input" type="number" min="0" value={form.leadMinutes} onChange={set('leadMinutes')} />
        </div>
      </div>
      <div className="row" style={{ gap: '0.75rem' }}>
        <div className="field" style={{ width: 140 }}>
          <label>{t('form.priority')}</label>
          <select className="select" value={form.priority} onChange={set('priority')}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>{t('form.category')}</label>
          <input className="input" placeholder="Optional" value={form.category} onChange={set('category')} />
        </div>
        <div className="field" style={{ width: 160 }}>
          <label>{t('form.repeat')}</label>
          <select className="select" value={form.recurrence} onChange={set('recurrence')}>
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label className="row text-sm">
          <input type="checkbox" checked={form.habit} onChange={toggleHabit} />
          {t('form.habit')}
        </label>
      </div>

      <div className="field">
        <label className="row text-sm">
          <input type="checkbox" checked={form.escalate} onChange={toggleEscalate} />
          {t('form.escalate')}
        </label>
        {form.escalate && <small className="muted">{t('form.escalateHint')}</small>}
      </div>

      <div className="field">
        <label className="row text-sm">
          <input type="checkbox" checked={Boolean(form.location)} onChange={toggleLocation} />
          {t('form.locationReminder')}
        </label>
        {form.location && (
          <div className="row" style={{ gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm" onClick={useCurrentLocation} disabled={locating}>
              {locating ? '…' : `📍 ${t('form.useCurrentLocation')}`}
            </button>
            <input
              className="input"
              style={{ width: 140 }}
              placeholder={t('form.locationLabel')}
              value={form.location.label}
              onChange={(e) => setLocationField('label', e.target.value)}
            />
            <select
              className="select"
              style={{ width: 120 }}
              value={form.location.radiusMeters}
              onChange={(e) => setLocationField('radiusMeters', Number(e.target.value))}
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}m</option>
              ))}
            </select>
            {form.location.lat !== null && (
              <span className="muted text-sm">
                {form.location.lat.toFixed(4)}, {form.location.lng.toFixed(4)}
              </span>
            )}
          </div>
        )}
      </div>

      {staffOptions && staffOptions.length > 0 && (
        <div className="field">
          <label>{t('form.assignTo')}</label>
          <select className="select" value={form.assignedTo} onChange={set('assignedTo')}>
            <option value="">{t('form.assignToMe')}</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      {recurring && (
        <div className="row" style={{ gap: '0.75rem' }}>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>{t('form.repeatUntil')}</label>
            <input className="input" type="date" value={form.recurrenceEnd} onChange={set('recurrenceEnd')} />
          </div>
          <div className="field" style={{ width: 160 }}>
            <label>{t('form.repeatCount')}</label>
            <input className="input" type="number" min="1" value={form.recurrenceCount} onChange={set('recurrenceCount')} />
          </div>
        </div>
      )}
      <div className="field">
        <label>{t('form.notes')}</label>
        <textarea
          className="textarea"
          rows={2}
          placeholder="Optional"
          value={form.notes}
          onChange={set('notes')}
        />
      </div>
      <div className="field">
        <label>{t('form.subtasks')}</label>
        {form.subtasks.map((s, i) => (
          <div key={i} className="row" style={{ marginBottom: '0.4rem' }}>
            <input
              type="checkbox"
              checked={s.done}
              onChange={(e) => updateSubtask(i, { done: e.target.checked })}
            />
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder={t('form.subtaskPlaceholder')}
              value={s.title}
              onChange={(e) => updateSubtask(i, { title: e.target.value })}
            />
            <button type="button" className="btn btn-sm btn-danger" onClick={() => removeSubtask(i)}>
              {t('common.delete')}
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-ghost" onClick={addSubtask}>
          {t('reminders.addSubtask')}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="row">
        <button type="submit" className="btn btn-primary">
          {initial ? t('common.saveChanges') : t('reminders.new')}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
