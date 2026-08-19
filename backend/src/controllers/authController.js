import bcrypt from 'bcryptjs';
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
