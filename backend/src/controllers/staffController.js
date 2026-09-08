import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const TEAM_ROLES = ['manager', 'employee', 'viewer'];
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

function validatePhone(phone) {
  const trimmed = String(phone || '').trim();
  if (trimmed !== '' && !E164_PATTERN.test(trimmed)) {
    return { error: 'phone must be E.164 format, e.g. +919876543210' };
  }
  return { value: trimmed };
}

function publicStaff(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    department: user.department,
    active: user.active,
    role: user.role,
    createdAt: user.createdAt,
  };
}

// Team members are other User documents (role: manager/employee/viewer),
// created by an admin so reminders can be assigned to them and their
// progress tracked. Only an admin manages the roster — a manager gets
// elevated reminder/Kanban access but not this page (see reminderController
// and the frontend's admin-only Staff page gating).
export async function listStaff(req, res) {
  const staff = await User.find({ role: { $in: TEAM_ROLES }, createdBy: req.userId }).sort({ name: 1 });
  res.json({ staff: staff.map(publicStaff) });
}

export async function createStaff(req, res) {
  const { name, email, password, phone, department, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }
  const teamRole = role || 'employee';
  if (!TEAM_ROLES.includes(teamRole)) {
    return res.status(400).json({ message: `role must be one of: ${TEAM_ROLES.join(', ')}` });
  }
  const phoneResult = validatePhone(phone);
  if (phoneResult.error) {
    return res.status(400).json({ message: phoneResult.error });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const staff = await User.create({
    name,
    email,
    passwordHash,
    role: teamRole,
    phone: phoneResult.value,
    department: department || '',
    createdBy: req.userId,
  });

  res.status(201).json({ staff: publicStaff(staff) });
}

export async function updateStaff(req, res) {
  const update = {};
  for (const key of ['name', 'department', 'active']) {
    if (req.body[key] !== undefined) {
      update[key] = req.body[key];
    }
  }
  if (req.body.phone !== undefined) {
    const phoneResult = validatePhone(req.body.phone);
    if (phoneResult.error) {
      return res.status(400).json({ message: phoneResult.error });
    }
    update.phone = phoneResult.value;
  }
  if (req.body.role !== undefined) {
    if (!TEAM_ROLES.includes(req.body.role)) {
      return res.status(400).json({ message: `role must be one of: ${TEAM_ROLES.join(', ')}` });
    }
    update.role = req.body.role;
  }

  const staff = await User.findOneAndUpdate(
    { _id: req.params.id, role: { $in: TEAM_ROLES }, createdBy: req.userId },
    update,
    { new: true, runValidators: true }
  );
  if (!staff) {
    return res.status(404).json({ message: 'Staff member not found' });
  }
  res.json({ staff: publicStaff(staff) });
}

export async function deleteStaff(req, res) {
  const staff = await User.findOneAndDelete({
    _id: req.params.id,
    role: { $in: TEAM_ROLES },
    createdBy: req.userId,
  });
  if (!staff) {
    return res.status(404).json({ message: 'Staff member not found' });
  }
  res.json({ success: true });
}
