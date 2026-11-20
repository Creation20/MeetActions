import { Schema, model, Document } from 'mongoose';

export interface ITask {
  _id?: any;
  title: string;
  description?: string;
  owner?: string;
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

export interface IMeeting extends Document {
  userId: any;
  title: string;
  date: Date;
  duration: number; // in seconds
  status: 'processing' | 'ready' | 'error';
  audioUrl?: string;
  transcript?: string;
  diarized?: boolean;
  liveMode?: boolean;
  summary?: string;
  decisions?: string[];
  tasks?: ITask[];
  tags?: string[];
  analysis?: {
    sentiment: string;
    tone: string;
    conflictDetected: boolean;
    speakingTime?: { speakerId: string; durationSec: number; percentage: number }[];
    interruptionCount?: number;
    pacingScore?: number; // words per minute average
  };
  followUp?: {
    title: string;
    suggestedDate?: Date;
  };
  speakerNames?: { [key: string]: string };
  notes?: string;
  sharedWith?: any[];
  projectId?: any;
  chunks?: {
    content: string;
    embedding: number[];
    index: number;
  }[];
}

const TaskSchema = new Schema<ITask>({
  title: { type: String, required: true },
  description: { type: String },
  owner: { type: String },
  dueDate: { type: Date },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed'], 
    default: 'pending' 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium' 
  }
});

const MeetingSchema = new Schema<IMeeting>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    date: { type: Date, default: Date.now },
    duration: { type: Number, default: 0 },
    status: { 
      type: String, 
      enum: ['processing', 'ready', 'error'], 
      default: 'processing' 
    },
    audioUrl: { type: String },
    transcript: { type: String },
    diarized: { type: Boolean, default: false },
    liveMode: { type: Boolean, default: false },
    summary: { type: String },
    decisions: [{ type: String }],
    tasks: [TaskSchema],
    tags: [{ type: String }],
    analysis: {
      sentiment: { type: String },
      tone: { type: String },
      conflictDetected: { type: Boolean, default: false },
      speakingTime: [{
        speakerId: String,
        durationSec: Number,
        percentage: Number
      }],
      interruptionCount: { type: Number, default: 0 },
      pacingScore: { type: Number, default: 0 }
    },
    followUp: {
      title: { type: String },
      suggestedDate: { type: Date }
    },
    speakerNames: { type: Map, of: String, default: {} },
    notes: { type: String, default: '' },
    sharedWith: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    chunks: [{
      content: String,
      embedding: [Number],
      index: Number
    }]
  },
  { timestamps: true }
);

export const Meeting = model<IMeeting>('Meeting', MeetingSchema);
