import mongoose from 'mongoose';

// Delivery channel preferences. inApp is always available; whatsapp and call
// additionally require a phone number and Twilio configuration on the server.
const channelsSchema = new mongoose.Schema(
  {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    call: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    timezone: { type: String, default: 'UTC' },
    avatarUrl: { type: String, default: '' },
    // E.164 phone number (e.g. +919876543210) used for WhatsApp and voice calls.
    phone: { type: String, default: '', trim: true },
    channels: { type: channelsSchema, default: () => ({}) },
    // Every user is their own "admin" by default (personal use). An admin can
    // create staff accounts to assign reminders/tasks to and track their work.
    role: { type: String, enum: ['admin', 'staff'], default: 'admin' },
    department: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Gamification: points accumulate from completing tasks/habits; badges are
    // milestone keys (see services/gamification.js) earned once and kept forever.
    points: { type: Number, default: 0 },
    badges: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
