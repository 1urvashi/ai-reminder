import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listReminders,
  createReminder,
  updateReminder,
  updateReminderStatus,
  snoozeReminder,
  completeReminder,
  checkinHabit,
  deleteReminder,
  rescheduleMissed,
  getCategories,
  getStats,
} from '../controllers/reminderController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/stats', requireAuth, asyncHandler(getStats));
router.get('/categories', requireAuth, asyncHandler(getCategories));
router.post('/reschedule-missed', requireAuth, asyncHandler(rescheduleMissed));
router.get('/', requireAuth, asyncHandler(listReminders));
router.post('/', requireAuth, asyncHandler(createReminder));
router.put('/:id', requireAuth, asyncHandler(updateReminder));
router.patch('/:id/status', requireAuth, asyncHandler(updateReminderStatus));
router.post('/:id/snooze', requireAuth, asyncHandler(snoozeReminder));
router.post('/:id/complete', requireAuth, asyncHandler(completeReminder));
router.post('/:id/checkin', requireAuth, asyncHandler(checkinHabit));
router.delete('/:id', requireAuth, asyncHandler(deleteReminder));

export default router;
