import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listStaff, createStaff, updateStaff, deleteStaff } from '../controllers/staffController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));
router.get('/', asyncHandler(listStaff));
router.post('/', asyncHandler(createStaff));
router.put('/:id', asyncHandler(updateStaff));
router.delete('/:id', asyncHandler(deleteStaff));

export default router;
