import { Link } from 'react-router-dom';

// The RemindAI wordmark: gradient square with a bell + gradient text.
export default function Brand({ to = '/', size = 'md' }) {
  const content = (
    <span className="brand">
      <span className="brand-mark">🔔</span>
      <span className="brand-text" style={{ fontSize: size === 'lg' ? '1.4rem' : undefined }}>
        RemindAI
      </span>
    </span>
  );
  return to ? (
    <Link to={to} style={{ textDecoration: 'none' }}>
      {content}
    </Link>
  ) : (
    content
  );
}
