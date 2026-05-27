import { Schema, model, Document } from 'mongoose';

export interface IProject extends Document {
  userId: Schema.Types.ObjectId;
  name: string;
  color?: string;
}

const ProjectSchema = new Schema<IProject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    color: { type: String, default: '#007AFF' },
  },
  { timestamps: true }
);

export const Project = model<IProject>('Project', ProjectSchema);
