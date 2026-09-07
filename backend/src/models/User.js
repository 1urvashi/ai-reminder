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
    // Set once a Google Sign-In account is linked. Google-only accounts still
    // get a random passwordHash at creation (schema requires one) — they just
    // never use it, since they always sign in via Google.
    googleId: { type: String, default: null, index: true, sparse: true },
    timezone: { type: String, default: 'UTC' },
    avatarUrl: { type: String, default: '' },
    // E.164 phone number (e.g. +919876543210) used for WhatsApp and voice calls.
    phone: { type: String, default: '', trim: true },
    channels: { type: channelsSchema, default: () => ({}) },
    // Every user is their own "admin" by default (personal use). An admin can
    // create team-member accounts (manager/employee/viewer) to assign
    // reminders/tasks to and track their work:
    //   admin   — full access, including creating/managing the team roster
    //   manager — same reminder/Kanban access as admin (assign to anyone,
    //             see everyone's board), but cannot manage the team roster
    //   employee — sees/acts on only their own + assigned-to-them reminders
    //   viewer  — same visibility as manager, but strictly read-only
    role: { type: String, enum: ['admin', 'manager', 'employee', 'viewer'], default: 'admin' },
    department: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Gamification: points accumulate from completing tasks/habits; badges are
    // milestone keys (see services/gamification.js) earned once and kept forever.
    points: { type: Number, default: 0 },
    badges: [{ type: String }],
    // Optional backup contact (family/caregiver) for the escalation engine's
    // final stage — notified when a reminder is repeatedly unacknowledged.
    caregiver: {
      name: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
