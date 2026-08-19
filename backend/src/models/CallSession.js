import mongoose from 'mongoose';

// Conversation state for one outbound reminder call, keyed by Twilio's CallSid.
// Twilio webhooks are stateless, so the message history is persisted here across
// turns. Documents auto-expire an hour after creation via a TTL index.
const callSessionSchema = new mongoose.Schema(
  {
    callSid: { type: String, required: true, unique: true, index: true },
    reminder: { type: mongoose.Schema.Types.ObjectId, ref: 'Reminder', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Anthropic message array (roles user/assistant + tool blocks).
    messages: { type: Array, default: [] },
    ended: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 3600 },
  },
  { minimize: false }
);

export default mongoose.model('CallSession', callSessionSchema);
