import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User, IUser } from '../models/User';
import { isEntitled } from '../middleware/premium.middleware';
import { Meeting } from '../models/Meeting';
import { Project } from '../models/Project';
import * as JWT from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { AuthRequest } from '../middleware/auth.middleware';
import fs from 'fs';
import path from 'path';
import { fail } from '../utils/respond';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

/**
 * The single shape of a user sent to a client. `isPremium` is derived here from the
 * server-owned entitlement so the app never has to guess (and can never self-grant).
 */
const toPublicUser = (user: IUser) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  profilePicture: user.profilePicture,
  isPremium: isEntitled(user),
  plan: user.plan,
  premiumUntil: user.premiumUntil ?? null,
});

/** Lets the app re-sync entitlement on launch instead of trusting cached local state. */
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: "We couldn't find your account." });
      return;
    }
    res.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "We couldn't load your profile. Please try again." });
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // Registration was accepting anything — including a one-character password, a
    // missing email, or a non-string (which lets a crafted body reach the query).
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: 'Please enter your name.' });
      return;
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ message: 'Please enter a valid email address.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ message: 'Your password needs to be at least 8 characters.' });
      return;
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      res.status(400).json({ message: "An account with that email already exists. Try signing in instead." });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash });
    await user.save();

    const token = JWT.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    fail(res, 500, "We couldn't create your account. Please try again in a moment.", error);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Reject non-strings before they reach the query. A body like
    // {"email": {"$ne": null}} would otherwise be interpreted as a Mongo operator
    // and match an arbitrary user rather than being treated as a literal address.
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ message: "That email or password isn't right. Please try again." });
      return;
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      console.log(`[Auth] User not found: ${email}`);
      res.status(401).json({ message: "That email or password isn't right. Please try again." });
      return;
    }
    
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      console.log(`[Auth] Password mismatch for: ${email}`);
      res.status(401).json({ message: "That email or password isn't right. Please try again." });
      return;
    }
    
    console.log(`[Auth] Login successful for: ${email}`);
    const token = JWT.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token, user: toPublicUser(user) });
  } catch (error) {
    fail(res, 500, "We couldn't sign you in right now. Please try again in a moment.", error);
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      res.status(400).json({ message: "We couldn't complete Google sign-in. Please try again." });
      return;
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(401).json({ message: "We couldn't verify your Google account. Please try again." });
      return;
    }

    const { email, name, picture } = payload;
    
    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-10);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(randomPassword, salt);
      
      user = new User({ 
        name: name || 'Google User', 
        email, 
        passwordHash,
        profilePicture: picture
      });
      await user.save();
    }
    
    const token = JWT.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token, user: toPublicUser(user) });
  } catch (error) {
    console.error('Google Login Error:', error);
    fail(res, 500, 'Authentication with Google failed', error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const userId = req.userId; // Securely getting from middleware
    
    if (!userId) {
      res.status(401).json({ message: "Please sign in again to continue." });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }
    if (req.file) {
      updateData.profilePicture = req.file.path;
    }
    
    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!user) {
      res.status(404).json({ message: "We couldn't find your account." });
      return;
    }
    res.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    fail(res, 500, "We couldn't save your profile. Please try again.", error);
  }
};

export const getProfileImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const filePath = path.join('uploads', filename as string);
    const absolutePath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ message: "That profile photo is no longer available." });
      return;
    }
    res.sendFile(absolutePath);
  } catch (error) {
    fail(res, 500, "We couldn't load that profile photo.", error);
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Please sign in again to continue." });
      return;
    }

    const meetings = await Meeting.find({ userId });
    for (const meeting of meetings) {
      if (meeting.audioUrl) {
        const audioPath = path.join(process.cwd(), meeting.audioUrl);
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      }
    }

    await Promise.all([
      Meeting.deleteMany({ userId: userId as any }),
      Project.deleteMany({ userId: userId as any }),
      User.findByIdAndDelete(userId)
    ]);

    res.status(200).json({ message: 'Account and all associated data deleted successfully.' });
  } catch (error) {
    fail(res, 500, "We couldn't delete your account. Please try again, or contact support if this keeps happening.", error);
  }
};
