import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  profilePicture?: string;
  /** Entitlement is server-owned. Never trust a client-supplied premium flag. */
  plan: 'free' | 'premium';
  /** Null for a non-expiring grant; a past date means the entitlement has lapsed. */
  premiumUntil?: Date | null;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  profilePicture: { type: String, default: '' },
  plan: { type: String, enum: ['free', 'premium'], default: 'free' },
  premiumUntil: { type: Date, default: null },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
