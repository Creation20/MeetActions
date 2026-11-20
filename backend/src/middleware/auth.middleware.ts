import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// No fallback. A hardcoded default secret in source means anyone who reads the repo
// can mint a valid token for any user if the env var is ever missing in production.
// Failing to boot is the correct behaviour.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: "Please sign in to continue." });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
};
