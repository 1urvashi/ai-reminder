import { useEffect, useState } from 'react';
import client from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import PasswordInput from '../components/PasswordInput';

const DEPARTMENTS = ['Sales', 'Marketing', 'Operations', 'Finance', 'Support', 'IT', 'HR', 'Other'];
const EMPTY_FORM = { name: '', email: '', password: '', phone: '', department: '', departmentOther: '', role: 'employee' };
const PAGE_SIZE = 10;

function resolveDepartment(form) {
  return form.department === 'Other' ? form.departmentOther.trim() : form.department;
}

// Splits a server error like "phone must be E.164 format, e.g. ..." into
// which field it belongs to, so it can render right under that input
// instead of a generic banner at the top of the form.
function fieldFromError(message) {
  if (!message) return null;
  if (message.toLowerCase().includes('phone')) return 'phone';
  if (message.toLowerCase().includes('email')) return 'email';
  if (message.toLowerCase().includes('password')) return 'password';
  if (message.toLowerCase().includes('role')) return 'role';
  return null;
}

export default function Staff() {
  const { t } = useI18n();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState(null); // { field, message }
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editFieldError, setEditFieldError] = useState(null);
  const [page, setPage] = useState(1);

  function load() {
    client
      .get('/staff')
      .then((res) => setStaff(res.data.staff))
      .catch(() => setError('Could not load staff'));
  }

  const totalPages = Math.max(1, Math.ceil(staff.length / PAGE_SIZE));
  const pagedStaff = staff.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldError(null);
    try {
      await client.post('/staff', { ...form, department: resolveDepartment(form) });
      setForm({ ...EMPTY_FORM });
      load();
    } catch (err) {
      const message = err.response?.data?.message || 'Could not add staff member';
      const field = fieldFromError(message);
      if (field) {
        setFieldError({ field, message });
      } else {
        setError(message);
      }
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

  function startEdit(member) {
    setEditingId(member.id);
    setEditFieldError(null);
    const isPreset = DEPARTMENTS.includes(member.department);
    setEditForm({
      name: member.name,
      phone: member.phone || '',
      department: member.department && !isPreset ? 'Other' : member.department || '',
      departmentOther: member.department && !isPreset ? member.department : '',
      role: member.role,
    });
  }

  async function saveEdit(member) {
    setEditFieldError(null);
    try {
      await client.put(`/staff/${member.id}`, {
        name: editForm.name,
        phone: editForm.phone,
        department: resolveDepartment(editForm),
        role: editForm.role,
      });
      setEditingId(null);
      load();
    } catch (err) {
      const message = err.response?.data?.message || 'Could not save changes';
      const field = fieldFromError(message);
      setEditFieldError({ field: field || 'general', message });
    }
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
              <input
                className={`input${fieldError?.field === 'email' ? ' has-error' : ''}`}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              {fieldError?.field === 'email' && <small className="field-error">{fieldError.message}</small>}
            </div>
          </div>
          <div className="row" style={{ gap: '0.75rem' }}>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{t('staff.password')}</label>
              <PasswordInput
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={8}
                required
                autoComplete="new-password"
              />
              {fieldError?.field === 'password' && <small className="field-error">{fieldError.message}</small>}
            </div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{t('staff.phone')}</label>
              <input
                className={`input${fieldError?.field === 'phone' ? ' has-error' : ''}`}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+919876543210"
              />
              {fieldError?.field === 'phone' && <small className="field-error">{fieldError.message}</small>}
            </div>
          </div>
          <div className="row" style={{ gap: '0.75rem' }}>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{t('staff.department')}</label>
              <select
                className="select"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              >
                <option value="">{t('staff.departmentNone')}</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {form.department === 'Other' && (
                <input
                  className="input"
                  style={{ marginTop: '0.4rem' }}
                  placeholder={t('staff.departmentOther')}
                  value={form.departmentOther}
                  onChange={(e) => setForm({ ...form, departmentOther: e.target.value })}
                />
              )}
            </div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{t('staff.role')}</label>
              <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="manager">{t('staff.roleManager')}</option>
                <option value="employee">{t('staff.roleEmployee')}</option>
                <option value="viewer">{t('staff.roleViewer')}</option>
              </select>
            </div>
          </div>
          <small className="muted">{t('staff.roleHint')}</small>
          <div className="mt">
            <button type="submit" className="btn btn-primary">{t('staff.add')}</button>
          </div>
        </form>
      </div>

      {staff.length > 0 && (
        <div className="card">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('staff.name')}</th>
                  <th>{t('staff.email')}</th>
                  <th>{t('staff.role')}</th>
                  <th>{t('staff.department')}</th>
                  <th>{t('staff.phone')}</th>
                  <th>{t('staff.active')}</th>
                  <th>{t('common.edit')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedStaff.map((s) =>
                  editingId === s.id ? (
                    <tr key={s.id}>
                      <td colSpan={7}>
                        <div className="row" style={{ gap: '0.75rem' }}>
                          <div className="field" style={{ flex: 1, minWidth: 140 }}>
                            <label>{t('staff.name')}</label>
                            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                          </div>
                          <div className="field" style={{ flex: 1, minWidth: 140 }}>
                            <label>{t('staff.phone')}</label>
                            <input
                              className={`input${editFieldError?.field === 'phone' ? ' has-error' : ''}`}
                              value={editForm.phone}
                              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                              placeholder="+919876543210"
                            />
                            {editFieldError?.field === 'phone' && <small className="field-error">{editFieldError.message}</small>}
                          </div>
                        </div>
                        <div className="row" style={{ gap: '0.75rem' }}>
                          <div className="field" style={{ flex: 1, minWidth: 140 }}>
                            <label>{t('staff.department')}</label>
                            <select
                              className="select"
                              value={editForm.department}
                              onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                            >
                              <option value="">{t('staff.departmentNone')}</option>
                              {DEPARTMENTS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                            {editForm.department === 'Other' && (
                              <input
                                className="input"
                                style={{ marginTop: '0.4rem' }}
                                placeholder={t('staff.departmentOther')}
                                value={editForm.departmentOther}
                                onChange={(e) => setEditForm({ ...editForm, departmentOther: e.target.value })}
                              />
                            )}
                          </div>
                          <div className="field" style={{ flex: 1, minWidth: 140 }}>
                            <label>{t('staff.role')}</label>
                            <select className="select" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                              <option value="manager">{t('staff.roleManager')}</option>
                              <option value="employee">{t('staff.roleEmployee')}</option>
                              <option value="viewer">{t('staff.roleViewer')}</option>
                            </select>
                          </div>
                        </div>
                        {editFieldError?.field === 'general' && <div className="alert alert-error">{editFieldError.message}</div>}
                        <div className="rem-actions">
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => saveEdit(s)}>{t('common.saveChanges')}</button>
                          <button type="button" className="btn btn-sm" onClick={() => setEditingId(null)}>{t('common.cancel')}</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id} className={!s.active ? 'inactive-row' : ''}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>
                        <span className="badge badge-normal">
                          {t(`staff.role${s.role.charAt(0).toUpperCase()}${s.role.slice(1)}`)}
                        </span>
                      </td>
                      <td>{s.department || '—'}</td>
                      <td>{s.phone || '—'}</td>
                      <td>
                        <span className={`badge ${s.active ? 'badge-low' : 'badge-normal'}`}>
                          {s.active ? t('staff.active') : t('staff.inactive')}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <div className="row" style={{ gap: '0.4rem' }}>
                          <button type="button" className="btn btn-sm" onClick={() => startEdit(s)}>{t('common.edit')}</button>
                          <button type="button" className="btn btn-sm" onClick={() => toggleActive(s)}>
                            {s.active ? t('staff.deactivate') : t('staff.activate')}
                          </button>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(s)}>{t('common.delete')}</button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          {staff.length > PAGE_SIZE && (
            <div className="pagination">
              <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t('common.previous')}
              </button>
              <span className="page-info">{page} / {totalPages}</span>
              <button type="button" className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                {t('common.next')}
              </button>
            </div>
          )}
        </div>
      )}
      {staff.length === 0 && <p className="muted">{t('staff.empty')}</p>}
    </div>
  );
}
