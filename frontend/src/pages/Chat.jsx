import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { formatDateTime } from '../utils/format';

const LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'gu-IN', label: 'ગુજરાતી' },
];

export default function Chat() {
  const { user } = useAuth();
  const [displayMessages, setDisplayMessages] = useState([]);
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInput] = useState('');
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('en-IN');
  const bottomRef = useRef(null);
  const speech = useSpeechRecognition();

  function loadReminders() {
    client
      .get('/reminders')
      .then((res) => setReminders(res.data.reminders))
      .catch(() => {});
  }

  useEffect(() => {
    loadReminders();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  async function sendMessage(userText) {
    if (!userText.trim() || loading) return;
    setInput('');
    setError('');
    setDisplayMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setLoading(true);
    try {
      const res = await client.post('/chat/message', { message: userText, history: apiHistory });
      setApiHistory(res.data.history);
      setDisplayMessages((prev) => [...prev, { role: 'assistant', text: res.data.reply }]);
      if (res.data.reminders?.length) {
        loadReminders();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleMic() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    speech.start(lang, (transcript) => sendMessage(transcript));
  }

  async function handleComplete(id) {
    try {
      await client.post(`/reminders/${id}/complete`);
      loadReminders();
    } catch {
      setError('Could not mark reminder done');
    }
  }

  return (
    <div className="grid-2">
      <div>
        <div className="page-head">
          <h1>Chat</h1>
          <span className="subtle text-sm">Type or speak — reminders set themselves.</span>
        </div>

        <div className="chat-window">
          {displayMessages.length === 0 && (
            <p className="muted" style={{ margin: 'auto', textAlign: 'center' }}>
              Try: “remind me to call the client tomorrow at 5pm”
            </p>
          )}
          {displayMessages.map((m, i) => (
            <div key={i} className={`msg ${m.role === 'user' ? 'msg-user' : 'msg-assistant'}`}>
              {m.text}
            </div>
          ))}
          {loading && <div className="msg msg-assistant muted">Thinking…</div>}
          <div ref={bottomRef} />
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="composer">
          <input
            className="input"
            type="text"
            value={speech.listening && speech.interim ? speech.interim : input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type, or tap the mic and speak…"
            disabled={loading}
          />
          {speech.supported && (
            <>
              <select
                className="select"
                style={{ width: 'auto' }}
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                disabled={speech.listening}
                title="Speech language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              <button
                type="button"
                className={`btn btn-icon${speech.listening ? ' recording' : ''}`}
                onClick={handleMic}
                disabled={loading}
                title={speech.listening ? 'Stop listening' : 'Speak your reminder'}
              >
                🎤
              </button>
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>Send</button>
        </form>
        {speech.listening && <div className="alert alert-info">🎙️ Listening… bolo, reminder aapoaap ban jashe.</div>}
        {!speech.supported && <p className="muted text-sm">Voice input needs Chrome or Edge. You can still type.</p>}
        {speech.error && <p className="alert alert-error">Mic: {speech.error}</p>}
      </div>

      <aside>
        <div className="page-head"><h1 style={{ fontSize: '1.15rem' }}>Reminders</h1></div>
        {reminders.length === 0 && <p className="muted text-sm">No reminders yet.</p>}
        {reminders.slice(0, 12).map((r) => (
          <div key={r.id} className={`rem-item ${r.completed ? 'done' : ''}`}>
            <div className={`rem-title ${r.completed ? 'done' : ''}`}>{r.title}</div>
            <div className="rem-meta">{formatDateTime(r.datetime, user?.timezone)}</div>
            {!r.completed && (
              <div className="rem-actions">
                <button type="button" className="btn btn-sm" onClick={() => handleComplete(r.id)}>Done</button>
              </div>
            )}
          </div>
        ))}
      </aside>
    </div>
  );
}
