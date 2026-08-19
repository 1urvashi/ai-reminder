import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import Brand from './Brand';
import ThemeToggle from './ThemeToggle';

const LINKS = [
  { to: '/dashboard', key: 'nav.dashboard' },
  { to: '/chat', key: 'nav.chat' },
  { to: '/reminders', key: 'nav.reminders' },
  { to: '/habits', key: 'nav.habits' },
  { to: '/kanban', key: 'nav.kanban' },
  { to: '/calendar', key: 'nav.calendar' },
  { to: '/notifications', key: 'nav.activity' },
  { to: '/profile', key: 'nav.profile' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const links = user?.role === 'admin' ? [...LINKS, { to: '/staff', key: 'nav.staff' }] : LINKS;

  return (
    <nav className="navbar">
      <Brand to={user ? '/dashboard' : '/'} />
      <div className="nav-links">
        {user &&
          links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {t(l.key)}
            </NavLink>
          ))}
        <select
          className="select"
          style={{ width: 'auto', padding: '0.35rem 0.5rem' }}
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          title="Language"
        >
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <ThemeToggle />
        {user && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            {t('nav.logout')}
          </button>
        )}
      </div>
    </nav>
  );
}
