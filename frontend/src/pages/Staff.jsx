import { useEffect, useState } from 'react';
import client from '../api/client';
import { useI18n } from '../i18n/I18nContext';

export default function Staff() {
  const { t } = useI18n();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', department: '' });
  const [error, setError] = useState('');

  function load() {
    client
      .get('/staff')
      .then((res) => setStaff(res.data.staff))
      .catch(() => setError('Could not load staff'));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await client.post('/staff', form);
      setForm({ name: '', email: '', password: '', phone: '', department: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add staff member');
    }
  }

  async function toggleActive(member) {
    await client.put(`/staff/${member.id}`, { active: !member.active });
    load();
  }

  async function remove(member) {
    await client.delete(`/staff/${member.id}`);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>{t('nav.staff')}</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('staff.add')}</h3>
        <form onSubmit={handleSubmit}>
          <div className="row" style={{ gap: '0.75rem' }}>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{t('staff.name')}</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{t('staff.email')}</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
          </div>
          <div className="row" style={{ gap: '0.75rem' }}>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{t('staff.password')}</label>
              <input className="input" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{t('staff.phone')}</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+919876543210" />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{t('staff.department')}</label>
              <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">{t('staff.add')}</button>
        </form>
      </div>

      {staff.map((s) => (
        <div key={s.id} className={`rem-item ${!s.active ? 'done' : ''}`}>
          <div className="spread">
            <span className="rem-title">{s.name}</span>
            <span className={`badge ${s.active ? 'badge-low' : 'badge-normal'}`}>
              {s.active ? t('staff.active') : t('staff.inactive')}
            </span>
          </div>
          <div className="rem-meta">
            {s.email}
            {s.department && ` · ${s.department}`}
            {s.phone && ` · ${s.phone}`}
          </div>
          <div className="rem-actions">
            <button type="button" className="btn btn-sm" onClick={() => toggleActive(s)}>
              {s.active ? t('staff.deactivate') : t('staff.activate')}
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(s)}>{t('common.delete')}</button>
          </div>
        </div>
      ))}
      {staff.length === 0 && <p className="muted">{t('staff.empty')}</p>}
    </div>
  );
}
