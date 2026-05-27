import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// 🤖 Dynamic API Host Detection
const getApiHost = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // 1. Android Simulator
  if (Platform.OS === 'android' && !Constants.isDevice) {
    return 'http://10.0.2.2:5005';
  }

  // 2. iOS Simulator
  if (Platform.OS === 'ios' && !Constants.isDevice) {
    return 'http://localhost:5005';
  }

  // 3. Real Device (Auto-detect Mac IP from Expo)
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':').shift();
    return `http://${ip}:5005`;
  }

  // 4. Fallback (Update this only if auto-detection fails)
  return 'http://172.20.10.3:5005';
};

export const API_HOST = getApiHost();
export const API_BASE_URL = `${API_HOST}/api/meetings`;

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
  summary?: string;
  decisions?: string[];
  tasks?: ApiTask[];
  tags?: string[];
  analysis?: {
    sentiment: 'positive' | 'neutral' | 'negative';
    tone: string;
    conflictDetected: boolean;
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

export const askMeeting = async (meetingId: string, question: string): Promise<string> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/${meetingId}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question })
    });
    if (!response.ok) throw new Error('Failed to get answer.');
    const data = await response.json();
    return data.answer;
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Connection error. Could not reach AI assistant.');
  }
};

export const askGlobal = async (question: string): Promise<string> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/ask-global`, {
      method: 'POST',
      body: JSON.stringify({ question })
    });
    if (!response.ok) throw new Error('Global AI query failed.');
    const data = await response.json();
    return data.answer;
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') throw error;
    throw new Error('Connection error. Could not reach AI hub.');
  }
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
