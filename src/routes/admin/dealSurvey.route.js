import express from 'express';
import { adminGetSurveys } from '../../controllers/admin/dealSurvey.controller.js';
import adminAuth from '../../middleware/adminAuth.middleware.js';

const router = express.Router();

router.get('/', adminAuth, adminGetSurveys);

export default router;
