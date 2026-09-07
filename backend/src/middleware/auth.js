import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    req.userRole = payload.role || 'admin';
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Usage: requireRole('admin')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Not allowed for your role' });
    }
    next();
  };
}

// Blocks any mutating action for the read-only 'viewer' role. Applied to
// every write route (create/update/delete/status-change) on reminders —
// viewers can see everything a manager can, but never change anything.
export function blockViewer(req, res, next) {
  if (req.userRole === 'viewer') {
    return res.status(403).json({ message: 'Your role has read-only access' });
  }
  next();
}
