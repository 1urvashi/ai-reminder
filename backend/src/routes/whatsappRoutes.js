import { Router } from 'express';
import express from 'express';
import { verifyTwilioSignature } from '../middleware/twilioSignature.js';
import { incoming } from '../controllers/whatsappController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// Twilio posts application/x-www-form-urlencoded and signs each request.
const parseForm = express.urlencoded({ extended: false });

router.post('/incoming', parseForm, verifyTwilioSignature, asyncHandler(incoming));

export default router;
