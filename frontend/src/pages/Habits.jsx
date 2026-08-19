import { useEffect, useState } from 'react';
import client from '../api/client';
import { useI18n } from '../i18n/I18nContext';

export default function Habits() {
  const { t } = useI18n();
  const [reminders, setReminders] = useState([]);
  const [error, setError] = useState('');
  const todayKey = new Date().toISOString().slice(0, 10);

  function load() {
    client
      .get('/reminders')
      .then((res) => setReminders(res.data.reminders.filter((r) => r.habit)))
      .catch(() => setError('Could not load habits'));
  }

  useEffect(() => {
    load();
  }, []);

  async function checkin(id) {
    try {
      await client.post(`/reminders/${id}/checkin`);
      load();
    } catch {
      setError('Check-in failed');
    }
  }

  const habits = [...reminders].sort((a, b) => b.streak - a.streak);

  return (
    <div>
      <div className="page-head">
        <h1>{t('nav.habits')}</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {habits.length === 0 && (
        <p className="muted">{t('habits.empty')}</p>
      )}

      {habits.map((h) => {
        const checkedInToday = h.lastCheckinDate === todayKey;
        return (
          <div key={h.id} className="rem-item">
            <div className="spread">
              <span className="rem-title">{h.title}</span>
              <span className="xp-points">🔥 {t('habits.streakDays', { count: h.streak })}</span>
            </div>
            <div className="rem-meta">
              {t('habits.longest', { count: h.longestStreak })}
              {h.category && ` · ${h.category}`}
            </div>
            <div className="rem-actions">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={checkedInToday}
                onClick={() => checkin(h.id)}
              >
                {checkedInToday ? `✅ ${t('habits.checkedIn')}` : `🔥 ${t('habits.checkin')}`}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
