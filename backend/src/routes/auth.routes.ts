import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { register, login, updateProfile, googleLogin, getProfileImage, deleteAccount, getMe } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import path from 'path';

const router = Router();

// Multer config for profile images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

/**
 * Credential endpoints get their own, much tighter budget. The global limiter
 * (100 requests / 15 min) is generous enough to be useful for password guessing;
 * this caps it at 10 attempts per IP per 15 minutes. Successful logins don't count
 * against it, so a legitimate user is never locked out by their own activity.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleLogin);
router.get('/me', authMiddleware, getMe);
router.get('/image/:filename', authMiddleware, getProfileImage);
router.patch('/profile', authMiddleware, upload.single('profileImage'), updateProfile);
router.delete('/account', authMiddleware, deleteAccount);

export default router;
