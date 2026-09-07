import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function Register() {
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(name, email, password);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
          <h1 style={{ fontSize: '1.4rem' }}>Create your account</h1>
          <p className="muted text-sm" style={{ marginTop: 0 }}>Start reminding in seconds.</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Name</label>
              <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password (min 8 characters)</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <GoogleSignInButton onCredential={handleGoogle} onError={setError} />
        </div>
        <p className="muted text-sm" style={{ textAlign: 'center' }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
