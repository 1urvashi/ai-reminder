import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getProfile, updateProfile } from '../controllers/userController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/me', requireAuth, asyncHandler(getProfile));
router.put('/me', requireAuth, asyncHandler(updateProfile));

export default router;
