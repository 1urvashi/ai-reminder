import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import client from '../api/client';
import { isPushSupported, getPushSubscription, subscribeToPush, unsubscribeFromPush } from '../utils/push';

const STATUS_STYLE = {
  sent: { label: '✅ Sent', cls: 'alert-ok' },
  ready: { label: '✅ Ready', cls: 'alert-ok' },
  off: { label: '⚪ Off', cls: 'alert-info' },
  not_configured: { label: '⚠️ Not configured', cls: 'alert-error' },
  not_ready: { label: '⚠️ Not ready', cls: 'alert-error' },
  no_phone: { label: '⚠️ No phone', cls: 'alert-error' },
  error: { label: '❌ Error', cls: 'alert-error' },
};

export default function Profile() {
  const { t } = useI18n();
  const { user, updateProfile, changePassword } = useAuth();
  const [testReport, setTestReport] = useState(null);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestReport(null);
    try {
      const res = await client.post('/notifications/test');
      setTestReport(res.data.report);
    } catch (err) {
      setTestReport({ _error: err.response?.data?.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  }
  const [name, setName] = useState(user?.name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.channels?.email ?? false);
  const [whatsapp, setWhatsapp] = useState(user?.channels?.whatsapp ?? false);
  const [call, setCall] = useState(user?.channels?.call ?? false);
  const [push, setPush] = useState(user?.channels?.push ?? true);
  const [caregiverName, setCaregiverName] = useState(user?.caregiver?.name || '');
  const [caregiverPhone, setCaregiverPhone] = useState(user?.caregiver?.phone || '');
  const [status, setStatus] = useState('');

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');

  useEffect(() => {
    if (!isPushSupported()) return;
    getPushSubscription().then((sub) => setPushSubscribed(Boolean(sub)));
  }, []);

  async function handleEnablePush() {
    setPushBusy(true);
    setPushError('');
    try {
      await subscribeToPush(client);
      setPushSubscribed(true);
    } catch (err) {
      setPushError(err.message || 'Could not enable push notifications');
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    setPushBusy(true);
    try {
      await unsubscribeFromPush(client);
    } finally {
      setPushSubscribed(false);
      setPushBusy(false);
    }
  }

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwStatus, setPwStatus] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('');
    try {
      await updateProfile({
        name,
        timezone,
        phone,
        channels: { email, whatsapp, call, push },
        caregiver: { name: caregiverName, phone: caregiverPhone },
      });
      setStatus('ok:Saved');
    } catch (err) {
      setStatus('err:' + (err.response?.data?.message || 'Failed to save'));
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwStatus('');
    try {
      await changePassword(currentPassword, newPassword);
      setPwStatus('ok:Password changed');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwStatus('err:' + (err.response?.data?.message || 'Failed to change password'));
    }
  }

  const banner = (s) =>
    s ? <div className={`alert ${s.startsWith('ok:') ? 'alert-ok' : 'alert-error'}`}>{s.slice(s.indexOf(':') + 1)}</div> : null;

  return (
    <div className="container-narrow" style={{ margin: '0 auto', padding: 0 }}>
      <div className="page-head"><h1>Profile</h1></div>
      <p className="muted text-sm" style={{ marginTop: '-0.5rem' }}>{user.email}</p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Account & channels</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Timezone (IANA, e.g. Asia/Kolkata)</label>
            <input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div className="field">
            <label>Phone (E.164, e.g. +919876543210)</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" />
          </div>
          <div className="field">
            <label>Reminder channels</label>
            <label className="row text-sm"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email</label>
            <label className="row text-sm"><input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} /> WhatsApp message</label>
            <label className="row text-sm"><input type="checkbox" checked={call} onChange={(e) => setCall(e.target.checked)} /> AI phone call</label>
            <label className="row text-sm"><input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} /> Browser push notification</label>
            <small className="muted">WhatsApp/calls need a phone number + Twilio configured; email needs SMTP configured.</small>
          </div>
          <div className="field">
            <label>{t('profile.caregiverTitle')}</label>
            <small className="muted" style={{ display: 'block', marginBottom: '0.4rem' }}>
              {t('profile.caregiverDesc')}
            </small>
            <input
              className="input"
              style={{ marginBottom: '0.5rem' }}
              placeholder={t('profile.caregiverName')}
              value={caregiverName}
              onChange={(e) => setCaregiverName(e.target.value)}
            />
            <input
              className="input"
              placeholder={t('profile.caregiverPhone')}
              value={caregiverPhone}
              onChange={(e) => setCaregiverPhone(e.target.value)}
            />
          </div>
          {banner(status)}
          <button type="submit" className="btn btn-primary">Save</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Push notifications</h3>
        <p className="muted text-sm" style={{ marginTop: 0 }}>
          Free, works even when this tab is closed — install RemindAI (browser menu → "Install app")
          for the best experience, then enable push below.
        </p>
        {!isPushSupported() && <div className="alert alert-error">Not supported in this browser.</div>}
        {isPushSupported() && (
          <div className="row" style={{ gap: '0.6rem' }}>
            {pushSubscribed ? (
              <button type="button" className="btn btn-sm" onClick={handleDisablePush} disabled={pushBusy}>
                {pushBusy ? 'Working…' : '🔕 Disable on this device'}
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleEnablePush} disabled={pushBusy}>
                {pushBusy ? 'Working…' : '🔔 Enable on this device'}
              </button>
            )}
          </div>
        )}
        {pushError && <div className="alert alert-error">{pushError}</div>}
      </div>

      <div className="card">
        <div className="spread">
          <h3 style={{ marginTop: 0 }}>Test notifications</h3>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleTest} disabled={testing}>
            {testing ? 'Sending…' : 'Send test'}
          </button>
        </div>
        <p className="muted text-sm" style={{ marginTop: 0 }}>
          Sends a test to your enabled channels right now, so you can see what works.
          Save your channel settings above first.
        </p>
        {testReport?._error && <div className="alert alert-error">{testReport._error}</div>}
        {testReport && !testReport._error && (
          <div>
            {['email', 'whatsapp', 'call'].map((ch) => {
              const r = testReport[ch];
              if (!r) return null;
              const s = STATUS_STYLE[r.status] || { label: r.status, cls: 'alert-info' };
              return (
                <div key={ch} className={`alert ${s.cls}`}>
                  <strong style={{ textTransform: 'capitalize' }}>{ch}:</strong> {s.label} — {r.detail}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Change password</h3>
        <form onSubmit={handlePasswordChange}>
          <div className="field">
            <label>Current password</label>
            <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label>New password (min 8 chars)</label>
            <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          {banner(pwStatus)}
          <button type="submit" className="btn">Change password</button>
        </form>
      </div>
    </div>
  );
}
