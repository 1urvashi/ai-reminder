import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listNotifications,
  markRead,
  markAllRead,
  sendTest,
} from '../controllers/notificationController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(listNotifications));
router.post('/test', requireAuth, asyncHandler(sendTest));
router.post('/read-all', requireAuth, asyncHandler(markAllRead));
router.post('/:id/read', requireAuth, asyncHandler(markRead));

export default router;
