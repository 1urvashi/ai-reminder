import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import ReminderForm from '../components/ReminderForm';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function sameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

// 6 rows x 7 cols covering the full month plus leading/trailing days needed
// to fill whole weeks.
function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarPage() {
  const { t } = useI18n();
  const [reminders, setReminders] = useState([]);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [error, setError] = useState('');
  const [dragOverKey, setDragOverKey] = useState(null);
  const [addCount, setAddCount] = useState(0);

  function load() {
    client
      .get('/reminders')
      .then((res) => setReminders(res.data.reminders))
      .catch(() => setError('Could not load reminders'));
  }

  useEffect(() => {
    load();
  }, []);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const r of reminders) {
      const key = dateKey(new Date(r.datetime));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    }
    return map;
  }, [reminders]);

  const days = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const today = new Date();
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function changeMonth(delta) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  async function moveReminderToDay(id, day) {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;
    const original = new Date(reminder.datetime);
    const next = new Date(day);
    next.setHours(original.getHours(), original.getMinutes(), original.getSeconds(), 0);
    try {
      await client.put(`/reminders/${id}`, { datetime: next.toISOString() });
      load();
    } catch {
      setError('Could not reschedule');
    }
  }

  async function quickAdd(payload) {
    await client.post('/reminders', payload);
    setAddCount((n) => n + 1);
    load();
  }

  const selectedList = selectedDay ? byDay.get(dateKey(selectedDay)) || [] : [];
  const quickAddDefault = selectedDay
    ? (() => {
        const d = new Date(selectedDay);
        d.setHours(9, 0, 0, 0);
        return { datetime: d.toISOString() };
      })()
    : null;

  return (
    <div>
      <div className="cal-head">
        <h1 style={{ margin: 0 }}>{t('calendar.title')}</h1>
        <div className="row">
          <button type="button" className="btn btn-sm" onClick={() => changeMonth(-1)}>‹</button>
          <button type="button" className="btn btn-sm" onClick={() => setViewDate(new Date())}>{t('calendar.today')}</button>
          <button type="button" className="btn btn-sm" onClick={() => changeMonth(1)}>›</button>
          <strong style={{ marginLeft: '0.5rem' }}>{monthLabel}</strong>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">{w}</div>
        ))}
        {days.map((day) => {
          const key = dateKey(day);
          const items = byDay.get(key) || [];
          const outside = day.getMonth() !== viewDate.getMonth();
          const isToday = sameDay(day, today);
          const isSelected = selectedDay && sameDay(day, selectedDay);
          return (
            <div
              key={key}
              className={[
                'cal-cell',
                outside ? 'outside' : '',
                isToday ? 'today' : '',
                isSelected ? 'selected' : '',
                dragOverKey === key ? 'drop-target' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDay(day)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverKey(key);
              }}
              onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverKey(null);
                const id = e.dataTransfer.getData('text/reminder-id');
                if (id) moveReminderToDay(id, day);
              }}
            >
              <span className="cal-day-num">{day.getDate()}</span>
              {items.slice(0, 3).map((r) => (
                <span
                  key={r.id}
                  className={`cal-dot priority-${r.priority}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/reminder-id', r.id);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  title={r.title}
                >
                  {r.title}
                </span>
              ))}
              {items.length > 3 && <span className="cal-more">+{items.length - 3} more</span>}
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div className="card cal-day-panel">
          <h3 style={{ marginTop: 0 }}>{selectedDay.toLocaleDateString(undefined, { dateStyle: 'full' })}</h3>
          {selectedList.length === 0 && <p className="muted text-sm">{t('calendar.noTasks')}</p>}
          {selectedList.map((r) => (
            <div key={r.id} className={`rem-item ${r.missed ? 'missed' : ''} ${r.completed ? 'done' : ''}`}>
              <div className="spread">
                <span className={`rem-title ${r.completed ? 'done' : ''}`}>{r.title}</span>
                <span className={`badge badge-${r.priority}`}>{r.priority}</span>
              </div>
              <div className="rem-meta">
                {new Date(r.datetime).toLocaleTimeString(undefined, { timeStyle: 'short' })}
                {r.category && ` · ${r.category}`}
              </div>
            </div>
          ))}
          <details style={{ marginTop: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('calendar.addTask')}</summary>
            <div className="mt">
              <ReminderForm key={`${dateKey(selectedDay)}-${addCount}`} initial={quickAddDefault} onSubmit={quickAdd} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
