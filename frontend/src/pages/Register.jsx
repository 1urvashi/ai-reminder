import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import Brand from '../components/Brand';
import GoogleSignInButton from '../components/GoogleSignInButton';
import PasswordInput from '../components/PasswordInput';
import LanguageSwitcher from '../components/LanguageSwitcher';

const SLOW_HINT_DELAY_MS = 6000;

export default function Register() {
  const { register, googleLogin } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);
  const slowHintTimer = useRef(null);

  useEffect(() => {
    if (busy) {
      slowHintTimer.current = setTimeout(() => setShowSlowHint(true), SLOW_HINT_DELAY_MS);
    } else {
      clearTimeout(slowHintTimer.current);
      setShowSlowHint(false);
    }
    return () => clearTimeout(slowHintTimer.current);
  }, [busy]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(name, email, password);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.message || t('auth.registerFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle(idToken) {
    setError('');
    try {
      await googleLogin(idToken);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.message || t('auth.googleFailed'));
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="spread" style={{ alignItems: 'center' }}>
          <Brand to="/" />
          <LanguageSwitcher />
        </div>
        <div className="card">
          <h1 style={{ fontSize: '1.4rem' }}>{t('auth.registerTitle')}</h1>
          <p className="muted text-sm" style={{ marginTop: 0 }}>{t('auth.registerSubtitle')}</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>{t('auth.name')}</label>
              <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>{t('auth.email')}</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>{t('auth.passwordMin')}</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? t('auth.creating') : t('auth.createAccount')}
            </button>
            {showSlowHint && <small className="muted" style={{ display: 'block', marginTop: '0.5rem', textAlign: 'center' }}>{t('auth.slowServer')}</small>}
          </form>
          <GoogleSignInButton onCredential={handleGoogle} onError={setError} />
        </div>
        <p className="muted text-sm" style={{ textAlign: 'center' }}>
          {t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
}
