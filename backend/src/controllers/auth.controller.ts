import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { Project } from '../models/Project';
import * as JWT from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { AuthRequest } from '../middleware/auth.middleware';
import fs from 'fs';
import path from 'path';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ message: 'Email already exists' });
      return;
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const user = new User({ name, email, passwordHash });
    await user.save();
    
    const token = JWT.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { _id: user._id, name: user.name, email: user.email, profilePicture: user.profilePicture } });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    
    const token = JWT.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token, user: { _id: user._id, name: user.name, email: user.email, profilePicture: user.profilePicture } });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      res.status(400).json({ message: 'Missing ID Token' });
      return;
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(401).json({ message: 'Invalid Google token' });
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
    res.status(200).json({ token, user: { _id: user._id, name: user.name, email: user.email, profilePicture: user.profilePicture } });
  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(500).json({ message: 'Authentication with Google failed', error });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const userId = req.userId; // Securely getting from middleware
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
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
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(200).json({ user: { _id: user._id, name: user.name, email: user.email, profilePicture: user.profilePicture } });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error });
  }
};

export const getProfileImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const filePath = path.join('uploads', filename as string);
    const absolutePath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ message: 'Profile image not found' });
      return;
    }
    res.sendFile(absolutePath);
  } catch (error) {
    res.status(500).json({ message: 'Error serving profile image', error });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
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
    res.status(500).json({ message: 'Error deleting account', error });
  }
};
