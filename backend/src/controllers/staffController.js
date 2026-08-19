import bcrypt from 'bcryptjs';
import User from '../models/User.js';

function publicStaff(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    department: user.department,
    active: user.active,
    createdAt: user.createdAt,
  };
}

// Staff members are other User documents (role: 'staff'), created by an admin
// so reminders can be assigned to them and their progress tracked.
export async function listStaff(req, res) {
  const staff = await User.find({ role: 'staff', createdBy: req.userId }).sort({ name: 1 });
  res.json({ staff: staff.map(publicStaff) });
}

export async function createStaff(req, res) {
  const { name, email, password, phone, department } = req.body;

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
  const staff = await User.create({
    name,
    email,
    passwordHash,
    role: 'staff',
    phone: phone || '',
    department: department || '',
    createdBy: req.userId,
  });

  res.status(201).json({ staff: publicStaff(staff) });
}

export async function updateStaff(req, res) {
  const update = {};
  for (const key of ['name', 'phone', 'department', 'active']) {
    if (req.body[key] !== undefined) {
      update[key] = req.body[key];
    }
  }

  const staff = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'staff', createdBy: req.userId },
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
    role: 'staff',
    createdBy: req.userId,
  });
  if (!staff) {
    return res.status(404).json({ message: 'Staff member not found' });
  }
  res.json({ success: true });
}
