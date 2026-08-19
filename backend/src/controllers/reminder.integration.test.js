import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_integration';

const { default: mongoose } = await import('mongoose');
const { createApp } = await import('../app.js');

const MONGO_URI = 'mongodb://127.0.0.1:27017/ai_reminder_integration_test';

let server;
let baseUrl;
let dbUp = false;

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

before(async () => {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2500 });
    await mongoose.connection.dropDatabase();
    dbUp = true;
  } catch {
    return; // tests will skip
  }
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (dbUp) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (server) {
    server.close();
  }
});

describe('reminder + auth flows', () => {
  let token;

  it('registers a user', async (t) => {
    if (!dbUp) return t.skip('MongoDB not available');
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Tester', email: 'tester@example.com', password: 'password123' },
    });
    assert.equal(res.status, 201);
    assert.ok(res.data.token);
    token = res.data.token;
  });

  it('creates a reminder with priority and lead time', async (t) => {
    if (!dbUp) return t.skip('MongoDB not available');
    const res = await api('/api/reminders', {
      method: 'POST',
      token,
      body: { title: 'Standup', datetime: new Date().toISOString(), priority: 'high', leadMinutes: 15 },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.reminder.priority, 'high');
    assert.equal(res.data.reminder.leadMinutes, 15);
  });

  it('rejects an invalid priority', async (t) => {
    if (!dbUp) return t.skip('MongoDB not available');
    const res = await api('/api/reminders', {
      method: 'POST',
      token,
      body: { title: 'Bad', datetime: new Date().toISOString(), priority: 'urgent' },
    });
    assert.equal(res.status, 400);
  });

  it('snoozes a reminder into the future', async (t) => {
    if (!dbUp) return t.skip('MongoDB not available');
    const created = await api('/api/reminders', {
      method: 'POST',
      token,
      body: { title: 'Snooze me', datetime: new Date(Date.now() - 1000).toISOString() },
    });
    const id = created.data.reminder.id;
    const res = await api(`/api/reminders/${id}/snooze`, { method: 'POST', token, body: { minutes: 10 } });
    assert.equal(res.status, 200);
    assert.ok(new Date(res.data.reminder.datetime).getTime() > Date.now());
    assert.equal(res.data.reminder.completed, false);
  });

  it('rejects a bad snooze duration', async (t) => {
    if (!dbUp) return t.skip('MongoDB not available');
    const created = await api('/api/reminders', {
      method: 'POST',
      token,
      body: { title: 'x', datetime: new Date().toISOString() },
    });
    const res = await api(`/api/reminders/${created.data.reminder.id}/snooze`, {
      method: 'POST',
      token,
      body: { minutes: -5 },
    });
    assert.equal(res.status, 400);
  });

  it('changes the password only with the correct current one', async (t) => {
    if (!dbUp) return t.skip('MongoDB not available');
    const wrong = await api('/api/auth/change-password', {
      method: 'POST',
      token,
      body: { currentPassword: 'nope', newPassword: 'newpassword1' },
    });
    assert.equal(wrong.status, 401);

    const ok = await api('/api/auth/change-password', {
      method: 'POST',
      token,
      body: { currentPassword: 'password123', newPassword: 'newpassword1' },
    });
    assert.equal(ok.status, 200);

    const login = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'tester@example.com', password: 'newpassword1' },
    });
    assert.equal(login.status, 200);
  });

  it('validates phone format on profile update', async (t) => {
    if (!dbUp) return t.skip('MongoDB not available');
    const bad = await api('/api/users/me', { method: 'PUT', token, body: { phone: '12345' } });
    assert.equal(bad.status, 400);

    const good = await api('/api/users/me', {
      method: 'PUT',
      token,
      body: { phone: '+919876543210', channels: { email: true } },
    });
    assert.equal(good.status, 200);
    assert.equal(good.data.user.phone, '+919876543210');
    assert.equal(good.data.user.channels.email, true);
  });
});
