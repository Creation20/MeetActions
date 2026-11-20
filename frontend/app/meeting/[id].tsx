import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Share, StyleSheet, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, FlatList } from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/constants/theme';
import { GlassCard, PillTabs, Badge, Divider } from '../../src/components/ui';
import { fetchMeetingById, ApiMeeting, updateTaskStatus, renameMeeting, deleteMeeting, API_HOST, addTask, translateMeeting, askMeeting, updateMeeting, shareMeeting, fetchProjects, ApiProject, sendRecap, reprocessMeeting, deleteTask } from '../../src/services/api';
import { syncTaskToCalendar } from '../../src/services/calendar';
import { scheduleTaskReminder } from '../../src/services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { getMeetingStyles } from '../../src/styles/meeting-details.styles';
import * as Clipboard from 'expo-clipboard';
import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Calendar from 'expo-calendar';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Aurora } from '../../src/components/Aurora';
import { showError } from '../../src/utils/errors';

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function MeetingDetailScreen() {
  const router = useRouter();
  const { user, isPremium } = useAuth();
  const { isDarkMode, colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getMeetingStyles(isDarkMode), [isDarkMode]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState(0);

  const [meeting, setMeeting] = useState<ApiMeeting | null>(null);
  const [translatedMeeting, setTranslatedMeeting] = useState<Partial<ApiMeeting> | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  // Folder State
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [showMoveFolderModal, setShowMoveFolderModal] = useState(false);
  
  // Sharing Internally State
  const [showInternalShareModal, setShowInternalShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [isSharingInternally, setIsSharingInternally] = useState(false);
  
  // Notes State
  const [userNotes, setUserNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState(false);
  
  // Speaker Renaming State
  const [showSpeakerModal, setShowSpeakerModal] = useState<{ id: string, name: string } | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  
  // Chat State
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string, citations?: { quote: string; timestamp?: string }[] }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  const handleRetry = async () => {
    if (!meeting) return;
    setIsRetrying(true);
    try {
      await reprocessMeeting(meeting._id);
      // Redirect to processing screen; the pipeline is now actually re-running.
      router.replace(`/processing/${meeting._id}`);
    } catch (e: any) {
      showError(e, 'Retry failed', "We couldn't reprocess this meeting. Please try again.");
    } finally {
      setIsRetrying(false);
    }
  };
  const [newTitle, setNewTitle] = useState('');
  
  // Add Task Modal State
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  const [sound, setSound] = useState<Audio.Sound>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const handleSeek = async (value: number) => {
    if (sound) {
      await sound.setPositionAsync(value);
      setPlaybackPosition(value);
    }
  };

  const togglePlaybackSpeed = async () => {
    if (!sound) return;
    const nextSpeed = playbackSpeed === 1.0 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
    try {
      await sound.setRateAsync(nextSpeed, true);
      setPlaybackSpeed(nextSpeed);
    } catch (e) {
      console.error('Error setting playback speed:', e);
    }
  };

  // Loads the audio Sound once and returns it (shared by the player and transcript tap-to-seek).
  const loadSound = async (autoplay = false): Promise<Audio.Sound | null> => {
    if (sound) return sound;
    if (!meeting?.audioUrl) return null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true });
    const filename = meeting.audioUrl.split('/').pop() || '';
    const audioPath = `${API_HOST}/api/meetings/media/${filename}`;
    const token = await AsyncStorage.getItem('@auth_token');
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: audioPath, headers: { 'Authorization': `Bearer ${token}` } },
      { shouldPlay: autoplay, volume: 1.0, rate: playbackSpeed, shouldCorrectPitch: true },
      (status: any) => {
        if (status.isLoaded) {
          if (!isSeeking) setPlaybackPosition(status.positionMillis);
          setPlaybackDuration(status.durationMillis || 0);
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) { setIsPlaying(false); setPlaybackPosition(0); }
        }
      }
    );
    setSound(newSound);
    return newSound;
  };

  async function playSound() {
    if (!meeting?.audioUrl) return;
    try {
      if (sound) {
        if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
        else {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true });
          await sound.playAsync(); setIsPlaying(true);
          await sound.setRateAsync(playbackSpeed, true);
        }
        return;
      }
      const s = await loadSound(true);
      if (s) setIsPlaying(true);
    } catch (error) { Alert.alert('Playback Error', 'Could not play the audio file.'); }
  }

  // Jump the audio to a specific second (used by tappable transcript timestamps).
  const seekToSeconds = async (sec: number) => {
    if (!meeting?.audioUrl) return;
    try {
      const s = await loadSound(false);
      if (!s) return;
      await s.setPositionAsync(Math.max(0, sec * 1000));
      await s.playAsync();
      await s.setRateAsync(playbackSpeed, true);
      setIsPlaying(true);
      setPlaybackPosition(sec * 1000);
      Haptics.selectionAsync();
    } catch { /* ignore */ }
  };

  useEffect(() => { return () => { if (sound) { sound.unloadAsync(); } }; }, [sound]);

  const loadMeeting = async () => {
    if (typeof id === 'string') {
      try {
        const [data, projData] = await Promise.all([
          fetchMeetingById(id),
          fetchProjects()
        ]);
        setMeeting(data);
        setProjects(projData);
        if (data) {
          setNewTitle(data.title);
          setUserNotes(data.notes || '');
        }
      } catch (error: any) { showError(error, 'Task not updated', "We couldn't update that task. Please try again."); }
    }
    setLoading(false);
  };

  useEffect(() => { 
    loadMeeting(); 
  }, [id]);

  useEffect(() => {
    const checkReminders = async () => {
      const stored = await AsyncStorage.getItem('user_settings');
      if (stored) {
        const { notifications } = JSON.parse(stored);
        if (notifications && meeting?.tasks) {
          meeting.tasks.forEach(t => {
            if (t.status !== 'completed' && t.dueDate) {
              scheduleTaskReminder(t._id, t.title, new Date(t.dueDate));
            }
          });
        }
      }
    };
    if (meeting) checkReminders();
  }, [meeting?.tasks]);

  const handleRename = async () => {
    if (!meeting || !newTitle.trim()) { setShowRenameModal(false); return; }
    try {
      await renameMeeting(meeting._id, newTitle.trim());
      setMeeting({ ...meeting, title: newTitle.trim() });
      setShowRenameModal(false);
    } catch (error: any) { showError(error, 'Rename failed', "We couldn't rename this meeting. Please try again."); }
  };

  const handleAddNewTask = async () => {
    if (!meeting || !newTaskTitle.trim()) return;
    setIsAddingTask(true);
    try {
      const updatedMeeting = await addTask(meeting._id, { title: newTaskTitle.trim(), priority: 'medium' });
      setMeeting(updatedMeeting);
      setNewTaskTitle('');
      setShowAddTaskModal(false);
    } catch (error: any) {
      Alert.alert('Error', 'Could not add task.');
    } finally {
      setIsAddingTask(false);
    }
  };

  const copyTranscript = async () => {
    if (!meeting?.transcript) return;
    await Clipboard.setStringAsync(meeting.transcript);
    Alert.alert('Copied', 'Transcript copied to clipboard.');
  };

  const toggleTaskStatus = async (taskId: string) => {
    if (!meeting || !meeting.tasks) return;
    const task = meeting.tasks.find(t => t._id === taskId);
    if (!task) return;
    const prevStatus = task.status;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMeeting(prev => {
      if (!prev) return prev;
      return { ...prev, tasks: prev.tasks?.map(t => t._id === taskId ? { ...t, status: newStatus as any } : t) };
    });
    try {
      await updateTaskStatus(meeting._id, taskId, newStatus);
    } catch (e: any) {
      // Revert optimistic update on failure.
      setMeeting(prev => {
        if (!prev) return prev;
        return { ...prev, tasks: prev.tasks?.map(t => t._id === taskId ? { ...t, status: prevStatus as any } : t) };
      });
      Alert.alert('Update Failed', 'Could not update the task. Please try again.');
    }
  };

  const handleDeleteTask = (taskId: string) => {
    if (!meeting) return;
    Alert.alert('Delete Task', 'Remove this action item permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const prev = meeting.tasks;
          setMeeting(m => m ? { ...m, tasks: m.tasks?.filter(t => t._id !== taskId) } : m);
          try {
            await deleteTask(meeting._id, taskId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e: any) {
            setMeeting(m => m ? { ...m, tasks: prev } : m);
            Alert.alert('Error', 'Could not delete the task.');
          }
        }
      }
    ]);
  };

  const handleTranslate = async (language: string) => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    if (!meeting) return;
    setIsTranslating(true);
    setShowTranslateModal(false);
    try {
      const result = await translateMeeting(meeting._id, language);
      setTranslatedMeeting(result);
    } catch (error: any) {
      showError(error, 'Translation failed', "We couldn't translate this meeting. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSendMessage = async (predefinedMsg?: string) => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    const msg = predefinedMsg || chatInput.trim();
    if (!msg || !meeting) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages(prev => [{ role: 'user', content: msg }, ...prev]);
    setChatInput('');
    setIsTyping(true);
    try {
      const { answer, citations } = await askMeeting(meeting._id, msg);
      setMessages(prev => [{ role: 'ai', content: answer, citations }, ...prev]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      showError(error, 'Assistant unavailable', "The assistant couldn't answer that right now. Please try again in a moment.");
    } finally {
      setIsTyping(false);
    }
  };

  const SuggestionChip = ({ label, icon }: { label: string, icon: string }) => (
    <TouchableOpacity 
      onPress={() => handleSendMessage(label)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: themeColors.primary + '15', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: themeColors.primary + '20' }}
    >
      <Feather name={icon as any} size={14} color={themeColors.primary} />
      <Text style={{ color: themeColors.primary, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );

  const handleSaveNotes = async () => {
    if (!meeting) return;
    setIsSavingNotes(true);
    try {
      await updateMeeting(meeting._id, { notes: userNotes });
      setMeeting({ ...meeting, notes: userNotes });
      setHasUnsavedNotes(false);
    } catch (e: any) { Alert.alert('Error', 'Could not save notes.'); }
    setIsSavingNotes(false);
  };

  const handleShareInternally = async () => {
    if (!meeting || !shareEmail.trim()) return;
    setIsSharingInternally(true);
    try {
      await shareMeeting(meeting._id, shareEmail.trim());
      Alert.alert('Shared!', `Meeting shared with ${shareEmail}`);
      setShowInternalShareModal(false);
      setShareEmail('');
    } catch (error: any) {
      showError(error, 'Sharing failed', "We couldn't share this meeting. Please try again.");
    } finally {
      setIsSharingInternally(false);
    }
  };

  const handleMoveToFolder = async (projectId: string | null) => {
    if (!meeting) return;
    try {
      await updateMeeting(meeting._id, { projectId: projectId as any });
      setMeeting({ ...meeting, projectId: projectId as any });
      setShowMoveFolderModal(false);
      Alert.alert('Success', projectId ? 'Meeting moved to folder.' : 'Meeting removed from folder.');
    } catch (e: any) { Alert.alert('Error', 'Could not move meeting.'); }
  };

  const handleSaveSpeakerName = async () => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    if (!meeting || !showSpeakerModal || !newSpeakerName.trim()) return;
    try {
      const updatedNames = { ...(meeting.speakerNames || {}), [showSpeakerModal.id]: newSpeakerName.trim() };
      await updateMeeting(meeting._id, { speakerNames: updatedNames });
      setMeeting({ ...meeting, speakerNames: updatedNames });
      setShowSpeakerModal(null);
      setNewSpeakerName('');
    } catch (e: any) { Alert.alert('Error', 'Could not save speaker name.'); }
  };

  const exportTasks = async (platform: 'Slack' | 'Notion') => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    if (!meeting?.tasks || meeting.tasks.length === 0) {
      Alert.alert('No Tasks', 'There are no tasks to export.');
      return;
    }
    try {
      const stored = await AsyncStorage.getItem('user_settings');
      const settings = stored ? JSON.parse(stored) : {};
      const url = platform === 'Slack' ? settings.slackWebhook : settings.notionWebhook;
      
      if (!url) {
        Alert.alert('Configuration Required', `Please set up your ${platform} webhook in Settings.`);
        return;
      }

      const tasksText = meeting.tasks.map(t => `${t.status === 'completed' ? '✅' : '⭕️'} ${t.title} (${t.priority})`).join('\n');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(platform === 'Slack' ? { text: `*Meeting Tasks: ${meeting.title}*\n${tasksText}` } : { title: meeting.title, tasks: tasksText })
      });

      if (!response.ok) throw new Error('Webhook rejected the request.');
      Alert.alert('Export Successful', `Tasks sent to ${platform}.`);
    } catch (error: any) {
      showError(error, 'Export failed', "We couldn't export this meeting. Please try again.");
    }
  };

  const generatePDF = async () => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    if (!meeting) return;
    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
              .header { border-bottom: 2px solid #007AFF; padding-bottom: 20px; margin-bottom: 30px; }
              h1 { margin: 0; color: #007AFF; }
              .meta { color: #666; font-size: 14px; margin-top: 5px; }
              .section { margin-bottom: 30px; }
              h2 { font-size: 18px; border-left: 4px solid #007AFF; padding-left: 10px; color: #007AFF; }
              p { line-height: 1.6; }
              ul { padding-left: 20px; }
              li { margin-bottom: 10px; }
              .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
              .positive { background: #E1F5FE; color: #0288D1; }
              .negative { background: #FFEBEE; color: #C62828; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Meeting Report: ${meeting.title}</h1>
              <div class="meta">${new Date(meeting.date).toLocaleDateString()} &bull; ${formatDuration(meeting.duration)}</div>
            </div>
            
            <div class="section">
              <h2>Sentiment Analysis</h2>
              <p>Overall Sentiment: <span class="badge ${meeting.analysis?.sentiment || 'neutral'}">${meeting.analysis?.sentiment || 'Neutral'}</span></p>
              <p>Tone: ${meeting.analysis?.tone || 'N/A'}</p>
            </div>

            <div class="section">
              <h2>Summary</h2>
              <p>${meeting.summary || 'No summary available.'}</p>
            </div>

            <div class="section">
              <h2>Key Decisions</h2>
              <ul>
                ${meeting.decisions?.map(d => `<li>${d}</li>`).join('') || '<li>No key decisions recorded.</li>'}
              </ul>
            </div>

            <div class="section">
              <h2>Action Items</h2>
              <ul>
                ${meeting.tasks?.map(t => `<li><strong>${t.title}</strong> - Assigned to: ${t.owner || 'Unassigned'} (${t.priority} priority)</li>`).join('') || '<li>No tasks extracted.</li>'}
              </ul>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error: any) {
      Alert.alert('PDF Error', 'Could not generate report.');
    }
  };

  /**
   * The follow-up the AI extracted, resolved to a real date. Falls back to 9am
   * tomorrow when the model gave us no date or an unparseable one, so the card can
   * always state exactly when the event will land instead of scheduling blind.
   */
  const followUpDate = useMemo(() => {
    const raw = meeting?.followUp?.suggestedDate;
    const parsed = raw ? new Date(raw) : null;
    if (parsed && !isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) return parsed;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  }, [meeting?.followUp?.suggestedDate]);

  // Remember that we already scheduled this, so a second tap can't silently create
  // a duplicate calendar event.
  const [followUpEventId, setFollowUpEventId] = useState<string | null>(null);
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false);

  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`@followup_event_${id}`).then(setFollowUpEventId);
  }, [id]);

  const createFollowUpEvent = async () => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    if (!meeting?.followUp) return;

    if (followUpEventId) {
      Alert.alert(
        'Already scheduled',
        `"${meeting.followUp.title}" is already on your calendar for ${followUpDate.toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
      );
      return;
    }

    setSchedulingFollowUp(true);
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Calendar access needed', 'To schedule this follow-up, allow MeetActions to access your calendar in Settings.');
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCal = calendars.find(c => c.allowsModifications && c.isPrimary)
        || calendars.find(c => c.allowsModifications);

      if (!defaultCal) {
        Alert.alert('No calendar available', "We couldn't find a calendar on this device that we're allowed to add events to.");
        return;
      }

      const endDate = new Date(followUpDate);
      endDate.setHours(endDate.getHours() + 1);

      const eventId = await Calendar.createEventAsync(defaultCal.id, {
        title: meeting.followUp.title,
        startDate: followUpDate,
        endDate,
        notes: `Follow-up from "${meeting.title}"\n\n${meeting.summary || ''}`,
      });

      await AsyncStorage.setItem(`@followup_event_${id}`, eventId);
      setFollowUpEventId(eventId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      showError(error, 'Not scheduled', "We couldn't add this to your calendar. Please try again.");
    } finally {
      setSchedulingFollowUp(false);
    }
  };

  const sendRecapEmail = async () => {
    if (!meeting) return;
    try {
      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Mail composer is not available on this device.');
        return;
      }

      const tasksText = meeting.tasks?.map(t => `- ${t.title} (${t.priority})`).join('\n') || 'None';
      const decisionsText = meeting.decisions?.map(d => `- ${d}`).join('\n') || 'None';

      await MailComposer.composeAsync({
        subject: `Recap: ${meeting.title}`,
        body: `Hi team,\n\nHere is a recap of our meeting: "${meeting.title}" held on ${new Date(meeting.date).toLocaleDateString()}.\n\nSUMMARY\n${meeting.summary}\n\nKEY DECISIONS\n${decisionsText}\n\nACTION ITEMS\n${tasksText}\n\nBest,\n${user?.name || 'Sent from MeetActions'}`,
      });
    } catch (error: any) {
      Alert.alert('Email Error', 'Could not draft the email.');
    }
  };

  const handleShare = async () => {
    if (!meeting) return;
    try {
      let msg = `*Meeting: ${meeting.title}*\n\n*Summary*\n${meeting.summary || 'N/A'}\n\n*Decisions*\n${meeting.decisions?.map(d => `- ${d}`).join('\n')}\n\n*Tasks*\n${meeting.tasks?.map(t => `${t.status === 'completed' ? '[x]' : '[ ]'} ${t.title}`).join('\n')}`;
      await Share.share({ message: msg, title: meeting.title });
    } catch (e) { Alert.alert('Error', 'Could not share.'); }
  };

  const handleSendRecap = async () => {
    if (!meeting) return;
    if (!isPremium) { router.push('/paywall'); return; }
    try {
      const result = await sendRecap(meeting._id, []);
      if (result.sent) {
        Alert.alert('Recap Sent', result.message);
      } else {
        // Email not configured (or no recipients) — offer to share the rendered recap instead.
        Alert.alert(
          'Recap Ready',
          `${result.message}\n\nShare access with attendees first, or configure email on the server to auto-send.`,
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      showError(e, 'Recap not sent', "We couldn't send the recap. Please try again.");
    }
  };

  const handleExportTranscript = async () => {
    if (!meeting || !meeting.transcript) return;
    try {
      const content = `MEETACTIONS TRANSCRIPT\nSession: ${meeting.title}\nDate: ${new Date(meeting.date).toLocaleString()}\n\n${meeting.transcript}`;
      await Share.share({
        message: content,
        title: `Transcript - ${meeting.title}`,
      });
    } catch (e) { Alert.alert('Error', 'Could not export transcript.'); }
  };

  // Consistent per-speaker accent color.
  const SPEAKER_COLORS = ['#0A84FF', '#32D74B', '#FF9F0A', '#BF5AF2', '#FF375F', '#5AC8FA'];
  const speakerColor = (label: string) => {
    const idx = (label.charCodeAt(label.length - 1) || 0) % SPEAKER_COLORS.length;
    return SPEAKER_COLORS[idx];
  };
  const parseStampToSec = (stamp: string): number => {
    const parts = stamp.split(':').map(Number);
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  };

  const renderTranscriptContent = (text: string) => {
    if (!text) return <Text style={styles.paragraph}>No transcript available.</Text>;

    const parts = text.split(/(Speaker [A-Z0-9]+:)/g);
    if (parts.length <= 1) {
      // No speaker labels (e.g. live-mode transcript) — still render timestamps as tappable chips.
      return <View>{renderPlainTranscript(text)}</View>;
    }

    const elements = [];
    for (let i = 1; i < parts.length; i += 2) {
      const originalLabel = parts[i].trim().replace(':', '');
      const label = meeting?.speakerNames?.[originalLabel] || originalLabel;
      let content = parts[i + 1]?.trim() || '';
      // Pull a leading timestamp out of the content, if present.
      const stampMatch = content.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*/);
      const stamp = stampMatch?.[1];
      if (stampMatch) content = content.slice(stampMatch[0].length);
      const color = speakerColor(originalLabel);
      if (content) {
        elements.push(
          <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color + '25', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color, fontWeight: '800', fontSize: 13 }}>{label.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <TouchableOpacity onPress={() => {
                  if (isPremium) { setShowSpeakerModal({ id: originalLabel, name: label }); setNewSpeakerName(label); }
                  else { router.push('/paywall'); }
                }}>
                  <Text style={{ color, fontWeight: '800', fontSize: 13 }}>{label} <Feather name={isPremium ? 'edit-2' : 'lock'} size={9} color={themeColors.textMuted} /></Text>
                </TouchableOpacity>
                {!!stamp && (
                  <TouchableOpacity onPress={() => seekToSeconds(parseStampToSec(stamp))} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: themeColors.primary + '15', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                    <Feather name="play" size={8} color={themeColors.primary} />
                    <Text style={{ color: themeColors.primary, fontSize: 10, fontWeight: '700' }}>{stamp}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ color: themeColors.textPrimary, fontSize: 14, lineHeight: 21 }}>{content}</Text>
            </View>
          </View>
        );
      }
    }
    return <View>{elements}</View>;
  };

  // For transcripts without speaker labels — render tappable timestamp chips inline.
  const renderPlainTranscript = (text: string) => {
    const segs = text.split(/(\[\d{1,2}:\d{2}(?::\d{2})?\])/g).filter(s => s.trim());
    return segs.map((seg, i) => {
      const m = seg.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]$/);
      if (m) {
        return (
          <TouchableOpacity key={i} onPress={() => seekToSeconds(parseStampToSec(m[1]))} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: themeColors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 8, marginBottom: 2 }}>
            <Feather name="play" size={8} color={themeColors.primary} />
            <Text style={{ color: themeColors.primary, fontSize: 10, fontWeight: '700' }}>{m[1]}</Text>
          </TouchableOpacity>
        );
      }
      return <Text key={i} style={{ color: themeColors.textPrimary, fontSize: 14, lineHeight: 22 }}>{seg.trim()}</Text>;
    });
  };

  const renderHeatmap = () => {
    if (!meeting?.transcript) return null;
    // Correctly pair each "Speaker X:" label with the text that follows it.
    const regex = /(Speaker [A-Z0-9]+):/g;
    const matches = [...meeting.transcript.matchAll(regex)];
    if (matches.length === 0) return null;
    const data: { speaker: string; length: number }[] = [];
    for (let i = 0; i < matches.length; i++) {
      const speaker = matches[i][1].trim();
      const start = (matches[i].index || 0) + matches[i][0].length;
      const end = i + 1 < matches.length ? (matches[i + 1].index || 0) : meeting.transcript.length;
      const text = meeting.transcript.slice(start, end).replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, '');
      data.push({ speaker, length: Math.max(1, text.trim().length) });
    }
    const totalLength = data.reduce((acc, curr) => acc + curr.length, 0);
    if (totalLength === 0) return null;
    const uniqueSpeakers = [...new Set(data.map(d => d.speaker))];
    return (
      <View style={{ marginTop: 20 }}>
        <Text style={styles.sectionTitle}>Speaking Timeline</Text>
        <GlassCard style={{ padding: 12, flexDirection: 'row', height: 40, overflow: 'hidden', gap: 2 }}>
          {data.map((segment, idx) => (
            <View key={idx} style={{ flex: segment.length, backgroundColor: speakerColor(segment.speaker), borderRadius: 2, opacity: 0.9 }} />
          ))}
        </GlassCard>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          {uniqueSpeakers.map(s => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: speakerColor(s) }} />
              <Text style={{ fontSize: 10, color: themeColors.textMuted, fontWeight: '600' }}>{meeting?.speakerNames?.[s] || s}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const MenuOption = ({ icon, label, onPress, danger = false, premium = false }: any) => (
    <TouchableOpacity 
      style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 16, 
        gap: 15,
        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: themeColors.border
      }} 
      onPress={onPress}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? themeColors.danger + '15' : (premium ? themeColors.primary + '15' : 'rgba(128,128,128,0.1)'), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={18} color={danger ? themeColors.danger : (premium ? themeColors.primary : themeColors.textPrimary)} />
      </View>
      <Text style={{ flex: 1, color: danger ? themeColors.danger : themeColors.textPrimary, fontSize: 15, fontWeight: '600' }}>{label}</Text>
      {premium && !isPremium && <Feather name="lock" size={14} color={themeColors.textMuted} />}
      <Feather name="chevron-right" size={16} color={themeColors.textMuted} />
    </TouchableOpacity>
  );

  const getPriorityColor = (p: string) => {
    if (p === 'high') return themeColors.danger;
    if (p === 'medium') return themeColors.warning;
    return themeColors.success;
  };

  // Consistent section header: small tinted icon + uppercase label.
  const SectionLabel = ({ icon, label, color, right }: { icon: string; label: string; color?: string; right?: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
      <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: (color || themeColors.primary) + '1F', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
        <Feather name={icon as any} size={14} color={color || themeColors.primary} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '800', color: themeColors.textPrimary, letterSpacing: 0.3, flex: 1 }}>{label}</Text>
      {right}
    </View>
  );

  if (loading) return <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.bg }]}><ActivityIndicator size="large" color={themeColors.primary} /></SafeAreaView>;
  if (!meeting) return <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}><View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Feather name="arrow-left" size={24} color={themeColors.textPrimary} /></TouchableOpacity></View><View style={styles.notFound}><Text style={styles.paragraph}>Meeting not found</Text></View></SafeAreaView>;

  if (meeting.status === 'error') {
   return (
     <View style={[styles.container, { backgroundColor: themeColors.bg, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
       <Aurora isDark={isDarkMode} variant="record" intensity={0.5} />
       <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: themeColors.danger + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
         <Feather name="alert-circle" size={40} color={themeColors.danger} />
       </View>
       <Text style={{ fontSize: 22, fontWeight: '800', color: themeColors.textPrimary, textAlign: 'center', marginBottom: 12 }}>Intelligence Failure</Text>
       <Text style={{ fontSize: 14, color: themeColors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 30 }}>
         The Groq LPU engine encountered an error while distilling this session. This is usually due to network instability or API quotas.
       </Text>
       <TouchableOpacity 
         onPress={handleRetry}
         disabled={isRetrying}
         style={{ backgroundColor: themeColors.primary, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}
       >
         {isRetrying ? <ActivityIndicator color="#fff" /> : (
           <>
             <Feather name="refresh-cw" size={18} color="#fff" />
             <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Retry Distillation</Text>
           </>
         )}
       </TouchableOpacity>
       <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
         <Text style={{ color: themeColors.textMuted, fontWeight: '700' }}>Back to History</Text>
       </TouchableOpacity>
     </View>
   );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <Aurora isDark={isDarkMode} variant="home" intensity={0.75} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomWidth: 0, paddingBottom: 5 }]}>
        <TouchableOpacity style={[styles.backBtn, { width: 42, height: 42, borderRadius: 13, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }]} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.headerTitleWrap, { alignItems: 'center' }]}>
          <Text style={styles.headerTitle} numberOfLines={1}>{meeting.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Feather name="calendar" size={10} color={themeColors.textMuted} />
            <Text style={{ fontSize: 11, color: themeColors.textMuted, fontWeight: '700' }}>
              {new Date(meeting.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {formatDuration(meeting.duration)}
            </Text>
            {meeting.liveMode && (
              <View style={{ backgroundColor: themeColors.danger + '20', paddingHorizontal: 6, borderRadius: 5 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: themeColors.danger }}>LIVE</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={[styles.actionBtn, { width: 42, height: 42, borderRadius: 13, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }]} onPress={() => setShowActionMenu(true)}>
          <Feather name="more-horizontal" size={22} color={themeColors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <PillTabs tabs={['Insights', 'Transcript', 'Tasks', 'Assistant']} active={activeTab} onChange={setActiveTab} />
      </View>

      <View style={{ flex: 1 }}>
        {activeTab !== 3 ? (
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            scrollEventThrottle={16}
          >
            {activeTab === 0 && (
              <View style={styles.tabContent}>
                {/* Vibe + Tone tiles */}
                {(() => {
                  const sentiment = meeting.analysis?.sentiment || 'neutral';
                  const sColor = sentiment === 'positive' ? themeColors.success : sentiment === 'negative' ? themeColors.danger : themeColors.primary;
                  const sIcon = sentiment === 'positive' ? 'smile' : sentiment === 'negative' ? 'frown' : 'meh';
                  return (
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ flex: 1, backgroundColor: themeColors.bgCard, borderRadius: 22, borderWidth: 1, borderColor: themeColors.border, padding: 16 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: sColor + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                          <Feather name={sIcon as any} size={19} color={sColor} />
                        </View>
                        <Text style={{ fontSize: 17, fontWeight: '800', color: themeColors.textPrimary, textTransform: 'capitalize' }}>{sentiment}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: themeColors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Overall Vibe</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: themeColors.bgCard, borderRadius: 22, borderWidth: 1, borderColor: themeColors.border, padding: 16 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: themeColors.primary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                          <Feather name="activity" size={19} color={themeColors.primary} />
                        </View>
                        <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: themeColors.textPrimary, textTransform: 'capitalize' }}>{meeting.analysis?.tone || 'Neutral'}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: themeColors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Meeting Tone</Text>
                      </View>
                    </View>
                  );
                })()}

                {meeting.analysis?.conflictDetected && (
                  <View style={{ backgroundColor: themeColors.danger + '12', padding: 14, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: themeColors.danger, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Feather name="alert-triangle" size={18} color={themeColors.danger} />
                    <Text style={{ color: themeColors.danger, fontSize: 13, fontWeight: '700', flex: 1 }}>Tension or disagreement detected in this session.</Text>
                  </View>
                )}

                <View>
                  <SectionLabel icon="align-left" label="Executive Summary" />
                  <GlassCard style={{ padding: 18, borderRadius: 22 }}>
                    <Text style={styles.paragraph}>{translatedMeeting?.summary || meeting.summary || 'No summary available.'}</Text>
                  </GlassCard>
                </View>

                <View>
                  <SectionLabel icon="check-circle" label="Key Decisions" color={themeColors.success} />
                  <GlassCard style={{ padding: 6, borderRadius: 22 }}>
                    {(() => {
                      const decisions = (translatedMeeting?.decisions || meeting.decisions) || [];
                      return decisions.length > 0 ? decisions.map((d, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderBottomWidth: i === decisions.length - 1 ? 0 : 1, borderBottomColor: themeColors.border }}>
                          <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: themeColors.success + '20', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.success }}>{i + 1}</Text>
                          </View>
                          <Text style={{ flex: 1, fontSize: 14, color: themeColors.textPrimary, lineHeight: 21 }}>{d}</Text>
                        </View>
                      )) : <Text style={[styles.paragraph, { padding: 12 }]}>No key decisions recorded.</Text>;
                    })()}
                  </GlassCard>
                </View>

                {meeting.followUp && (() => {
                  const scheduled = Boolean(followUpEventId);
                  const accent = scheduled ? themeColors.success : themeColors.primary;
                  return (
                    <View>
                      <SectionLabel icon="corner-up-right" label="Suggested Follow-Up" color={accent} />
                      <GlassCard style={{ padding: 16, borderRadius: 22, borderWidth: 1, borderColor: accent + '30' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: accent + '18', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name={scheduled ? 'check' : 'calendar'} size={20} color={accent} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: themeColors.textPrimary, fontSize: 15, fontWeight: '700' }} numberOfLines={2}>
                              {meeting.followUp.title}
                            </Text>
                            {/* Say exactly when this will land, so the tap isn't blind. */}
                            <Text style={{ color: themeColors.textMuted, fontSize: 12, marginTop: 3 }}>
                              {scheduled ? 'On your calendar · ' : ''}
                              {followUpDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={createFollowUpEvent}
                          disabled={scheduled || schedulingFollowUp}
                          activeOpacity={0.85}
                          style={{
                            marginTop: 14, height: 44, borderRadius: 14,
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                            backgroundColor: scheduled ? 'transparent' : accent,
                            borderWidth: scheduled ? 1 : 0,
                            borderColor: themeColors.border,
                          }}
                        >
                          {schedulingFollowUp ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Feather
                                name={scheduled ? 'check-circle' : isPremium ? 'calendar' : 'lock'}
                                size={15}
                                color={scheduled ? themeColors.textMuted : '#fff'}
                              />
                              <Text style={{ color: scheduled ? themeColors.textMuted : '#fff', fontSize: 14, fontWeight: '800' }}>
                                {scheduled ? 'Added to calendar' : 'Add to calendar'}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </GlassCard>
                    </View>
                  );
                })()}

                {renderHeatmap()}

                {/* Meeting Coach Metrics */}
                <View style={{ marginTop: 8 }}>
                  <SectionLabel icon="bar-chart-2" label="Meeting Coach" color={themeColors.warning} />
                  <GlassCard style={[styles.card, { padding: 16, borderRadius: 22 }]}>
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                      <View style={{ flex: 1, backgroundColor: themeColors.primary + '12', borderRadius: 16, padding: 14, alignItems: 'center' }}>
                        <Feather name="zap" size={18} color={themeColors.primary} />
                        <Text style={{ fontSize: 22, fontWeight: '800', color: themeColors.textPrimary, marginTop: 6 }}>{meeting.analysis?.pacingScore || 0}</Text>
                        <Text style={{ fontSize: 10, color: themeColors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Words / Min</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: themeColors.warning + '12', borderRadius: 16, padding: 14, alignItems: 'center' }}>
                        <Feather name="repeat" size={18} color={themeColors.warning} />
                        <Text style={{ fontSize: 22, fontWeight: '800', color: themeColors.textPrimary, marginTop: 6 }}>{meeting.analysis?.interruptionCount || 0}</Text>
                        <Text style={{ fontSize: 10, color: themeColors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Speaker Switches</Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.textMuted, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>Participation Breakdown</Text>
                    {meeting.analysis?.speakingTime && meeting.analysis.speakingTime.length > 0 ? (
                      meeting.analysis.speakingTime.map((s, idx) => {
                        const c = speakerColor(s.speakerId);
                        return (
                        <View key={idx} style={{ marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c }} />
                              <Text style={{ fontSize: 14, fontWeight: '700', color: themeColors.textPrimary }}>{meeting.speakerNames?.[s.speakerId] || s.speakerId}</Text>
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: c }}>{s.percentage}%</Text>
                          </View>
                          <View style={{ height: 7, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                            <View style={{ height: '100%', width: `${s.percentage}%`, backgroundColor: c, borderRadius: 4 }} />
                          </View>
                        </View>
                        );
                      })
                    ) : (
                      <Text style={{ fontSize: 14, color: themeColors.textMuted }}>No participation data available.</Text>
                    )}
                  </GlassCard>
                </View>

                {/* Audio Player — only when a recording file exists */}
                {meeting.audioUrl && (
                <View style={[styles.audioPlayerContainer, { marginTop: 10 }]}>
                  <View style={styles.progressContainer}>
                    <Slider
                      style={{ width: '100%', height: 30 }}
                      minimumValue={0}
                      maximumValue={playbackDuration || (meeting.duration * 1000)}
                      value={playbackPosition}
                      onSlidingStart={() => setIsSeeking(true)}
                      onSlidingComplete={handleSeek}
                      minimumTrackTintColor={themeColors.primary}
                      maximumTrackTintColor={themeColors.border}
                      thumbTintColor={themeColors.primary}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                      <Text style={styles.audioTime}>{formatDuration(playbackPosition / 1000)}</Text>
                      <Text style={styles.audioTime}>{formatDuration((playbackDuration || meeting.duration * 1000) / 1000)}</Text>
                    </View>
                  </View>
                  
                  <View style={[styles.audioControlsRow, { marginTop: 15, justifyContent: 'space-evenly' }]}>
                    <TouchableOpacity onPress={async () => { if (sound) { const s = await sound.getStatusAsync(); if (s.isLoaded) await sound.setPositionAsync(Math.max(0, s.positionMillis - 15000)); } }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                        <Feather name="rotate-ccw" size={20} color={themeColors.textPrimary} />
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.playBtn, { width: 64, height: 64, borderRadius: 32 }]} onPress={playSound}>
                      <Feather name={isPlaying ? "pause" : "play"} size={32} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={async () => { if (sound) { const s = await sound.getStatusAsync(); if (s.isLoaded) await sound.setPositionAsync(Math.min(s.durationMillis || 0, s.positionMillis + 15000)); } }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                        <Feather name="rotate-cw" size={20} color={themeColors.textPrimary} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Refined Speed Selector Pill */}
                  <View style={{ alignItems: 'center', marginTop: 15 }}>
                    <View style={{ flexDirection: 'row', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: 20, padding: 3 }}>
                      {[1.0, 1.5, 2.0].map((speed) => (
                        <TouchableOpacity 
                          key={speed}
                          onPress={async () => {
                            setPlaybackSpeed(speed); // remember choice even before playback starts
                            Haptics.selectionAsync();
                            try {
                              const s = sound || await loadSound(false);
                              if (s) await s.setRateAsync(speed, true);
                            } catch { /* ignore */ }
                          }}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 6,
                            borderRadius: 18,
                            backgroundColor: playbackSpeed === speed ? themeColors.primary : 'transparent',
                            shadowColor: playbackSpeed === speed ? themeColors.primary : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.3,
                            shadowRadius: 4,
                            elevation: playbackSpeed === speed ? 3 : 0
                          }}
                        >
                          <Text style={{ 
                            fontSize: 12, 
                            fontWeight: '800', 
                            color: playbackSpeed === speed ? '#fff' : themeColors.textMuted 
                          }}>{speed}x</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
                )}

                {/* Personal Notes at bottom */}
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.sectionTitle}>Private Notes</Text>
                    {hasUnsavedNotes && (
                      <TouchableOpacity onPress={handleSaveNotes} style={{ backgroundColor: themeColors.success, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>SAVE</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <GlassCard style={{ padding: 0 }}>
                    <TextInput 
                      style={{ color: themeColors.textPrimary, fontSize: 14, lineHeight: 22, padding: 15, minHeight: 100, textAlignVertical: 'top' }} 
                      multiline 
                      placeholder="Type your own notes here..." 
                      placeholderTextColor={themeColors.textMuted}
                      value={userNotes}
                      onChangeText={(v) => { setUserNotes(v); setHasUnsavedNotes(true); }}
                    />
                  </GlassCard>
                </View>
              </View>
            )}

            {activeTab === 1 && (
              <View style={styles.tabContent}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.sectionTitle}>Transcript {translatedMeeting ? '(Translated)' : ''}</Text>
                    {meeting.diarized && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#32D74B20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                        <Feather name="mic" size={10} color="#32D74B" />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#32D74B' }}>DIARIZED</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={copyTranscript} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="copy" size={14} color={themeColors.primaryLight} />
                    <Text style={{ color: themeColors.primaryLight, fontSize: 12, fontWeight: '600' }}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <GlassCard style={styles.card}>{renderTranscriptContent(translatedMeeting?.transcript || meeting.transcript || '')}</GlassCard>
              </View>
            )}

            {activeTab === 2 && (
              <View style={styles.tabContent}>
                {(() => {
                  const tasks = meeting.tasks || [];
                  const done = tasks.filter(t => t.status === 'completed').length;
                  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
                  return (
                    <LinearGradient colors={['#0A84FF', '#5B54E8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>ACTION ITEMS</Text>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 26, marginTop: 2 }}>{done}<Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)' }}> / {tasks.length} done</Text></Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={() => exportTasks('Slack')} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name={isPremium ? 'slack' : 'lock'} size={17} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setShowAddTaskModal(true)} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="plus" size={20} color="#0A84FF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden', marginTop: 14 }}>
                        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#fff', borderRadius: 3 }} />
                      </View>
                    </LinearGradient>
                  );
                })()}
                {meeting.tasks && meeting.tasks.length > 0 ? meeting.tasks.map(t => {
                  const done = t.status === 'completed';
                  const pc = getPriorityColor(t.priority);
                  return (
                  <GlassCard key={t._id} style={{ padding: 14, borderRadius: 18, borderLeftWidth: 3, borderLeftColor: done ? themeColors.success : pc }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <TouchableOpacity style={{ marginTop: 1 }} onPress={() => toggleTaskStatus(t._id)}>
                        {done ? <Feather name="check-circle" size={24} color={themeColors.success} /> : <Feather name="circle" size={24} color={themeColors.textMuted} />}
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskTitle, done && styles.taskCompleted]}>{t.title}</Text>
                        {t.description ? <Text style={styles.taskDesc} numberOfLines={2}>{t.description}</Text> : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          <View style={{ backgroundColor: pc + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: pc, textTransform: 'uppercase' }}>{t.priority}</Text>
                          </View>
                          {!!t.owner && <View style={styles.chip}><Feather name="user" size={12} color={themeColors.textSecondary} /><Text style={styles.chipText}>{t.owner}</Text></View>}
                          {!!t.dueDate && <View style={styles.chip}><Feather name="calendar" size={12} color={themeColors.textSecondary} /><Text style={styles.chipText}>{new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></View>}
                          <View style={{ flex: 1 }} />
                          <TouchableOpacity onPress={() => syncTaskToCalendar(t.title, t.dueDate ? t.dueDate.toString() : undefined, `From: ${meeting.title}`)} hitSlop={8}>
                            <Feather name="calendar" size={18} color={themeColors.primaryLight} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteTask(t._id)} hitSlop={8}>
                            <Feather name="trash-2" size={17} color={themeColors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </GlassCard>
                  );
                }) : (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <Feather name="check-square" size={36} color={themeColors.textMuted} />
                    <Text style={[styles.paragraph, { marginTop: 12 }]}>No tasks extracted from this session.</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        ) : (
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            style={{ flex: 1 }}
          >
            <View style={{ flex: 1 }}>
              <FlatList
                inverted
                data={messages}
                keyExtractor={(_, i) => i.toString()}
                contentContainerStyle={{ padding: 16, gap: 16 }}
                ListHeaderComponent={isTyping ? (
                  <View style={[chatStyles.bubble, chatStyles.aiBubble, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8 }]}>
                    <LottieView source={{ uri: 'https://assets10.lottiefiles.com/packages/lf20_S69rU8.json' }} autoPlay loop style={{ width: 60, height: 30 }} />
                  </View>
                ) : null}
                ListFooterComponent={messages.length === 0 ? (
                  <View style={chatStyles.emptyChat}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: themeColors.primary + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                      <Feather name="message-circle" size={40} color={themeColors.primary} />
                    </View>
                    <Text style={[chatStyles.emptyTitle, { color: themeColors.textPrimary }]}>AI Meeting Assistant</Text>
                    <Text style={[chatStyles.emptyText, { color: themeColors.textMuted }]}>Ask questions about the transcript, summary, or specific decisions made in this session.</Text>
                  </View>
                ) : null}
                renderItem={({ item }) => (
                  <View style={[chatStyles.bubble, item.role === 'user' ? [chatStyles.userBubble, { backgroundColor: themeColors.primary }] : [chatStyles.aiBubble, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      {item.role === 'ai' && (
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                          <Feather name="zap" size={14} color="#fff" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[chatStyles.bubbleText, { color: item.role === 'user' ? '#fff' : themeColors.textPrimary }]}>{item.content}</Text>
                        {item.role === 'ai' && !!item.citations?.length && (
                          <View style={{ marginTop: 10, gap: 6, borderTopWidth: 1, borderTopColor: themeColors.border, paddingTop: 10 }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.textMuted, letterSpacing: 0.5 }}>SOURCES</Text>
                            {item.citations.map((c, ci) => (
                              <View key={ci} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                                {!!c.timestamp && (
                                  <View style={{ backgroundColor: themeColors.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 1 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: themeColors.primary }}>{c.timestamp}</Text>
                                  </View>
                                )}
                                <Text style={{ flex: 1, fontSize: 12, fontStyle: 'italic', color: themeColors.textMuted, lineHeight: 17 }}>“{c.quote}”</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              />

              <View style={chatStyles.chatFooter}>
                {messages.length < 5 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, marginBottom: 12 }}>
                    <SuggestionChip label="Summarize meeting" icon="file-text" />
                    <SuggestionChip label="Show action items" icon="check-square" />
                    <SuggestionChip label="What was the vibe?" icon="activity" />
                    <SuggestionChip label="Key decisions" icon="target" />
                  </ScrollView>
                )}
                <View style={[chatStyles.inputRow, { borderTopColor: themeColors.border }]}>
                  <TextInput 
                    style={[chatStyles.input, { color: themeColors.textPrimary, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]} 
                    value={chatInput} 
                    onChangeText={setChatInput} 
                    placeholder={isPremium ? "Message AI..." : "Upgrade to Pro to chat"} 
                    placeholderTextColor={themeColors.textMuted}
                    editable={isPremium}
                    multiline
                  />
                  <TouchableOpacity 
                    style={[chatStyles.sendBtn, { backgroundColor: isPremium ? themeColors.primary : 'rgba(128,128,128,0.1)' }]} 
                    onPress={() => handleSendMessage()}
                    disabled={!chatInput.trim() || isTyping}
                  >
                    <Feather name={isPremium ? "arrow-up" : "lock"} size={20} color={isPremium ? "#fff" : themeColors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Action Menu Modal */}
      <Modal visible={showActionMenu} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActionMenu(false)}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Meeting Actions</Text>
              <Text style={styles.modalSubtitle}>Manage and share your session data.</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                <MenuOption icon="edit-3" label="Rename Session" onPress={() => { setShowActionMenu(false); setShowRenameModal(true); }} />
                <MenuOption icon="send" label="Send Recap Email" premium onPress={() => { setShowActionMenu(false); handleSendRecap(); }} />
                <MenuOption icon="file-text" label="Export PDF Report" premium onPress={() => { setShowActionMenu(false); generatePDF(); }} />
                <MenuOption icon="globe" label="Translate Content" premium onPress={() => { setShowActionMenu(false); setShowTranslateModal(true); }} />
                <MenuOption icon="folder" label="Move to Folder" onPress={() => { setShowActionMenu(false); setShowMoveFolderModal(true); }} />
                <MenuOption icon="user-plus" label="Share Access" onPress={() => { setShowActionMenu(false); setShowInternalShareModal(true); }} />
                <MenuOption icon="share" label="Share Summary" onPress={() => { setShowActionMenu(false); handleShare(); }} />
                <MenuOption icon="file-text" label="Export Full Transcript" onPress={() => { setShowActionMenu(false); handleExportTranscript(); }} />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Move to Folder Modal */}
      <Modal visible={showMoveFolderModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMoveFolderModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Move to Folder</Text>
            <Text style={styles.modalSubtitle}>Select a project to categorize this meeting.</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity 
                style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: themeColors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                onPress={() => handleMoveToFolder(null)}
              >
                <Text style={{ color: themeColors.textPrimary, fontSize: 16 }}>No Folder (Ungrouped)</Text>
                {!meeting?.projectId && <Feather name="check" size={18} color={themeColors.primary} />}
              </TouchableOpacity>
              {projects.map(p => (
                <TouchableOpacity 
                  key={p._id} 
                  style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: themeColors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  onPress={() => handleMoveToFolder(p._id)}
                >
                  <Text style={{ color: themeColors.textPrimary, fontSize: 16 }}>{p.name}</Text>
                  {meeting?.projectId === p._id && <Feather name="check" size={18} color={themeColors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalBtnCancel, { marginTop: 20 }]} onPress={() => setShowMoveFolderModal(false)}>
              <Text style={styles.modalBtnTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Speaker Rename Modal */}
      <Modal visible={!!showSpeakerModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSpeakerModal(null)}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Identify Speaker</Text>
                <Text style={styles.modalSubtitle}>Give this speaker a real name to update the transcript.</Text>
                <TextInput style={styles.modalInput} value={newSpeakerName} onChangeText={setNewSpeakerName} placeholder="Enter name" placeholderTextColor={themeColors.textMuted} autoFocus />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowSpeakerModal(null)}><Text style={styles.modalBtnTextCancel}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveSpeakerName}><Text style={styles.modalBtnTextSave}>Save Name</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Share Internal Modal */}
      <Modal visible={showInternalShareModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInternalShareModal(false)}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Share Meeting</Text>
                <Text style={styles.modalSubtitle}>Grant another MeetActions user access to this session.</Text>
                <TextInput 
                  style={styles.modalInput} 
                  value={shareEmail} 
                  onChangeText={setShareEmail} 
                  placeholder="Colleague's email" 
                  placeholderTextColor={themeColors.textMuted}
                  autoFocus
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowInternalShareModal(false)}><Text style={styles.modalBtnTextCancel}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSave} onPress={handleShareInternally} disabled={isSharingInternally}>
                    {isSharingInternally ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnTextSave}>Grant Access</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Translation Modal */}
      <Modal visible={showTranslateModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTranslateModal(false)}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Translate Meeting</Text>
              <Text style={styles.modalSubtitle}>Choose a language to translate the summary, decisions, and transcript.</Text>
              <View style={{ gap: 10, marginBottom: 20 }}>
                {['Spanish', 'French', 'German', 'Chinese', 'Japanese'].map(lang => (
                  <TouchableOpacity key={lang} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: themeColors.border }} onPress={() => handleTranslate(lang)}>
                    <Text style={{ color: themeColors.textPrimary, fontWeight: '600' }}>{lang}</Text>
                    <Feather name="chevron-right" size={16} color={themeColors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowTranslateModal(false)}><Text style={styles.modalBtnTextCancel}>Close</Text></TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Add Task Modal */}
      <Modal visible={showAddTaskModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddTaskModal(false)}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>New Action Item</Text>
                <Text style={styles.modalSubtitle}>Manually add a task that the AI might have missed.</Text>
                <TextInput style={styles.modalInput} value={newTaskTitle} onChangeText={setNewTaskTitle} placeholder="What needs to be done?" placeholderTextColor={themeColors.textMuted} autoFocus />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowAddTaskModal(false)}><Text style={styles.modalBtnTextCancel}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSave} onPress={handleAddNewTask} disabled={isAddingTask}>
                    {isAddingTask ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnTextSave}>Add Task</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={showRenameModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRenameModal(false)}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Rename Meeting</Text>
                <Text style={styles.modalSubtitle}>Update the title of your recording session.</Text>
                <TextInput style={styles.modalInput} value={newTitle} onChangeText={setNewTitle} placeholder="Meeting title" placeholderTextColor={themeColors.textMuted} />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowRenameModal(false)}><Text style={styles.modalBtnTextCancel}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSave} onPress={handleRename}><Text style={styles.modalBtnTextSave}>Save Changes</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const chatStyles = StyleSheet.create({
  messageList: { flex: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  bubble: { maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, marginBottom: 4 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  chatFooter: { paddingVertical: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, gap: 10, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
