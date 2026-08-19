import { Router } from 'express';
import { requireApiKey } from '../middleware/apiKey.js';
import { getDailySummary } from '../controllers/automationController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/daily-summary', requireApiKey, asyncHandler(getDailySummary));

export default router;
