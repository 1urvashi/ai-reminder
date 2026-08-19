import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { formatDateTime } from '../utils/format';

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [error, setError] = useState('');
  const tz = user?.timezone;

  useEffect(() => {
    Promise.all([client.get('/reminders/stats'), client.get('/reminders')])
      .then(([statsRes, remRes]) => {
        setStats(statsRes.data);
        setReminders(remRes.data.reminders);
      })
      .catch(() => setError('Could not load dashboard'));
  }, []);

  const todayTasks = reminders
    .filter((r) => !r.completed && isToday(r.datetime))
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  const maxCategoryCount = stats ? Math.max(1, ...stats.byCategory.map((c) => c.count)) : 1;
  const priorityOrder = ['high', 'normal', 'low'];
  const byPriorityMap = stats
    ? Object.fromEntries(stats.byPriority.map((p) => [p.priority, p.count]))
    : {};
  const maxPriorityCount = Math.max(1, ...priorityOrder.map((p) => byPriorityMap[p] || 0));

  return (
    <div>
      <div className="page-head">
        <h1>{t('dashboard.title')}</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {stats && (
        <>
          <div className="stat-grid">
            <div className="stat-tile">
              <div className="stat-value">{stats.pendingCount}</div>
              <div className="stat-label">{t('dashboard.pending')}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value" style={{ color: stats.missedCount > 0 ? 'var(--warning)' : undefined }}>
                {stats.missedCount}
              </div>
              <div className="stat-label">{t('dashboard.missed')}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.doneTodayCount}</div>
              <div className="stat-label">{t('dashboard.doneToday')}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">🔥 {t('dashboard.streakDays', { count: stats.streak })}</div>
              <div className="stat-label">{t('dashboard.streak')}</div>
            </div>
          </div>

          {stats.missedCount > 0 && (
            <div className="alert alert-error spread">
              <span>{t('dashboard.missedBanner', { count: stats.missedCount })}</span>
              <Link to="/reminders" className="btn btn-sm">
                {t('dashboard.viewMissed')}
              </Link>
            </div>
          )}

          <div className="card">
            <div className="spread">
              <h3 style={{ marginTop: 0 }}>{t('gamification.title')}</h3>
              <span className="xp-points">⭐ {t('gamification.points', { count: stats.points })}</span>
            </div>
            {stats.badges.length === 0 && <p className="muted text-sm">{t('gamification.noBadges')}</p>}
            {stats.badges.length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                {stats.badges.map((b) => (
                  <span key={b.key} className="badge-award">🏅 {b.label}</span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('dashboard.today')}</h3>
        {todayTasks.length === 0 && <p className="muted text-sm">{t('dashboard.noTasksToday')}</p>}
        {todayTasks.map((r) => (
          <div key={r.id} className={`rem-item ${r.missed ? 'missed' : ''}`}>
            <div className="spread">
              <span className="rem-title">{r.title}</span>
              <span className={`badge badge-${r.priority}`}>{r.priority}</span>
            </div>
            <div className="rem-meta">{formatDateTime(r.datetime, tz)}{r.category && ` · ${r.category}`}</div>
          </div>
        ))}
      </div>

      {stats && (
        <div className="grid-2 mt">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('dashboard.byCategory')}</h3>
            {stats.byCategory.length === 0 && <p className="muted text-sm">{t('dashboard.noCategories')}</p>}
            {stats.byCategory.map((c) => (
              <div key={c.category} className="bar-row">
                <span>{c.category}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(c.count / maxCategoryCount) * 100}%` }} />
                </div>
                <span className="bar-count">{c.count}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('dashboard.byPriority')}</h3>
            {priorityOrder.map((p) => (
              <div key={p} className="bar-row">
                <span style={{ textTransform: 'capitalize' }}>{p}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${((byPriorityMap[p] || 0) / maxPriorityCount) * 100}%` }}
                  />
                </div>
                <span className="bar-count">{byPriorityMap[p] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
