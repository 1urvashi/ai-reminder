import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';
import ThemeToggle from '../components/ThemeToggle';

const FEATURES = [
  { icon: '🗣️', title: 'Just say it', text: 'Speak or type in plain language — RemindAI understands and sets the reminder for you.' },
  { icon: '📞', title: 'AI phone calls', text: 'Get a real call that talks with you, and reschedule or mark done by voice.' },
  { icon: '💬', title: 'WhatsApp & email', text: 'Nudges reach you where you already are — WhatsApp, email, or the browser.' },
  { icon: '🔁', title: 'Smart recurring', text: 'Daily standups, weekly reviews, with end dates and notify-before lead times.' },
  { icon: '⏰', title: 'Never miss', text: 'A background scheduler follows up the moment something is due — or forgotten.' },
  { icon: '🌙', title: 'Yours, anywhere', text: 'Timezone-aware, dark mode, web and mobile.' },
];

export default function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <>
      <nav className="navbar">
        <Brand to="/" />
        <div className="nav-links">
          <ThemeToggle />
          <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
        </div>
      </nav>

      <div className="container">
        <section className="hero">
          <h1>
            Never forget a meeting <br />
            <span className="gradient">again.</span>
          </h1>
          <p>
            RemindAI listens, understands, and follows up — by call, WhatsApp, email, or browser —
            so the things that matter actually get done.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary">Start free</Link>
            <Link to="/login" className="btn">I have an account</Link>
          </div>
        </section>

        <section className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <div className="ico">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </section>

        <p className="muted text-sm" style={{ textAlign: 'center', marginTop: '3rem' }}>
          © {new Date().getFullYear()} RemindAI
        </p>
      </div>
    </>
  );
}
