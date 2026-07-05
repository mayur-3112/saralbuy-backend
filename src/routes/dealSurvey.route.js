import express from 'express';
import { submitSurvey, checkSurveyStatus } from '../controllers/dealSurvey.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/submit', auth, submitSurvey);
router.get('/status/:dealId', auth, checkSurveyStatus);

export default router;
