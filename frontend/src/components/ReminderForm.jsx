import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { parseReminderText } from '../utils/parseReminderText';

const SPEECH_LANG = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };

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
  };
}

export default function ReminderForm({ initial, onSubmit, onCancel, staffOptions }) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState(() => fromInitial(initial));
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const speech = useSpeechRecognition();
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const recurring = form.recurrence !== 'none';

  // Free, local parsing (no AI API call) — good-enough guess that the user
  // reviews/edits in the form before saving.
  function handleVoiceTranscript(transcript) {
    setParsing(true);
    setError('');
    try {
      const f = parseReminderText(transcript);
      setForm((prev) => ({
        ...prev,
        title: f.title || prev.title,
        datetime: toLocalInput(f.datetime),
        recurrence: f.recurrence || prev.recurrence,
        priority: f.priority || prev.priority,
      }));
    } catch {
      setForm((prev) => ({ ...prev, title: transcript }));
      setError('Could not understand the date/time — filled the title, please set it manually');
    } finally {
      setParsing(false);
    }
  }

  function handleMicClick() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    speech.start(SPEECH_LANG[lang] || 'en-IN', handleVoiceTranscript);
  }

  function toggleHabit(e) {
    setForm((prev) => ({ ...prev, habit: e.target.checked }));
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
          {speech.supported && (
            <button
              type="button"
              className={`btn btn-sm ${speech.listening ? 'btn-danger' : ''}`}
              onClick={handleMicClick}
              disabled={parsing}
              title={t('form.voiceHint')}
            >
              {parsing ? '…' : speech.listening ? '⏹️' : '🎙️'}
            </button>
          )}
        </div>
        {speech.supported && !speech.listening && !parsing && (
          <small className="muted">{t('form.voiceHint')}</small>
        )}
        {speech.listening && (
          <small className="muted">
            🎙️ {t('form.listening')}
            {speech.interim && <> — “{speech.interim}”</>}
          </small>
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
