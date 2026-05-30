import express from 'express';
import {
  login,
  register,
  logout,
  adminProfile,
  updateUserById,
  getUser,
  getUserById,
} from '../../controllers/admin/auth.controller.js';
import auth from '../../middleware/auth.middleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/signup', register);
router.get('/logout', auth, logout);
router.get('/profile', auth, adminProfile);
router.put('/update-user/:id', auth, updateUserById);
router.get('/get-users', auth, getUser);
router.get('/get-user/:id', auth, getUserById);
export default router;
