import { Router } from 'express';
import multer from 'multer';
import { register, login, updateProfile, googleLogin, getProfileImage, deleteAccount } from '../controllers/auth.controller';
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

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/image/:filename', authMiddleware, getProfileImage);
router.patch('/profile', authMiddleware, upload.single('profileImage'), updateProfile);
router.delete('/account', authMiddleware, deleteAccount);

export default router;
