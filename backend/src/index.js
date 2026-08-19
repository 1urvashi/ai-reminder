import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { startScheduler } from './services/reminderScheduler.js';

const port = process.env.PORT || 5000;
const schedulerInterval = Number(process.env.SCHEDULER_INTERVAL_MS) || undefined;

connectDB(process.env.MONGO_URI)
  .then(() => {
    const app = createApp();
    app.listen(port, () => console.log(`Server listening on port ${port}`));
    startScheduler(schedulerInterval);
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
