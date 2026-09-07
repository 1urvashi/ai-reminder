import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

function signToken(userId, role) {
  return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    role: user.role,
    department: user.department,
    points: user.points,
    badges: user.badges,
  };
}

function validIanaZone(timezone) {
  if (typeof timezone !== 'string' || timezone.trim() === '') return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return null;
  }
}

export async function register(req, res) {
  const { name, email, password, timezone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const zone = validIanaZone(timezone);
  const user = await User.create({ name, email, passwordHash, ...(zone ? { timezone: zone } : {}) });

  const token = signToken(user._id.toString(), user.role);
  res.status(201).json({ token, user: publicUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.active) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = signToken(user._id.toString(), user.role);
  res.json({ token, user: publicUser(user) });
}

// Verifies a Google Identity Services ID token by asking Google directly —
// no JWT library/JWKS handling needed, just an HTTP call, matching this
// project's existing "raw fetch over SDK" style for third-party APIs.
async function verifyGoogleIdToken(idToken) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) {
    return null;
  }
  return res.json();
}

export async function googleLogin(req, res) {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ message: 'idToken is required' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ message: 'Google sign-in is not configured on the server' });
  }

  const payload = await verifyGoogleIdToken(idToken);
  if (!payload) {
    return res.status(401).json({ message: 'Invalid Google token' });
  }
  // The audience MUST match our own client ID — otherwise a valid Google
  // token issued for a completely different app could be replayed here.
  if (payload.aud !== clientId) {
    return res.status(401).json({ message: 'Token was not issued for this app' });
  }
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    return res.status(401).json({ message: 'Google email is not verified' });
  }

  const email = String(payload.email).toLowerCase();
  let user = await User.findOne({ email });

  if (!user) {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    user = await User.create({
      name: payload.name || email.split('@')[0],
      email,
      passwordHash,
      googleId: payload.sub,
    });
  } else if (!user.googleId) {
    user.googleId = payload.sub;
    await user.save();
  }

  if (!user.active) {
    return res.status(401).json({ message: 'This account has been deactivated' });
  }

  const token = signToken(user._id.toString(), user.role);
  res.json({ token, user: publicUser(user) });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword are required' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ success: true });
}
