import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// 🤖 Dynamic API Host Detection
const getApiHost = () => {
  if (__DEV__) {
    // 🛠️ Development: Use local IP or Expo host
    const debuggerHost = Constants.expoConfig?.hostUri || Constants.experienceUrl;
    const localhost = debuggerHost?.split(':')[0] || '172.20.10.3';
    
    console.log(`[API] Development Mode: Using host ${localhost}`);
    return `http://${localhost}:5005`;
  }

  // 🚀 Cloudflare Tunnel (Ultra-stable, no signup required)
  return 'https://proof-hosted-template-chargers.trycloudflare.com';
};

export const API_HOST = getApiHost();
console.log('App initialized with API_HOST:', API_HOST);
export const API_BASE_URL = `${API_HOST}/api/meetings`;
export const API_INTEL_URL = `${API_HOST}/api/intelligence`;

const getAuthHeaders = async (isMultipart = false) => {
  const token = await AsyncStorage.getItem('@auth_token');
  const headers: any = {
    'Authorization': `Bearer ${token}`
  };
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

// Global Authenticated Fetch with 401 Interceptor
const authenticatedFetch = async (url: string, options: any = {}) => {
  const isMultipart = options.body instanceof FormData;
  const headers = await getAuthHeaders(isMultipart);

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (response.status === 401) {
    await AsyncStorage.multiRemove(['@auth_token', '@auth_user', '@is_premium', '@has_completed_onboarding']);
    throw new Error('SESSION_EXPIRED');
  }

  return response;
};

export interface ApiUser {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  /** Server-owned entitlement. The client displays this; it never decides it. */
  isPremium: boolean;
  plan: 'free' | 'premium';
  premiumUntil: string | null;
}

/** Re-syncs the signed-in user (and their entitlement) from the server. */
export const fetchMe = async (): Promise<ApiUser> => {
  const res = await authenticatedFetch(`${API_HOST}/api/auth/me`);
  if (!res.ok) throw new Error('Failed to fetch profile');
  const data = await res.json();
  return data.user;
};

export interface ApiProject {
  _id: string;
  name: string;
  color?: string;
  createdAt: string;
}

export interface ApiTask {
  _id: string;
  title: string;
  description?: string;
  owner?: string;
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

export interface ApiMeeting {
  _id: string;
  title: string;
  date: string;
  duration: number;
  status: 'processing' | 'ready' | 'error';
  audioUrl?: string;
  transcript?: string;
  diarized?: boolean;
  liveMode?: boolean;
  summary?: string;
  decisions?: string[];
  tasks?: ApiTask[];
  tags?: string[];
  analysis?: {
    sentiment: 'positive' | 'neutral' | 'negative';
    tone: string;
    conflictDetected: boolean;
    speakingTime?: { speakerId: string; durationSec: number; percentage: number }[];
    interruptionCount?: number;
    pacingScore?: number;
  };
  followUp?: {
    title: string;
    suggestedDate?: string;
  };
  speakerNames?: { [key: string]: string };
  projectId?: string;
  notes?: string;
}

export interface AnalyticsData {
  summary: {
    totalMeetings: number;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    totalHours: string;
  };
  topTags: { name: string; count: number }[];
  activity: {
    date: string;
    duration: number;
    tasks: number;
  }[];
}

export interface ProactiveInsights {
  tasks: Array<{ _id: string; title: string; priority: string; meetingTitle: string; meetingId: string; }>;
  lastMeeting: { title: string; summary: string; id: string; } | null;
}

export const fetchMeetings = async (): Promise<ApiMeeting[]> => {
  try {
    const response = await authenticatedFetch(API_BASE_URL);
    if (!response.ok) throw new Error('Our server is having trouble loading your meetings.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error(`Cannot connect to server at ${API_HOST}. Please ensure the backend is running and your IP is correct.`);
  }
};

export const fetchProjects = async (): Promise<ApiProject[]> => {
  try {
    const response = await authenticatedFetch(`${API_HOST}/api/projects`);
    if (!response.ok) throw new Error('Failed to load projects.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw error;
  }
};

export const createProject = async (name: string, color?: string): Promise<ApiProject> => {
  try {
    const response = await authenticatedFetch(`${API_HOST}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name, color })
    });
    if (!response.ok) throw new Error('Failed to create folder.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw error;
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  try {
    const response = await authenticatedFetch(`${API_HOST}/api/projects/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete folder.');
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw error;
  }
};

export const searchMeetings = async (query: string): Promise<ApiMeeting[]> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Cannot connect to the server for search.');
  }
};

export const fetchAnalytics = async (): Promise<AnalyticsData> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/analytics`);
    if (!response.ok) throw new Error('Failed to load analytics.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Cannot connect to the server for analytics.');
  }
};

export const fetchProactiveInsights = async (): Promise<ProactiveInsights> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/proactive-insights`);
    if (!response.ok) throw new Error('Failed to load insights.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw error;
  }
};

export const fetchMeetingById = async (id: string): Promise<ApiMeeting | null> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${id}`);
    if (response.status === 404) throw new Error('This meeting no longer exists or was deleted.');
    if (!response.ok) throw new Error('We encountered an issue loading this meeting.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    if (error.message.includes('meeting')) throw error;
    throw new Error('Cannot connect to the server. Please check your internet connection.');
  }
};

export const updateTaskStatus = async (meetingId: string, taskId: string, status: string): Promise<void> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Failed to update task. Please try again.');
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    if (error.message.includes('update')) throw error;
    throw new Error('Connection error. Task status was not saved.');
  }
};

export const deleteTask = async (meetingId: string, taskId: string): Promise<ApiMeeting> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete task.');
    const data = await response.json();
    return data.meeting;
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Connection error. Task was not deleted.');
  }
};

export const updateMeeting = async (meetingId: string, updates: Partial<ApiMeeting>): Promise<void> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update meeting.');
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Connection error. Changes were not saved.');
  }
};

export const renameMeeting = async (meetingId: string, title: string): Promise<void> => {
  return updateMeeting(meetingId, { title });
};

// Re-run the AI pipeline for a meeting that errored (real reprocessing, not just a status flip).
export const reprocessMeeting = async (meetingId: string): Promise<void> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}/reprocess`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to restart processing.');
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Connection error. Could not restart processing.');
  }
};

export const deleteMeeting = async (meetingId: string): Promise<void> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete meeting.');
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw error;
  }
};

export const addTask = async (meetingId: string, task: Partial<ApiTask>): Promise<ApiMeeting> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task)
    });
    if (!response.ok) throw new Error('Failed to add task.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Connection error. Task was not saved.');
  }
};

export const translateMeeting = async (meetingId: string, language: string): Promise<Partial<ApiMeeting>> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}/translate`, {
      method: 'POST',
      body: JSON.stringify({ language })
    });
    if (!response.ok) throw new Error('Translation failed.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw error;
  }
};

// ─── Cited answers (#9) ───────────────────────────────────────────────────────
export interface Citation {
  quote: string;
  timestamp?: string;      // [MM:SS] the quote came from, if available
  meetingId: string;
  meetingTitle: string;
}
export interface CitedAnswer {
  answer: string;
  citations: Citation[];
}

export const askMeeting = async (meetingId: string, question: string): Promise<CitedAnswer> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question })
    });
    if (!response.ok) throw new Error('Failed to get answer.');
    const data = await response.json();
    return { answer: data.answer, citations: data.citations || [] };
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Connection error. Could not reach AI assistant.');
  }
};

export const askGlobal = async (question: string): Promise<CitedAnswer> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/ask-global`, {
      method: 'POST',
      body: JSON.stringify({ question })
    });
    if (!response.ok) throw new Error('Global AI query failed.');
    const data = await response.json();
    return { answer: data.answer, citations: data.citations || [] };
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Connection error. Could not reach AI hub.');
  }
};

// ─── Semantic search (#7) ─────────────────────────────────────────────────────
export interface SemanticResult {
  meetingId: string;
  meetingTitle: string;
  date: string;
  snippet: string;
  score: number;
}
export const semanticSearch = async (query: string): Promise<{ results: SemanticResult[]; semantic: boolean }> => {
  try {
    const response = await authenticatedFetch(`${API_INTEL_URL}/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Semantic search failed.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Cannot connect to the server for search.');
  }
};

// ─── Extraction templates (#8) ────────────────────────────────────────────────
export interface ExtractionTemplateInfo {
  id: string;
  label: string;
  icon: string;
  description: string;
}
export const fetchTemplates = async (): Promise<ExtractionTemplateInfo[]> => {
  try {
    const response = await authenticatedFetch(`${API_INTEL_URL}/templates`);
    if (!response.ok) throw new Error('Failed to load templates.');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    // Non-fatal: fall back to a built-in Default.
    return [{ id: 'Default', label: 'General Meeting', icon: 'sparkles', description: 'Balanced analysis.' }];
  }
};

// ─── Cross-meeting memory (#1) ────────────────────────────────────────────────
export interface MemoryEntity {
  name: string;
  type: 'person' | 'project' | 'company' | 'concept';
  mentionCount: number;
  lastMentioned: string;
}
export interface EntityTimelineItem {
  meetingId: string;
  meetingTitle: string;
  context: string;
  date: string;
}
export interface Commitment {
  taskId: string;
  title: string;
  owner: string;
  priority: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  ageDays: number;
  overdue: boolean;
  dueDate?: string;
  likelyResolved: boolean;
  followUpNote: string;
}
export interface DecisionDrift {
  topic: string;
  earlier: string;
  earlierMeeting: string;
  later: string;
  laterMeeting: string;
  type: 'reversal' | 'change' | 'contradiction';
}

export const fetchEntities = async (): Promise<MemoryEntity[]> => {
  const response = await authenticatedFetch(`${API_INTEL_URL}/memory/entities`);
  if (!response.ok) throw new Error('Failed to load knowledge base.');
  return await response.json();
};

export const fetchEntityTimeline = async (name: string): Promise<{ name: string; type: string; timeline: EntityTimelineItem[] }> => {
  const response = await authenticatedFetch(`${API_INTEL_URL}/memory/entities/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error('Failed to load timeline.');
  return await response.json();
};

export const fetchCommitments = async (): Promise<{
  commitments: Commitment[];
  brokenPromises: Commitment[];
  stats: { total: number; overdue: number; stale: number };
}> => {
  const response = await authenticatedFetch(`${API_INTEL_URL}/memory/commitments`);
  if (!response.ok) throw new Error('Failed to load commitments.');
  return await response.json();
};

export const fetchDecisionDrift = async (): Promise<{ drifts: DecisionDrift[]; analyzed: number }> => {
  const response = await authenticatedFetch(`${API_INTEL_URL}/memory/drift`);
  if (!response.ok) throw new Error('Failed to analyze decisions.');
  return await response.json();
};

// ─── Pre-meeting briefing (#5) ────────────────────────────────────────────────
export interface Briefing {
  hasHistory: boolean;
  title: string;
  openItems: { title: string; owner?: string; priority: string; meetingTitle: string; meetingId: string }[];
  lastMeeting: { id: string; title: string; date: string; summary?: string } | null;
  talkingPoints: string[];
}
export const fetchBriefing = async (title: string): Promise<Briefing> => {
  const response = await authenticatedFetch(`${API_INTEL_URL}/briefing?title=${encodeURIComponent(title)}`);
  if (!response.ok) throw new Error('Failed to build briefing.');
  return await response.json();
};

// ─── Recap distribution (#4) ──────────────────────────────────────────────────
export const sendRecap = async (meetingId: string, emails: string[]): Promise<{
  sent: boolean; emailConfigured: boolean; recipients: string[]; preview: string; message: string;
}> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}/recap`, {
    method: 'POST',
    body: JSON.stringify({ emails }),
  });
  if (!response.ok) throw new Error('Failed to send recap.');
  return await response.json();
};

// ─── Live / streaming mode (#3) ───────────────────────────────────────────────
export const startLiveSession = async (title: string, mode = 'Default', projectId?: string): Promise<{ meetingId: string; title: string }> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/live/start`, {
    method: 'POST',
    body: JSON.stringify({ title, mode, projectId }),
  });
  if (!response.ok) throw new Error('Failed to start live session.');
  return await response.json();
};

export const sendLiveChunk = async (meetingId: string, chunkUri: string, offsetSec: number): Promise<{ segment: string; transcript: string }> => {
  const formData = new FormData();
  formData.append('offsetSec', String(offsetSec));
  formData.append('audio', {
    uri: chunkUri,
    name: `chunk-${offsetSec}.m4a`,
    type: 'audio/m4a',
  } as any);
  const response = await authenticatedFetch(`${API_BASE_URL}/live/${meetingId}/chunk`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to send live chunk.');
  return await response.json();
};

export const stopLiveSession = async (meetingId: string, duration: number, mode = 'Default'): Promise<{ meetingId: string; status: string }> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/live/${meetingId}/stop`, {
    method: 'POST',
    body: JSON.stringify({ duration, mode }),
  });
  if (!response.ok) throw new Error('Failed to stop live session.');
  return await response.json();
};

export const shareMeeting = async (meetingId: string, email: string): Promise<void> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}/share`, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to share meeting.');
    }
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw error;
  }
};


export const loginUser = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API_HOST}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Login failed. Please check your credentials.');
    }
    return await response.json();
  } catch (error: any) {
    throw error;
  }
};

export const registerUser = async (name: string, email: string, password: string) => {
  try {
    const response = await fetch(`${API_HOST}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Registration failed.');
    }
    return await response.json();
  } catch (error: any) {
    throw error;
  }
};

export const googleLoginUser = async (idToken: string, email: string, name: string) => {
  try {
    const response = await fetch(`${API_HOST}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, email, name })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Google login failed.');
    }
    return await response.json();
  } catch (error: any) {
    throw error;
  }
};

export const updateProfile = async (userId: string, name?: string, email?: string, password?: string, imageUri?: string) => {
  try {
    const formData = new FormData();
    formData.append('userId', userId);
    if (name) formData.append('name', name);
    if (email) formData.append('email', email);
    if (password) formData.append('password', password);
    if (imageUri) {
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      formData.append('profileImage', {
        uri: imageUri,
        name: filename,
        type: 'image/jpeg'
      } as any);
    }

    const response = await authenticatedFetch(`${API_HOST}/api/auth/profile`, {
      method: 'PATCH',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to update profile');
    return await response.json();
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw error;
  }
};

export const deleteAccount = async (): Promise<void> => {
  try {
    const response = await authenticatedFetch(`${API_HOST}/api/auth/account`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete account.');
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw error;
  }
};
