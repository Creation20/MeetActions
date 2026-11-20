import 'dotenv/config';
import './services/sentry.service'; // must run before express is instantiated
import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import meetingRoutes from './routes/meeting.routes';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import intelligenceRoutes from './routes/intelligence.routes';
import path from 'path';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import logger from './services/logger.service';
import { isSentryEnabled } from './services/sentry.service';
import { recoverStuckMeetings } from './services/recovery.service';

const app = express();
const PORT = Number(process.env.PORT) || 5005;

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Set to false if you are not serving HTML or have complex CSP needs
}));

// Health check. Declared before the rate limiter so a frequent uptime probe can
// never be throttled into reporting a false outage. Returns 503 when the database
// is unreachable, so the load balancer pulls the instance instead of serving 500s.
app.get('/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    db: dbConnected ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Global Request Logger
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

const allowedOrigins = ['http://localhost:19006', 'http://localhost:8081', 'http://localhost:5173']; 
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://172.') || origin.startsWith('http://192.') || origin.endsWith('.loca.lt')) {
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
app.use('/api/intelligence', intelligenceRoutes);

// Reports unhandled errors to Sentry (no-op when SENTRY_DSN is unset) before our
// own handler turns them into a response.
Sentry.setupExpressErrorHandler(app);

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
    return res.status(403).json({ message: 'This app version cannot reach the server. Please update the app.' });
  }
  // The real error is logged above and sent to Sentry. Never echo it to the client:
  // stack frames and driver messages are both a leak and useless to the person reading.
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on our end. Please try again in a moment.' });
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('CRITICAL: MONGODB_URI is not defined in environment variables.');
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  logger.warn('⚠️ WARNING: GEMINI_API_KEY is not defined. AI features will fail.');
} else {
  logger.info('✅ GEMINI_API_KEY detected');
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    logger.info('✅ Connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(isSentryEnabled ? '✅ Sentry error tracking enabled' : 'ℹ️ SENTRY_DSN unset — error tracking disabled');

      // Adopt any meetings the previous process left mid-pipeline. Runs after
      // listen() so a slow sweep never delays readiness for the health probe.
      recoverStuckMeetings();
    });
  })
  .catch((error) => {
    logger.error('❌ MongoDB connection error:', error);
  });
