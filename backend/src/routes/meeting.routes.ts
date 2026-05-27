import { Router } from 'express';
import multer from 'multer';
import { 
  getMeetings, 
  getMeetingById, 
  createMeeting, 
  updateMeeting,
  updateTaskStatus,
  deleteMeeting,
  searchMeetings,
  getAnalytics,
  addTask,
  translateMeeting,
  askMeeting,
  askGlobal,
  shareMeeting,
  unshareMeeting,
  getProactiveInsights,
  getMediaFile
} from '../controllers/meeting.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authMiddleware to ALL meeting routes
router.use(authMiddleware);

// Configure multer for audio upload handling
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Usually files might be .m4a, .mp3, .wav, etc. We'll grab the original extension.
    const ext = file.originalname.split('.').pop();
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/m4a', 'image/jpeg', 'image/png', 'application/octet-stream'];
    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(m4a|mp3|wav|jpg|jpeg|png)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio and images are allowed.'));
    }
  }
});

// Routes
router.get('/analytics', getAnalytics);
router.get('/proactive-insights', getProactiveInsights);
router.get('/media/:filename', getMediaFile);
router.get('/search', searchMeetings); 
router.post('/ask-global', askGlobal);
router.get('/', getMeetings);
router.get('/:id', getMeetingById);
router.patch('/:id', updateMeeting);
router.delete('/:id', deleteMeeting);
router.post('/:id/tasks', addTask);
router.post('/:id/translate', translateMeeting);
router.post('/:id/ask', askMeeting);
router.post('/:id/share', shareMeeting);
router.post('/:id/unshare', unshareMeeting);

// POST endpoint requires the multipart/form-data field name to be 'audio' and 'image'
router.post('/', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'image', maxCount: 1 }]), createMeeting);

router.patch('/:meetingId/tasks/:taskId', updateTaskStatus);

export default router;
