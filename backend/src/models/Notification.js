import mongoose from 'mongoose';

// A nudge generated when a reminder falls due. The scheduler creates these;
// the frontend polls for unread ones and surfaces them as alerts.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reminder: { type: mongoose.Schema.Types.ObjectId, ref: 'Reminder', default: null },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    dueAt: { type: Date, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
