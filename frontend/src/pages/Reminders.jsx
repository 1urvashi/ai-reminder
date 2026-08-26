import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { formatDateTime, isOverdue } from '../utils/format';
import ReminderForm from '../components/ReminderForm';

const FILTERS = ['upcoming', 'overdue', 'missed', 'completed', 'all'];

// One-tap templates for common Gujarat small-business reminder needs —
// pre-fills the form (title/recurrence/category); the owner just sets the
// time (defaults to tomorrow 10am) and saves.
const BUSINESS_PRESETS = [
  { key: 'payment', icon: '💰', titleKey: 'presets.payment', recurrence: 'weekly' },
  { key: 'gst', icon: '📋', titleKey: 'presets.gst', recurrence: 'monthly' },
  { key: 'stock', icon: '📦', titleKey: 'presets.stock', recurrence: 'weekly' },
  { key: 'followup', icon: '🤝', titleKey: 'presets.followup', recurrence: 'none' },
  { key: 'staffcheck', icon: '👥', titleKey: 'presets.staffcheck', recurrence: 'daily' },
];

function tomorrowAt(hour) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function matchesFilter(reminder, filter) {
  if (filter === 'all') return true;
  if (filter === 'completed') return reminder.completed;
  if (filter === 'missed') return reminder.missed && !reminder.completed;
  if (filter === 'overdue') return isOverdue(reminder);
  return !reminder.completed && !isOverdue(reminder) && !reminder.missed; // upcoming
}

export default function Reminders() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [reminders, setReminders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [filter, setFilter] = useState('upcoming');
  const [editing, setEditing] = useState(null);
  const [presetDraft, setPresetDraft] = useState(null);
  const [error, setError] = useState('');
  const tz = user?.timezone;
  const staffNameById = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  const todayKey = new Date().toISOString().slice(0, 10);

  function load() {
    client
      .get('/reminders')
      .then((res) => setReminders(res.data.reminders))
      .catch(() => setError('Could not load reminders'));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      client.get('/staff').then((res) => setStaff(res.data.staff)).catch(() => {});
    }
  }, [user]);

  async function createReminder(payload) {
    await client.post('/reminders', payload);
    setPresetDraft(null);
    load();
  }

  function applyPreset(preset) {
    setEditing(null);
    setPresetDraft({
      key: `${preset.key}-${Date.now()}`,
      title: t(preset.titleKey),
      datetime: tomorrowAt(10),
      recurrence: preset.recurrence,
      category: t('presets.category'),
    });
  }

  async function saveEdit(payload) {
    await client.put(`/reminders/${editing.id}`, payload);
    setEditing(null);
    load();
  }

  async function act(promise) {
    try {
      await promise;
      load();
    } catch {
      setError('Action failed');
    }
  }

  const visible = reminders.filter((r) => matchesFilter(r, filter));
  const missedCount = reminders.filter((r) => r.missed && !r.completed).length;

  return (
    <div>
      <div className="page-head">
        <h1>{t('reminders.title')}</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('presets.title')}</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {BUSINESS_PRESETS.map((p) => (
            <button key={p.key} type="button" className="btn btn-sm" onClick={() => applyPreset(p)}>
              {p.icon} {t(p.titleKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{editing ? t('reminders.editing') : t('reminders.new')}</h3>
        <ReminderForm
          key={editing ? editing.id : presetDraft ? presetDraft.key : 'new'}
          initial={editing || presetDraft}
          onSubmit={editing ? saveEdit : createReminder}
          onCancel={editing ? () => setEditing(null) : presetDraft ? () => setPresetDraft(null) : null}
          staffOptions={staff}
        />
      </div>

      <div className="row mt-2" style={{ marginBottom: '1rem' }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {t(`reminders.filter.${f}`)}
            {f === 'missed' && missedCount > 0 ? ` (${missedCount})` : ''}
          </button>
        ))}
      </div>

      {filter === 'missed' && missedCount > 0 && (
        <button
          type="button"
          className="btn btn-sm mt"
          style={{ marginBottom: '1rem' }}
          onClick={() => act(client.post('/reminders/reschedule-missed'))}
        >
          {t('reminders.rescheduleAllMissed')}
        </button>
      )}

      {visible.map((r) => {
        const doneSubtasks = (r.subtasks || []).filter((s) => s.done).length;
        return (
          <div
            key={r.id}
            className={`rem-item ${isOverdue(r) ? 'overdue' : ''} ${r.missed ? 'missed' : ''} ${r.completed ? 'done' : ''}`}
          >
            <div className="spread">
              <span className={`rem-title ${r.completed ? 'done' : ''}`}>{r.title}</span>
              <span className="row" style={{ gap: '0.3rem' }}>
                {r.missed && !r.completed && <span className="badge badge-high">{t('reminders.missedBadge')}</span>}
                {r.escalate && r.escalationStage > 0 && !r.completed && (
                  <span className="badge badge-high">🚨 {t('reminders.escalating', { stage: r.escalationStage })}</span>
                )}
                <span className={`badge badge-${r.priority}`}>{r.priority}</span>
              </span>
            </div>
            <div className="rem-meta">
              {formatDateTime(r.datetime, tz)}
              {r.category && ` · ${r.category}`}
              {r.recurrence !== 'none' && ` · repeats ${r.recurrence}`}
              {r.leadMinutes > 0 && ` · ${r.leadMinutes}m before`}
              {(r.subtasks || []).length > 0 && ` · ${doneSubtasks}/${r.subtasks.length} subtasks`}
              {r.assignedTo && staffNameById[r.assignedTo] && ` · ${staffNameById[r.assignedTo]}`}
              {r.habit && ` · 🔥 ${t('habits.streakDays', { count: r.streak })}`}
              {r.location && ` · 📍 ${r.location.label || t('form.locationReminder')}`}
              {r.rescheduleCount > 0 && ` · ${t('reminders.rescheduledBadge', { count: r.rescheduleCount })}`}
              {isOverdue(r) && <strong style={{ color: 'var(--danger)' }}> · overdue</strong>}
            </div>
            {r.notes && <div className="rem-meta text-sm">{r.notes}</div>}
            <div className="rem-actions">
              {r.habit && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={r.lastCheckinDate === todayKey}
                  onClick={() => act(client.post(`/reminders/${r.id}/checkin`))}
                >
                  {r.lastCheckinDate === todayKey ? `✅ ${t('habits.checkedIn')}` : `🔥 ${t('habits.checkin')}`}
                </button>
              )}
              {!r.completed && (
                <button type="button" className="btn btn-sm" onClick={() => act(client.post(`/reminders/${r.id}/complete`))}>{t('common.done')}</button>
              )}
              {r.missed && !r.completed ? (
                <button type="button" className="btn btn-sm" onClick={() => act(client.post(`/reminders/${r.id}/snooze`, { minutes: 60 }))}>{t('reminders.reschedule')}</button>
              ) : (
                <>
                  <button type="button" className="btn btn-sm" onClick={() => act(client.post(`/reminders/${r.id}/snooze`, { minutes: 10 }))}>+10m</button>
                  <button type="button" className="btn btn-sm" onClick={() => act(client.post(`/reminders/${r.id}/snooze`, { minutes: 60 }))}>+1h</button>
                </>
              )}
              <button type="button" className="btn btn-sm" onClick={() => setEditing(r)}>{t('common.edit')}</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => act(client.delete(`/reminders/${r.id}`))}>{t('common.delete')}</button>
            </div>
          </div>
        );
      })}
      {visible.length === 0 && <p className="muted">{t('reminders.empty')}</p>}
    </div>
  );
}
