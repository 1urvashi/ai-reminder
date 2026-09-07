import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

// The backend defaults every account to 'UTC' until the user sets a real
// timezone in Profile — most never do, so reminder times silently show 5+
// hours off from what they actually typed. Self-heal it here instead of
// relying on the user to find the Profile field.
function detectedTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function withTimezoneFix(user, patchFn) {
  const detected = detectedTimezone();
  if (user && user.timezone === 'UTC' && detected && detected !== 'UTC') {
    patchFn({ timezone: detected })
      .then((res) => setUserFromFix(res))
      .catch(() => {});
  }
  return user;
}

let setUserFromFix = () => {};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  setUserFromFix = (res) => setUser(res.data.user);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    client
      .get('/users/me')
      .then((res) => setUser(withTimezoneFix(res.data.user, (fields) => client.put('/users/me', fields))))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await client.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(withTimezoneFix(res.data.user, (fields) => client.put('/users/me', fields)));
  }

  async function register(name, email, password) {
    const detected = detectedTimezone();
    const res = await client.post('/auth/register', { name, email, password, timezone: detected || undefined });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
  }

  async function googleLogin(idToken) {
    const res = await client.post('/auth/google', { idToken });
    localStorage.setItem('token', res.data.token);
    setUser(withTimezoneFix(res.data.user, (fields) => client.put('/users/me', fields)));
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  async function updateProfile(fields) {
    const res = await client.put('/users/me', fields);
    setUser(res.data.user);
    return res.data.user;
  }

  async function changePassword(currentPassword, newPassword) {
    await client.post('/auth/change-password', { currentPassword, newPassword });
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, googleLogin, logout, updateProfile, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
