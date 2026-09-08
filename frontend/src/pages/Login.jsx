import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';
import GoogleSignInButton from '../components/GoogleSignInButton';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
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
      setError(err.response?.data?.message || 'Google sign-in failed');
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Brand to="/" />
        <div className="card">
          <h1 style={{ fontSize: '1.4rem' }}>Welcome back</h1>
          <p className="muted text-sm" style={{ marginTop: 0 }}>Log in to your reminders.</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </form>
          <GoogleSignInButton onCredential={handleGoogle} onError={setError} />
        </div>
        <p className="muted text-sm" style={{ textAlign: 'center' }}>
          No account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
