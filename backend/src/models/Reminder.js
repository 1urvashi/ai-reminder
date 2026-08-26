import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    // Creator/owner of the reminder (always set). assignedTo is who it's FOR —
    // null means it's a personal reminder for `user` themself; set means an
    // admin assigned it to a staff member.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    title: { type: String, required: true, trim: true },
    datetime: { type: Date, required: true },
    recurrence: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
      default: 'none',
    },
    // Whether the user has finished a one-time reminder. Recurring reminders
    // are never auto-completed; they roll forward to their next occurrence
    // until a recurrence end/count stops them.
    completed: { type: Boolean, default: false },
    // Timestamp of the current occurrence that has already been notified.
    // firedAt < datetime means the current occurrence still needs a nudge.
    firedAt: { type: Date, default: null },
    // Notify this many minutes BEFORE datetime (0 = exactly at datetime).
    leadMinutes: { type: Number, default: 0, min: 0 },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    category: { type: String, default: '', trim: true },
    // Optional stop conditions for recurring reminders.
    recurrenceEnd: { type: Date, default: null },
    recurrenceCount: { type: Number, default: null, min: 0 },
    notes: { type: String, default: '', trim: true },
    subtasks: [
      {
        title: { type: String, required: true, trim: true },
        done: { type: Boolean, default: false },
      },
    ],
    // True once datetime has passed without the reminder being completed.
    // Cleared on complete/snooze/reschedule.
    missed: { type: Boolean, default: false },
    // How many times a missed occurrence has been pushed to a new time.
    rescheduleCount: { type: Number, default: 0 },
    // Kanban board state — independent of completed/missed, which still drive
    // scheduling. Dragging to "completed" also sets completed=true.
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'blocked'],
      default: 'pending',
    },
    // Position within its status column, for stable Kanban drag-and-drop order.
    order: { type: Number, default: 0 },
    // Habit tracking: when enabled, the user "checks in" once per occurrence
    // (independent of completed/status) to build a streak. lastCheckinDate is
    // a UTC day key (YYYY-MM-DD) so a day only ever counts once.
    habit: { type: Boolean, default: false },
    streak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastCheckinDate: { type: String, default: null },
    // Escalation: when enabled, an un-acknowledged reminder keeps nudging
    // through progressively more insistent channels instead of firing once
    // and going quiet. escalationStage tracks how far the CURRENT occurrence
    // has escalated (0 = not yet); reset whenever it (re)fires, completes,
    // or is snoozed. See services/escalationService.js for the ladder.
    escalate: { type: Boolean, default: false },
    escalationStage: { type: Number, default: 0 },
    lastEscalatedAt: { type: Date, default: null },
    // Optional geofence: when set, the app alerts the user in-browser when
    // they come within radiusMeters of {lat, lng}. Client-side only — the
    // server just stores it.
    location: {
      type: new mongoose.Schema(
        {
          lat: { type: Number, default: null },
          lng: { type: Number, default: null },
          radiusMeters: { type: Number, default: 200 },
          label: { type: String, default: '', trim: true },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ completed: 1, datetime: 1 });

export default mongoose.model('Reminder', reminderSchema);
