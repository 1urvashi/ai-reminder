import User from '../models/User.js';

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

function buildChannelUpdate(channels) {
  const update = {};
  if (typeof channels.inApp === 'boolean') update['channels.inApp'] = channels.inApp;
  if (typeof channels.email === 'boolean') update['channels.email'] = channels.email;
  if (typeof channels.whatsapp === 'boolean') update['channels.whatsapp'] = channels.whatsapp;
  if (typeof channels.call === 'boolean') update['channels.call'] = channels.call;
  if (typeof channels.push === 'boolean') update['channels.push'] = channels.push;
  return update;
}

export async function getProfile(req, res) {
  const user = await User.findById(req.userId).select('-passwordHash');
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ user });
}

export async function updateProfile(req, res) {
  const { name, timezone, avatarUrl, phone, channels } = req.body;

  const update = {};
  if (name !== undefined) update.name = name;
  if (timezone !== undefined) update.timezone = timezone;
  if (avatarUrl !== undefined) update.avatarUrl = avatarUrl;

  if (phone !== undefined) {
    const trimmed = String(phone).trim();
    if (trimmed !== '' && !E164_PATTERN.test(trimmed)) {
      return res.status(400).json({ message: 'phone must be E.164 format, e.g. +919876543210' });
    }
    update.phone = trimmed;
  }

  if (channels !== undefined) {
    if (typeof channels !== 'object' || channels === null) {
      return res.status(400).json({ message: 'channels must be an object' });
    }
    Object.assign(update, buildChannelUpdate(channels));
  }

  const user = await User.findByIdAndUpdate(req.userId, update, {
    new: true,
    runValidators: true,
  }).select('-passwordHash');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ user });
}
