import express from 'express';
import * as userController from '../controllers/user.controller.js';
import auth from '../middleware/auth.middleware.js';
import uploadFile from '../config/imageKit.config.js';
import { allowUploadFields } from '../utils/multer.js';
// import upload from '../middleware/multer.js';
// import uploadSingleImage from '../middleware/uploadMiddleware.js';
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
router.get('/user-profile', userController.getUserProfile);
router.post('/update-profile', auth, allowUploadFields(), userController.updateProfile);

// router.post('/address', auth, userController.addAddress);
// router.get('/logout',auth,userController.logout)

// router.post('/aadhaar', auth, upload.single('aadhaarImage'), userController.verifyAadhaar);

export default router;
