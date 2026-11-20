import { Schema, model, Document } from 'mongoose';

export interface IKnowledgeEntity extends Document {
  userId: Schema.Types.ObjectId;
  name: string;
  type: 'person' | 'project' | 'company' | 'concept';
  mentions: {
    meetingId: Schema.Types.ObjectId;
    context: string;
    date: Date;
  }[];
}

const KnowledgeEntitySchema = new Schema<IKnowledgeEntity>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['person', 'project', 'company', 'concept'], 
    required: true 
  },
  mentions: [{
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting' },
    context: String,
    date: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Unique per user + name
KnowledgeEntitySchema.index({ userId: 1, name: 1 }, { unique: true });

export const KnowledgeEntity = model<IKnowledgeEntity>('KnowledgeEntity', KnowledgeEntitySchema);
