import express from 'express';
import auth from '../middleware/auth.middleware.js';
import { submitSurvey, getSurveyByDeal } from '../controllers/dealSurvey.controller.js';

const router = express.Router();

router.post('/', auth, submitSurvey);
router.get('/:dealId', auth, getSurveyByDeal);

export default router;
