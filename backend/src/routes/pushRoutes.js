import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getPublicKey, subscribe, unsubscribe } from '../controllers/pushController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/public-key', asyncHandler(getPublicKey));
router.post('/subscribe', requireAuth, asyncHandler(subscribe));
router.post('/unsubscribe', requireAuth, asyncHandler(unsubscribe));

export default router;
