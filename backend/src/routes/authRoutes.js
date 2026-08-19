import { Router } from 'express';
import { register, login, changePassword } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/change-password', requireAuth, asyncHandler(changePassword));

export default router;
