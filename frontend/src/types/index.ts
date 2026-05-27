// ─── Meeting ────────────────────────────────────────────────────────────────

export type MeetingStatus = 'processing' | 'ready' | 'error';

export interface Meeting {
  id: string;
  title: string;
  date: string;           // ISO string
  duration: number;       // seconds
  status: MeetingStatus;
  audioUri?: string;
  transcript?: string;
  summary?: string;
  decisions?: string[];
  tasks?: Task[];
  tags?: string[];
}

// ─── Task ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  meetingId: string;
  title: string;
  description?: string;
  owner?: string;
  dueDate?: string;       // ISO string
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
}

// ─── Recording ───────────────────────────────────────────────────────────────

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface RecordingSession {
  uri: string;
  duration: number;
  size?: number;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface OverviewStats {
  totalMeetings: number;
  totalTasks: number;
  completedTasks: number;
  totalMinutes: number;
}
