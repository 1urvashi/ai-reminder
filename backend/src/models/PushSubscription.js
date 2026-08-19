import mongoose from 'mongoose';

// One row per browser/device that has subscribed to Web Push. A user can have
// several (phone + laptop, etc.) — endpoint is the unique per-device identity.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
