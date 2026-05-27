import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Share, StyleSheet, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, FlatList } from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/constants/theme';
import { GlassCard, PillTabs, Badge, Divider } from '../../src/components/ui';
import { fetchMeetingById, ApiMeeting, updateTaskStatus, renameMeeting, deleteMeeting, API_HOST, addTask, translateMeeting, askMeeting, updateMeeting, shareMeeting, fetchProjects, ApiProject } from '../../src/services/api';
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
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [loading, setLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
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

  const handleSeek = async (value: number) => {
    if (sound) {
      await sound.setPositionAsync(value);
      setPlaybackPosition(value);
    }
  };

  async function playSound() {
    if (!meeting?.audioUrl) return;
    try {
      if (sound) {
        if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
        else { 
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true });
          await sound.playAsync(); setIsPlaying(true); 
        }
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true });
      const filename = meeting.audioUrl.split('/').pop() || '';
      const audioPath = `${API_HOST}/api/meetings/media/${filename}`;
      const token = await AsyncStorage.getItem('@auth_token');
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioPath, headers: { 'Authorization': `Bearer ${token}` } }, 
        { shouldPlay: true, volume: 1.0 }, 
        (status: any) => {
          if (status.isLoaded) { setPlaybackPosition(status.positionMillis); setPlaybackDuration(status.durationMillis || 0); setIsPlaying(status.isPlaying); if (status.didJustFinish) { setIsPlaying(false); setPlaybackPosition(0); } }
        }
      );
      setSound(newSound); setIsPlaying(true);
    } catch (error) { Alert.alert('Playback Error', 'Could not play the audio file.'); }
  }

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
      } catch (error: any) { Alert.alert('Error', error.message); }
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
    } catch (error: any) { Alert.alert('Rename Failed', error.message); }
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
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    setMeeting(prev => {
      if (!prev) return prev;
      return { ...prev, tasks: prev.tasks?.map(t => t._id === taskId ? { ...t, status: newStatus as any } : t) };
    });
    await updateTaskStatus(meeting._id, taskId, newStatus);
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
      Alert.alert('Translation Error', error.message);
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
      const answer = await askMeeting(meeting._id, msg);
      setMessages(prev => [{ role: 'ai', content: answer }, ...prev]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Chat Error', error.message);
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
      Alert.alert('Sharing Error', error.message);
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
      Alert.alert('Export Failed', error.message);
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

  const createFollowUpEvent = async () => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    if (!meeting?.followUp) return;
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Calendar access is required to schedule events.');
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCal = calendars.find(c => c.isPrimary) || calendars[0];

      if (!defaultCal) {
        Alert.alert('Error', 'No calendar found on this device.');
        return;
      }

      const startDate = meeting.followUp.suggestedDate ? new Date(meeting.followUp.suggestedDate) : new Date();
      if (isNaN(startDate.getTime())) startDate.setTime(Date.now() + 86400000); // Default to tomorrow

      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);

      await Calendar.createEventAsync(defaultCal.id, {
        title: meeting.followUp.title,
        startDate,
        endDate,
        notes: `Follow-up from meeting: ${meeting.title}\n\nSummary: ${meeting.summary}`,
      });

      Alert.alert('Success', 'Follow-up event added to your calendar.');
    } catch (error: any) {
      Alert.alert('Calendar Error', 'Could not schedule event.');
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

  const renderTranscriptContent = (text: string) => {
    if (!text) return <Text style={styles.paragraph}>No transcript available.</Text>;
    
    const parts = text.split(/(Speaker [A-Z0-9]+:)/g);
    if (parts.length <= 1) return <Text style={styles.transcriptText}>{text}</Text>;

    const elements = [];
    for (let i = 1; i < parts.length; i += 2) {
      const originalLabel = parts[i].trim().replace(':', '');
      const label = meeting?.speakerNames?.[originalLabel] || originalLabel;
      const content = parts[i+1]?.trim();
      if (content) {
        elements.push(
          <View key={i} style={styles.speakerRow}>
            <TouchableOpacity onPress={() => { 
              if (isPremium) { setShowSpeakerModal({ id: originalLabel, name: label }); setNewSpeakerName(label); } 
              else { router.push('/paywall'); }
            }}>
              <Text style={styles.speakerLabel}>{label} <Feather name={isPremium ? "edit-2" : "lock"} size={10} color={themeColors.textMuted} /></Text>
            </TouchableOpacity>
            <View style={styles.speakerBubble}>
              <Text style={styles.speakerText}>{content}</Text>
            </View>
          </View>
        );
      }
    }
    return <View>{elements}</View>;
  };

  const renderHeatmap = () => {
    if (!meeting?.transcript) return null;
    const segments = meeting.transcript.split(/(Speaker [A-Z0-9]+:)/g).filter(s => s.trim());
    const data: { speaker: string, length: number }[] = [];
    for (let i = 0; i < segments.length; i += 2) {
      const speaker = segments[i]?.replace(':', '').trim() || 'Unknown';
      const text = segments[i+1] || '';
      data.push({ speaker, length: text.length });
    }
    const totalLength = data.reduce((acc, curr) => acc + curr.length, 0);
    if (totalLength === 0) return null;
    const colors: { [key: string]: string } = { 'Speaker A': '#007AFF', 'Speaker B': '#32D74B', 'Speaker C': '#FF9F0A', 'Speaker D': '#BF5AF2', 'Unknown': '#8E8E93' };
    return (
      <View style={{ marginTop: 20 }}>
        <Text style={styles.sectionTitle}>Speaking Timeline</Text>
        <GlassCard style={{ padding: 12, flexDirection: 'row', height: 40, overflow: 'hidden', gap: 2 }}>
          {data.map((segment, idx) => (
            <View key={idx} style={{ flex: segment.length, backgroundColor: colors[segment.speaker] || '#6366f1', borderRadius: 2 }} />
          ))}
        </GlassCard>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          {Object.keys(colors).filter(s => data.some(d => d.speaker === s)).map(s => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[s] }} />
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

  if (loading) return <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.bg }]}><ActivityIndicator size="large" color={themeColors.primary} /></SafeAreaView>;
  if (!meeting) return <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}><View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Feather name="arrow-left" size={24} color={themeColors.textPrimary} /></TouchableOpacity></View><View style={styles.notFound}><Text style={styles.paragraph}>Meeting not found</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>{meeting.title}</Text>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowActionMenu(true)}>
          <Feather name="more-vertical" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <PillTabs tabs={['Overview', 'Transcript', 'Tasks', 'Chat']} active={activeTab} onChange={setActiveTab} />
      </View>

      <View style={{ flex: 1 }}>
        {activeTab !== 3 ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {activeTab === 0 && (
              <View style={styles.tabContent}>
                <View style={{ marginBottom: 15 }}>
                  <Text style={{ fontSize: 13, color: themeColors.textMuted, fontWeight: '600' }}>
                    {new Date(meeting.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • {formatDuration(meeting.duration)}
                  </Text>
                </View>

                {meeting.followUp && (
                  <GlassCard style={{ backgroundColor: themeColors.primary + '10', marginBottom: 15, borderColor: themeColors.primary + '30' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: themeColors.primaryLight, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Suggested Follow-up</Text>
                        <Text style={{ color: themeColors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 4 }}>{meeting.followUp.title}</Text>
                        {meeting.followUp.suggestedDate && (
                          <Text style={{ color: themeColors.textSecondary, fontSize: 13, marginTop: 2 }}>{new Date(meeting.followUp.suggestedDate).toLocaleDateString()}</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={createFollowUpEvent} style={{ backgroundColor: isPremium ? themeColors.primary : 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
                        <Feather name={isPremium ? "calendar" : "lock"} size={16} color={isPremium ? "#fff" : themeColors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                )}
                
                {meeting.analysis?.sentiment && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 }}>
                     <Badge 
                      label={meeting.analysis.sentiment} 
                      color={meeting.analysis.sentiment === 'positive' ? themeColors.success : meeting.analysis.sentiment === 'negative' ? themeColors.danger : themeColors.textMuted} 
                      bg={meeting.analysis.sentiment === 'positive' ? themeColors.success + '15' : meeting.analysis.sentiment === 'negative' ? themeColors.danger + '15' : 'rgba(128,128,128,0.1)'} 
                    />
                    <Text style={{ color: themeColors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 }}>{meeting.analysis.tone}</Text>
                  </View>
                )}

                {meeting.analysis?.conflictDetected && (
                  <View style={{ backgroundColor: themeColors.danger + '10', padding: 12, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: themeColors.danger, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Feather name="alert-triangle" size={18} color={themeColors.danger} />
                    <Text style={{ color: themeColors.danger, fontSize: 13, fontWeight: '600', flex: 1 }}>Conflict detected in this session.</Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.sectionTitle}>Personal Notes</Text>
                  {hasUnsavedNotes && (
                    <TouchableOpacity onPress={handleSaveNotes} style={{ backgroundColor: themeColors.success, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                      {isSavingNotes ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>SAVE CHANGES</Text>}
                    </TouchableOpacity>
                  )}
                </View>
                <GlassCard style={[styles.card, { padding: 0, marginBottom: 20 }]}>
                  <TextInput 
                    style={{ color: themeColors.textPrimary, fontSize: 14, lineHeight: 22, padding: 15, minHeight: 120, textAlignVertical: 'top' }} 
                    multiline 
                    placeholder="Tap to add your own notes, thoughts or follow-ups..." 
                    placeholderTextColor={themeColors.textMuted}
                    value={userNotes}
                    onChangeText={(v) => { setUserNotes(v); setHasUnsavedNotes(true); }}
                  />
                </GlassCard>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.sectionTitle}>Summary {translatedMeeting ? '(Translated)' : ''}</Text>
                  <TouchableOpacity onPress={sendRecapEmail} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: themeColors.primaryGlow, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                    <Feather name="mail" size={14} color={themeColors.primaryLight} />
                    <Text style={{ color: themeColors.primaryLight, fontSize: 12, fontWeight: '700' }}>Draft Email</Text>
                  </TouchableOpacity>
                </View>
                <GlassCard style={styles.card}>
                  <Text style={styles.paragraph}>{translatedMeeting?.summary || meeting.summary || 'No summary available.'}</Text>
                </GlassCard>
                <Text style={styles.sectionTitle}>Key Decisions {translatedMeeting ? '(Translated)' : ''}</Text>
                <GlassCard style={styles.card}>
                  {(translatedMeeting?.decisions || meeting.decisions) && (translatedMeeting?.decisions || meeting.decisions)!.length > 0 ? (translatedMeeting?.decisions || meeting.decisions)!.map((d, i) => (
                    <View key={i} style={styles.listItem}><Feather name="zap" size={12} color={themeColors.primary} style={styles.bullet} /><Text style={styles.listText}>{d}</Text></View>
                  )) : <Text style={styles.paragraph}>No key decisions recorded.</Text>}
                </GlassCard>
                {renderHeatmap()}
                <View style={styles.audioPlayerContainer}>
                  <View style={styles.progressContainer}>
                    <Slider
                      style={{ width: '100%', height: 40 }}
                      minimumValue={0}
                      maximumValue={playbackDuration || (meeting.duration * 1000)}
                      value={playbackPosition}
                      onSlidingStart={() => setIsSeeking(true)}
                      onSlidingComplete={(value) => {
                        setIsSeeking(false);
                        handleSeek(value);
                      }}
                      minimumTrackTintColor={themeColors.primary}
                      maximumTrackTintColor={themeColors.border}
                      thumbTintColor={themeColors.primary}
                    />
                    <View style={styles.timeLabels}>
                      <Text style={styles.audioTime}>{formatDuration(playbackPosition / 1000)}</Text>
                      <Text style={styles.audioTime}>{formatDuration((playbackDuration || meeting.duration * 1000) / 1000)}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.audioControlsRow}>
                    <TouchableOpacity 
                      style={styles.seekBtn} 
                      onPress={async () => { 
                        if (sound) { 
                          const s = await sound.getStatusAsync(); 
                          if (s.isLoaded) await sound.setPositionAsync(Math.max(0, s.positionMillis - 10000)); 
                        } 
                      }}
                    >
                      <Feather name="rotate-ccw" size={22} color={themeColors.textSecondary} />
                      <Text style={{ fontSize: 10, color: themeColors.textMuted, fontWeight: '700', marginTop: 2 }}>10s</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.playBtn, { overflow: 'hidden' }]} 
                      onPress={playSound}
                    >
                      <LinearGradient
                        colors={themeColors.gradientPrimary as [string, string]}
                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Feather name={isPlaying ? "pause" : "play"} size={28} color="#fff" />
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.seekBtn} 
                      onPress={async () => { 
                        if (sound) { 
                          const s = await sound.getStatusAsync(); 
                          if (s.isLoaded) await sound.setPositionAsync(Math.min(s.durationMillis || 0, s.positionMillis + 10000)); 
                        } 
                      }}
                    >
                      <Feather name="rotate-cw" size={22} color={themeColors.textSecondary} />
                      <Text style={{ fontSize: 10, color: themeColors.textMuted, fontWeight: '700', marginTop: 2 }}>10s</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {activeTab === 1 && (
              <View style={styles.tabContent}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.sectionTitle}>Transcript {translatedMeeting ? '(Translated)' : ''}</Text>
                  <TouchableOpacity onPress={copyTranscript} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="copy" size={14} color={themeColors.primaryLight} />
                    <Text style={{ color: themeColors.primaryLight, fontSize: 12, fontWeight: '600' }}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <GlassCard style={styles.card}>{renderTranscriptContent(meeting.transcript || '')}</GlassCard>
              </View>
            )}

            {activeTab === 2 && (
              <View style={styles.tabContent}>
                <View style={styles.tasksHeader}>
                  <Text style={styles.sectionTitle}>Action Items</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      style={[styles.addTaskBtn, { backgroundColor: isPremium ? 'rgba(74, 21, 75, 0.1)' : 'rgba(128,128,128,0.1)' }]} 
                      onPress={() => exportTasks('Slack')}
                    >
                      <Feather name={isPremium ? "slack" : "lock"} size={14} color={isPremium ? "#4A154B" : themeColors.textMuted} />
                      <Text style={[styles.addTaskText, { color: isPremium ? '#4A154B' : themeColors.textMuted }]}>Slack</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addTaskBtn} onPress={() => setShowAddTaskModal(true)}>
                      <Feather name="plus" size={16} color={themeColors.primaryLight} />
                      <Text style={styles.addTaskText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {meeting.tasks && meeting.tasks.length > 0 ? meeting.tasks.map(t => (
                  <GlassCard key={t._id} style={styles.taskCard}>
                    <View style={styles.taskHeader}>
                      <TouchableOpacity style={styles.checkbox} onPress={() => toggleTaskStatus(t._id)}>
                        {t.status === 'completed' ? <Feather name="check-circle" size={24} color={themeColors.primary} /> : <Feather name="circle" size={24} color={themeColors.textMuted} />}
                      </TouchableOpacity>
                      <View style={styles.taskInfo}>
                        <Text style={[styles.taskTitle, t.status === 'completed' && styles.taskCompleted]}>{t.title}</Text>
                        {t.description && <Text style={styles.taskDesc} numberOfLines={2}>{t.description}</Text>}
                      </View>
                    </View>
                    <View style={styles.taskFooter}>
                      <View style={styles.footerChips}>
                        {t.owner && <View style={styles.chip}><Feather name="user" size={12} color={themeColors.textSecondary} /><Text style={styles.chipText}>{t.owner}</Text></View>}
                        {t.dueDate && <View style={styles.chip}><Feather name="calendar" size={12} color={themeColors.textSecondary} /><Text style={styles.chipText}>{new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></View>}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={() => syncTaskToCalendar(t.title, t.dueDate ? t.dueDate.toString() : undefined, `From: ${meeting.title}`)}><Feather name="calendar" size={18} color={themeColors.primaryLight} /></TouchableOpacity>
                        <Badge label={t.priority} color={getPriorityColor(t.priority)} bg={getPriorityColor(t.priority) + '20'} />
                      </View>
                    </View>
                  </GlassCard>
                )) : <Text style={styles.paragraph}>No tasks extracted.</Text>}
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
                      <Text style={[chatStyles.bubbleText, { color: item.role === 'user' ? '#fff' : themeColors.textPrimary, flex: 1 }]}>{item.content}</Text>
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
                <MenuOption icon="file-text" label="Export PDF Report" premium onPress={() => { setShowActionMenu(false); generatePDF(); }} />
                <MenuOption icon="globe" label="Translate Content" premium onPress={() => { setShowActionMenu(false); setShowTranslateModal(true); }} />
                <MenuOption icon="folder" label="Move to Folder" onPress={() => { setShowActionMenu(false); setShowMoveFolderModal(true); }} />
                <MenuOption icon="user-plus" label="Share Access" onPress={() => { setShowActionMenu(false); setShowInternalShareModal(true); }} />
                <MenuOption icon="share" label="Share Summary" onPress={() => { setShowActionMenu(false); handleShare(); }} />
                <Divider style={{ marginVertical: 10 }} />
                <MenuOption icon="trash-2" label="Delete Forever" danger onPress={() => {
                    setShowActionMenu(false);
                    Alert.alert('Delete Recording', 'This action cannot be undone. Are you sure?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteMeeting(meeting._id); router.back(); } }
                    ]);
                  }} 
                />
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
