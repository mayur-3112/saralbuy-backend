import express from 'express';
import {
  login,
  register,
  logout,
  adminProfile,
  updateUserById,
  getUser,
  getUserById,
  adminResetUserPassword,
} from '../../controllers/admin/auth.controller.js';
import adminAuth from '../../middleware/adminAuth.middleware.js';

const router = express.Router();

router.post('/login', login);
// router.post('/signup', register); // Disabled for security. Use CLI script to seed admins.
router.get('/logout', adminAuth, logout);
router.get('/profile', adminAuth, adminProfile);
router.put('/update-user/:id', adminAuth, updateUserById);
router.post('/reset-user-password/:userId', adminAuth, adminResetUserPassword);
router.get('/get-users', adminAuth, getUser);
router.get('/get-user/:id', adminAuth, getUserById);
export default router;
