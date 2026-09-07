import { Router } from 'express';
import { requireAuth, blockViewer } from '../middleware/auth.js';
import {
  listReminders,
  createReminder,
  updateReminder,
  updateReminderStatus,
  snoozeReminder,
  completeReminder,
  acknowledgeReminder,
  checkinHabit,
  deleteReminder,
  rescheduleMissed,
  getCategories,
  getStats,
} from '../controllers/reminderController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// Read-only endpoints — viewers may use these too.
router.get('/stats', requireAuth, asyncHandler(getStats));
router.get('/categories', requireAuth, asyncHandler(getCategories));
router.get('/', requireAuth, asyncHandler(listReminders));

// Mutating endpoints — blocked for the read-only 'viewer' role.
router.post('/reschedule-missed', requireAuth, blockViewer, asyncHandler(rescheduleMissed));
router.post('/', requireAuth, blockViewer, asyncHandler(createReminder));
router.put('/:id', requireAuth, blockViewer, asyncHandler(updateReminder));
router.patch('/:id/status', requireAuth, blockViewer, asyncHandler(updateReminderStatus));
router.post('/:id/snooze', requireAuth, blockViewer, asyncHandler(snoozeReminder));
router.post('/:id/complete', requireAuth, blockViewer, asyncHandler(completeReminder));
router.post('/:id/acknowledge', requireAuth, blockViewer, asyncHandler(acknowledgeReminder));
router.post('/:id/checkin', requireAuth, blockViewer, asyncHandler(checkinHabit));
router.delete('/:id', requireAuth, blockViewer, asyncHandler(deleteReminder));

export default router;
