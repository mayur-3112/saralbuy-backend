import express from 'express';
import * as userController from '../controllers/user.controller.js';
import auth from '../middleware/auth.middleware.js';
import uploadFile from '../config/imageKit.config.js';
import { allowUploadFields } from '../utils/multer.js';
const otpController =
  process.env.NODE_ENV === 'development' ? userController.sendOtp : userController.factorSendOtp;
const verifyController =
  process.env.NODE_ENV === 'development'
    ? userController.verifyOtp
    : userController.factorVerifyOtp;
const router = express.Router();
router.post('/send-otp', otpController);
router.post('/verify-otp', verifyController);
router.get('/logout', auth, userController.logout);
router.get('/profile', auth, userController.getProfile);
router.get('/user-profile', auth, userController.getUserProfile);
router.post('/update-profile', auth, allowUploadFields(), userController.updateProfile);

// Business verification (GSTIN/PAN) — supplier trust replacement for Aadhaar
router.post(
  '/submit-verification',
  auth,
  allowUploadFields([{ name: 'gstinDocument', maxCount: 1 }, { name: 'panDocument', maxCount: 1 }]),
  userController.submitVerification
);
router.get('/verification-status', auth, userController.getVerificationStatus);

export default router;
