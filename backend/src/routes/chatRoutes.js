import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendMessage } from '../controllers/chatController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/message', requireAuth, asyncHandler(sendMessage));

export default router;
