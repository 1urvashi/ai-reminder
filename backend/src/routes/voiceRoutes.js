import { Router } from 'express';
import express from 'express';
import { verifyTwilioSignature } from '../middleware/twilioSignature.js';
import { incoming, turn } from '../controllers/voiceController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// Twilio posts application/x-www-form-urlencoded and signs each request.
// Body must be parsed before the signature can be verified.
const parseForm = express.urlencoded({ extended: false });

router.post('/incoming', parseForm, verifyTwilioSignature, asyncHandler(incoming));
router.post('/turn', parseForm, verifyTwilioSignature, asyncHandler(turn));

export default router;
