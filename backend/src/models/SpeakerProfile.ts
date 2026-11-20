import { Schema, model, Document } from 'mongoose';

export interface ISpeakerProfile extends Document {
  userId: Schema.Types.ObjectId;
  name: string;
  voiceSignature?: number[]; // Acoustic embedding
  meetings: Schema.Types.ObjectId[];
}

const SpeakerProfileSchema = new Schema<ISpeakerProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  voiceSignature: { type: [Number], default: [] },
  meetings: [{ type: Schema.Types.ObjectId, ref: 'Meeting' }]
}, { timestamps: true });

// Ensure unique names per user for now
SpeakerProfileSchema.index({ userId: 1, name: 1 }, { unique: true });

export const SpeakerProfile = model<ISpeakerProfile>('SpeakerProfile', SpeakerProfileSchema);
