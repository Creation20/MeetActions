import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import meetingRoutes from './routes/meeting.routes';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import path from 'path';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import logger from './services/logger.service';

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Set to false if you are not serving HTML or have complex CSP needs
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

const allowedOrigins = ['http://localhost:19006', 'http://localhost:8081', 'http://localhost:5173']; 
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://172.') || origin.startsWith('http://192.')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/projects', projectRoutes);

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  logger.error(`${err.message} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  
  if (err instanceof Error && err.message.includes('file type')) {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 50MB.' });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS Error: Origin not allowed' });
  }
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('CRITICAL: MONGODB_URI is not defined in environment variables.');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    logger.info('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    logger.error('❌ MongoDB connection error:', error);
  });
