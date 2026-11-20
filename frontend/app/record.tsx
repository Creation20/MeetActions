import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Alert, Dimensions, Platform, StyleSheet, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Colors } from '../src/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL, fetchTemplates, ExtractionTemplateInfo, startLiveSession, sendLiveChunk, stopLiveSession } from '../src/services/api';
import { getRecordStyles } from '../src/styles/record.styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { Aurora } from '../src/components/Aurora';
import * as Haptics from 'expo-haptics';
import { showError } from '../src/utils/errors';

// Map backend template ids to valid Feather icon names.
const TEMPLATE_ICONS: Record<string, string> = {
  Default: 'zap',
  '1:1': 'users',
  Sales: 'trending-up',
  Standup: 'git-branch',
  Interview: 'clipboard',
  Lecture: 'book-open',
};

export default function RecordScreen() {
  const router = useRouter();
  const { isPremium } = useAuth();
  const { isDarkMode, colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getRecordStyles(isDarkMode), [isDarkMode]);
  
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [playbackSound, setPlaybackSound] = useState<Audio.Sound | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const [isAutoAIEnabled, setIsAutoAIEnabled] = useState(true);
  const silentSeconds = useRef(0);
  const [duration, setDuration] = useState(0);
  const [liveInsights, setLiveInsights] = useState<string[]>([]);
  const [isZenMode, setIsZenMode] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const zenPulse = useRef(new Animated.Value(1)).current;

  // Visualizer bars + live audio level (0..1) driven by real microphone metering
  const bars = useRef([...Array(28)].map(() => new Animated.Value(4))).current;
  const levelRef = useRef(0.35);
  const tickRef = useRef(0);

  useEffect(() => {
    let waveInterval: any;
    let secInterval: any;
    if (isRecording && !isPaused) {
      // Accurate 1-second clock.
      secInterval = setInterval(() => setDuration((d) => d + 1), 1000);
      // Fast waveform driven by real mic level.
      waveInterval = setInterval(() => {
        const level = levelRef.current;
        bars.forEach((bar, i) => {
          // Center-weighted amplitude so the waveform blooms from the middle.
          const centerBias = 1 - Math.abs(i - bars.length / 2) / (bars.length / 2);
          const jitter = 0.55 + Math.random() * 0.45;
          const target = 4 + level * 46 * (0.4 + centerBias * 0.6) * jitter;
          Animated.spring(bar, { toValue: target, speed: 40, bounciness: 6, useNativeDriver: false }).start();
        });
      }, 140);
    } else if (!isRecording) {
      bars.forEach(bar => {
        Animated.spring(bar, { toValue: 4, useNativeDriver: false }).start();
      });
    }
    return () => { clearInterval(waveInterval); clearInterval(secInterval); };
  }, [isRecording, isPaused]);

  useEffect(() => {
    let insightInterval: any;
    if (isRecording) {
      const insightPool = [
        'Analyzing speech patterns...', 
        'Detecting key speakers...', 
        'Identifying action items...', 
        'Summarizing context...', 
        'Extracting dates...', 
        'Mapping decisions...',
        'Listening for keywords...',
        'Processing voice data...'
      ];
      insightInterval = setInterval(() => {
        setLiveInsights(prev => {
          const next = insightPool[Math.floor(Math.random() * insightPool.length)];
          if (prev.includes(next)) return prev;
          return [next, ...prev].slice(0, 3);
        });
      }, 2500);
    } else {
      setLiveInsights([]);
    }
    return () => clearInterval(insightInterval);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(zenPulse, { toValue: 1.5, duration: 2000, useNativeDriver: true }),
          Animated.timing(zenPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      zenPulse.stopAnimation();
      pulseAnim.setValue(1);
      zenPulse.setValue(1);
    }
  }, [isRecording, isPaused]);

  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    return () => {
      if (playbackSound) {
        playbackSound.unloadAsync().catch(() => {});
      }
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [playbackSound, recording]);

  const startRecording = async () => {
    if (isResetting) return;
    
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permission is required to record.');
        return;
      }
      
      setIsResetting(true);
      
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (e) {}
        setRecording(null);
      }

      if (playbackSound) {
        try {
          await playbackSound.unloadAsync();
        } catch (e) {}
        setPlaybackSound(null);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
        (status) => {
          // Drive the live waveform from real microphone level (always, regardless of tier).
          if (status.canRecord && status.isRecording) {
            const m = status.metering ?? -160;
            levelRef.current = Math.max(0.04, Math.min(1, (m + 55) / 55));
          }
          if (status.canRecord && status.isRecording && isPremium && isAutoAIEnabled) {
            const metering = status.metering || -160;
            if (metering < -45) {
              silentSeconds.current += 0.5; 
              if (silentSeconds.current >= 5 && !isPaused) {
                recording?.pauseAsync();
                setIsPaused(true);
                setIsAutoPaused(true);
              }
            } else {
              silentSeconds.current = 0;
              if (isAutoPaused) {
                (recording as any)?.startAsync();
                setIsPaused(false);
                setIsAutoPaused(false);
              }
            }
          }
        },
        500
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      setDuration(0);
      setRecordedUri(null);
      setBookmarks([]);
      setAttachedPhoto(null);
      setIsResetting(false);
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsResetting(false);
      Alert.alert('Recording Error', 'The system is busy or resetting. Please wait a second and try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    setIsPaused(false);
    setIsZenMode(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording', error);
    }
  };

  const pauseRecording = async () => {
    if (recording && isRecording) {
      try {
        await recording.pauseAsync();
        setIsPaused(true);
      } catch (err) {
        console.error('Failed to pause recording', err);
      }
    }
  };

  const resumeRecording = async () => {
    if (recording && isRecording) {
      try {
        await (recording as any).startAsync();
        setIsPaused(false);
        setIsAutoPaused(false);
        silentSeconds.current = 0;
      } catch (err) {
        console.error('Failed to resume recording', err);
      }
    }
  };

  const playPreview = async () => {
    if (!recordedUri) return;

    try {
      if (playbackSound) {
        if (isPlayingPreview) {
          await playbackSound.pauseAsync();
        } else {
          await playbackSound.playAsync();
        }
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true, volume: 1.0 },
        (status) => {
          if (status.isLoaded) {
            setIsPlayingPreview(status.isPlaying);
            if (status.didJustFinish) {
              setIsPlayingPreview(false);
              sound.setPositionAsync(0);
            }
          }
        }
      );
      setPlaybackSound(sound);
    } catch (error) {
      console.error('Error playing preview', error);
      Alert.alert('Playback Error', 'Could not play the recorded audio.');
    }
  };

  const seek = async (direction: 'back' | 'forward') => {
    if (playbackSound) {
      const status = await playbackSound.getStatusAsync();
      if (status.isLoaded) {
        const offset = direction === 'back' ? -5000 : 5000;
        const newPos = Math.max(0, Math.min(status.durationMillis || 0, status.positionMillis + offset));
        await playbackSound.setPositionAsync(newPos);
      }
    }
  };

  const pickAudioFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
    if (!result.canceled && result.assets.length > 0) {
      const file = result.assets[0];
      uploadAudio(file.uri, file.name);
    }
  };

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  useEffect(() => {
    if (recordedUri && !isRecording) {
      setStartTime(0);
      setEndTime(duration);
    }
  }, [recordedUri, isRecording]);

  const [bookmarks, setBookmarks] = useState<{ type: string, time: number }[]>([]);

  const addBookmark = (type: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBookmarks(prev => [...prev, { type, time: duration }]);
  };

  const [mode, setMode] = useState<string>('Default');
  const [templates, setTemplates] = useState<ExtractionTemplateInfo[]>([]);
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => {});
  }, []);

  const pickImage = async () => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setAttachedPhoto(result.assets[0].uri);
    }
  };

  const uploadAudio = async (uri?: string, customName?: string) => {
    const targetUri = uri || recordedUri;
    const filename = customName || `Recording-${Date.now()}.m4a`;
    if (!targetUri) return;

    try {
      await AsyncStorage.removeItem('@last_upload_id'); // clear any stale id
      router.replace('/processing/pending');

      const storedSettings = await AsyncStorage.getItem('user_settings');
      const settings = storedSettings ? JSON.parse(storedSettings) : { autoSummary: true };
      const autoGenerate = settings.autoSummary !== false;

      const formData = new FormData();
      formData.append('title', filename);
      formData.append('duration', duration.toString());
      formData.append('autoGenerate', autoGenerate.toString()); 
      formData.append('trimStart', startTime.toString());
      formData.append('trimEnd', endTime.toString());
      formData.append('bookmarks', JSON.stringify(bookmarks));
      formData.append('mode', isPremium ? mode : 'Default');

      if (attachedPhoto) {
        const photoName = attachedPhoto.split('/').pop() || 'whiteboard.jpg';
        formData.append('image', {
          uri: attachedPhoto,
          name: photoName,
          type: 'image/jpeg',
        } as any);
      }

      formData.append('audio', {
        uri: targetUri,
        name: filename,
        type: 'audio/m4a',
      } as any);

      const token = await AsyncStorage.getItem('@auth_token');
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        body: formData,
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      });
      
      if (!response.ok) throw new Error('Upload failed');
      // Hand the real meeting id to the processing screen so it can poll real status.
      const data = await response.json().catch(() => null);
      if (data?.meeting?._id) {
        await AsyncStorage.setItem('@last_upload_id', String(data.meeting._id));
      }
    } catch (error) {
      console.error('Upload Error:', error);
      Alert.alert('Upload Failed', 'There was an error uploading the audio.');
    }
  };

  // ─── #3 Live / streaming mode ───────────────────────────────────────────────
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const liveState = useRef({ active: false, meetingId: '', offset: 0, rec: null as Audio.Recording | null });
  const CHUNK_MS = 15000; // rolling chunk length

  const recordLiveChunk = async () => {
    try {
      const { recording: chunkRec } = await Audio.Recording.createAsync(
        { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
        (status) => {
          if (status.canRecord && status.isRecording) {
            const m = status.metering ?? -160;
            levelRef.current = Math.max(0.04, Math.min(1, (m + 55) / 55));
          }
        },
        200
      );
      liveState.current.rec = chunkRec;
      await new Promise((r) => setTimeout(r, CHUNK_MS));

      // Stop this chunk (whether we're continuing or finishing).
      try { await chunkRec.stopAndUnloadAsync(); } catch {}
      const uri = chunkRec.getURI();
      liveState.current.rec = null;
      if (!uri) return;

      const offset = liveState.current.offset;
      liveState.current.offset += CHUNK_MS / 1000;
      try {
        const { transcript } = await sendLiveChunk(liveState.current.meetingId, uri, offset);
        if (transcript) setLiveTranscript(transcript);
      } catch (e) {
        console.warn('[Live] chunk upload failed', e);
      }
    } catch (e) {
      console.warn('[Live] chunk record failed', e);
    }
  };

  const startLive = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const title = `Live Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const { meetingId } = await startLiveSession(title, isPremium ? mode : 'Default');
      liveState.current = { active: true, meetingId, offset: 0, rec: null };
      setLiveTranscript('');
      setDuration(0);
      setIsRecording(true);

      // Sequential rolling-chunk loop.
      while (liveState.current.active) {
        await recordLiveChunk();
      }
    } catch (e: any) {
      showError(e, 'Live transcription unavailable', "We couldn't start live transcription. Please try again.");
      liveState.current.active = false;
      setIsRecording(false);
    }
  };

  const stopLive = async () => {
    liveState.current.active = false;
    const { meetingId } = liveState.current;
    if (liveState.current.rec) {
      try { await liveState.current.rec.stopAndUnloadAsync(); } catch {}
      liveState.current.rec = null;
    }
    setIsRecording(false);
    try {
      await stopLiveSession(meetingId, duration, isPremium ? mode : 'Default');
    } catch (e) {
      console.warn('[Live] stop failed', e);
    }
    router.replace(`/processing/${meetingId}`);
  };

  const handleRecordToggle = () => {
    Haptics.impactAsync(isRecording ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
    if (isLiveMode) {
      if (isRecording) stopLive();
      else startLive();
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleClose = async () => {
    if (isRecording && recording) {
      await recording.stopAndUnloadAsync().catch(() => {});
    }
    if (playbackSound) {
      await playbackSound.unloadAsync().catch(() => {});
    }
    router.back();
  };

  const handleDiscard = async () => {
    Alert.alert(
      'Discard Recording',
      'Are you sure you want to discard this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Discard', 
          style: 'destructive', 
          onPress: async () => {
            if (recording) {
              try {
                await recording.stopAndUnloadAsync();
              } catch (e) {}
              setRecording(null);
            }
            if (playbackSound) {
              try {
                await playbackSound.unloadAsync();
              } catch (e) {}
              setPlaybackSound(null);
            }
            setIsRecording(false);
            setIsPaused(false);
            setIsAutoPaused(false);
            setRecordedUri(null);
            setDuration(0);
            setBookmarks([]);
            setAttachedPhoto(null);
          }
        }
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <Aurora isDark={isDarkMode} variant="record" intensity={isRecording ? 1 : 0.7} />

      {isZenMode && isRecording && (
        <View style={[styles.zenContainer, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
          <Animated.View style={[styles.zenPulse, { transform: [{ scale: zenPulse }], backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} />
          <Text style={[styles.zenTimer, { color: themeColors.textPrimary }]}>{formatTime(duration)}</Text>
          <TouchableOpacity style={styles.zenExit} onPress={() => setIsZenMode(false)}>
            <Feather name="minimize-2" size={24} color={themeColors.textMuted} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 40, marginTop: 60 }}>
            <TouchableOpacity 
              onPress={isPaused ? resumeRecording : pauseRecording}
              style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name={isPaused ? "play" : "pause"} size={24} color={isDarkMode ? "#fff" : "#000"} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={stopRecording}
              style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ width: 30, height: 30, borderRadius: 4, backgroundColor: '#fff' }} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <SafeAreaView style={{ flex: 1 }}>
        {/* Minimal Professional Header */}
        <View style={[styles.header, { height: 90, borderBottomWidth: 1, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Feather name="x" size={24} color={themeColors.textPrimary} />
          </TouchableOpacity>
          
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { fontSize: 20 }]}>
              {isRecording ? (isPaused || isAutoPaused ? 'Recording Paused' : 'Live Recording') : 'Voice Memo'}
            </Text>
            <View style={[styles.liveIndicator, { backgroundColor: isRecording ? (isPaused || isAutoPaused ? themeColors.warning + '15' : themeColors.danger + '15') : themeColors.textMuted + '10', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 6 }]}>
              <View style={[styles.dot, { width: 8, height: 8 }, isRecording && !isPaused && !isAutoPaused && { backgroundColor: themeColors.danger }, (isPaused || isAutoPaused) && { backgroundColor: themeColors.warning }]} />
              <Text style={[styles.liveText, { fontSize: 11, color: isRecording ? (isPaused || isAutoPaused ? themeColors.warning : themeColors.danger) : themeColors.textMuted }]}>
                {isRecording ? (isPaused || isAutoPaused ? 'PAUSED' : 'LIVE') : 'READY'}
              </Text>
            </View>
          </View>

          {isRecording ? (
            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsZenMode(true)}>
              <Feather name="maximize-2" size={20} color={themeColors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* Main Recording Interface */}
        <View style={styles.centerContent}>
          {!isRecording && !recordedUri && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginBottom: 36, maxHeight: 48 }}
              contentContainerStyle={{ gap: 8, alignItems: 'center', paddingHorizontal: 20 }}
            >
              {(templates.length ? templates : [{ id: 'Default', label: 'General', icon: 'sparkles', description: '' }]).map((t) => {
                const active = mode === t.id;
                const locked = t.id !== 'Default' && !isPremium;
                const icon = TEMPLATE_ICONS[t.id] || 'zap';
                const inner = (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Feather name={(locked ? 'lock' : icon) as any} size={13} color={active ? '#fff' : themeColors.textMuted} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : themeColors.textSecondary }}>{t.label}</Text>
                  </View>
                );
                return (
                  <TouchableOpacity
                    key={t.id}
                    activeOpacity={0.85}
                    onPress={() => { Haptics.selectionAsync(); if (t.id === 'Default' || isPremium) setMode(t.id); else router.push('/paywall'); }}
                  >
                    {active ? (
                      <LinearGradient colors={['#0A84FF', '#5B54E8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 14 }}>
                        {inner}
                      </LinearGradient>
                    ) : (
                      <View style={{ borderRadius: 14, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>{inner}</View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {!isRecording && !recordedUri && (
            <TouchableOpacity
              onPress={() => { if (!isPremium) { router.push('/paywall'); return; } setIsLiveMode(!isLiveMode); }}
              style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: isLiveMode ? themeColors.danger : themeColors.border, backgroundColor: isLiveMode ? themeColors.danger + '15' : 'transparent' }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isLiveMode ? themeColors.danger : themeColors.textMuted }} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: isLiveMode ? themeColors.danger : themeColors.textSecondary }}>
                {isLiveMode ? 'LIVE TRANSCRIPTION ON' : 'Live Transcription'}{!isPremium ? ' 🔒' : ''}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(duration)}</Text>
          </View>

          {isLiveMode && isRecording && (
            <View style={{ maxHeight: 160, marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 16, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderWidth: 1, borderColor: themeColors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: themeColors.danger }} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: themeColors.danger, letterSpacing: 0.5 }}>LIVE TRANSCRIPT</Text>
              </View>
              <ScrollView>
                <Text style={{ fontSize: 13, lineHeight: 20, color: themeColors.textSecondary }}>
                  {liveTranscript || 'Listening… your words will appear here every few seconds.'}
                </Text>
              </ScrollView>
            </View>
          )}

          <View style={styles.visualizerBox}>
            {bars.map((bar, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.bar,
                  { height: bar, backgroundColor: isRecording ? themeColors.primary : themeColors.textMuted }
                ]}
              />
            ))}
          </View>

          {isRecording && (
            <>
              <View style={styles.liveInsightsContainer}>
                {liveInsights.map((insight, index) => (
                  <View 
                    key={insight + index} 
                    style={[styles.insightPill, { opacity: 1 - (index * 0.35) }]}
                  >
                    <Feather name="zap" size={12} color={themeColors.primary} />
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.bookmarkRow}>
                <TouchableOpacity 
                  style={styles.bookmarkBtn} 
                  onPress={() => addBookmark('Important')}
                >
                  <Feather name="star" size={14} color={Colors.warning} />
                  <Text style={styles.bookmarkText}>Important</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.bookmarkBtn} 
                  onPress={() => addBookmark('Decision')}
                >
                  <Feather name="check-circle" size={14} color={Colors.success} />
                  <Text style={styles.bookmarkText}>Decision</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.bookmarkBtn} 
                  onPress={pickImage}
                >
                  <Feather name={isPremium ? "camera" : "lock"} size={14} color={attachedPhoto ? Colors.success : (isPremium ? themeColors.primary : themeColors.textMuted)} />
                  <Text style={[styles.bookmarkText, attachedPhoto && { color: Colors.success }]}>{attachedPhoto ? 'Photo Attached' : 'Capture'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {recordedUri && !isRecording && (
            <View style={styles.reviewContainer}>
              <View style={styles.reviewControls}>
                <TouchableOpacity onPress={() => seek('back')} style={styles.smallSeek}>
                  <Feather name="rotate-ccw" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.mainPlayBtn} onPress={playPreview}>
                  <LinearGradient
                    colors={themeColors.gradientPrimary as [string, string]}
                    style={styles.mainPlayGradient}
                  >
                    <Feather name={isPlayingPreview ? "pause" : "play"} size={32} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => seek('forward')} style={styles.smallSeek}>
                  <Feather name="rotate-cw" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewText}>Preview Recording</Text>

              {/* Trimming UI */}
              <View style={styles.trimContainer}>
                <View style={styles.trimRow}>
                  <Text style={styles.trimLabel}>Trim Start</Text>
                  <View style={styles.trimValueWrap}>
                    <TouchableOpacity 
                      style={styles.trimBtn} 
                      onPress={() => setStartTime(Math.max(0, startTime - 1))}
                    >
                      <Feather name="minus" size={16} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={styles.trimValue}>{formatTime(startTime)}</Text>
                    <TouchableOpacity 
                      style={styles.trimBtn} 
                      onPress={() => setStartTime(Math.min(endTime - 1, startTime + 1))}
                    >
                      <Feather name="plus" size={16} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.trimRow}>
                  <Text style={styles.trimLabel}>Trim End</Text>
                  <View style={styles.trimValueWrap}>
                    <TouchableOpacity 
                      style={styles.trimBtn} 
                      onPress={() => setEndTime(Math.max(startTime + 1, endTime - 1))}
                    >
                      <Feather name="minus" size={16} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={styles.trimValue}>{formatTime(endTime)}</Text>
                    <TouchableOpacity 
                      style={styles.trimBtn} 
                      onPress={() => setEndTime(Math.min(duration, endTime + 1))}
                    >
                      <Feather name="plus" size={16} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomBar}>
          {(!isRecording && duration === 0) ? (
            <TouchableOpacity style={styles.sideBtn} onPress={pickAudioFile}>
              <View style={styles.sideBtnCircle}>
                <Feather name="upload" size={20} color={themeColors.textSecondary} />
              </View>
              <Text style={styles.sideBtnLabel}>Import</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.sideBtn} onPress={handleDiscard}>
              <View style={[styles.sideBtnCircle, { backgroundColor: Colors.danger + '15' }]}>
                <Feather name="trash-2" size={20} color={Colors.danger} />
              </View>
              <Text style={[styles.sideBtnLabel, { color: Colors.danger }]}>Discard</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.recordActionWrap, { width: 140, height: 140 }]}>
            {/* Concentric glow rings while recording */}
            {isRecording && (
              <>
                <Animated.View
                  style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1.5, borderColor: themeColors.danger, transform: [{ scale: pulseAnim }], opacity: 0.25 }}
                />
                <Animated.View
                  style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: themeColors.danger, transform: [{ scale: zenPulse }], opacity: 0.18 }}
                />
              </>
            )}

            {recordedUri && !isRecording ? (
              <TouchableOpacity activeOpacity={0.85} style={styles.saveBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); uploadAudio(); }}>
                <LinearGradient colors={themeColors.gradientAccent as [string, string]} style={styles.saveGradient}>
                  <Feather name="check" size={34} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity activeOpacity={0.85} onPress={handleRecordToggle}>
                <LinearGradient
                  colors={isRecording ? [themeColors.danger, '#C4302B'] : ['#0A84FF', '#5B54E8']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', shadowColor: isRecording ? themeColors.danger : '#0A84FF', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}
                >
                  {/* inner ring to create a "record" bezel */}
                  <View style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                    {isRecording
                      ? <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: '#fff' }} />
                      : <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff' }} />}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {isRecording ? (
            <TouchableOpacity style={styles.sideBtn} onPress={isPaused ? resumeRecording : pauseRecording}>
              <View style={[styles.sideBtnCircle, isPaused && { backgroundColor: themeColors.primary + '20' }]}>
                <Feather name={isPaused ? "play" : "pause"} size={20} color={isPaused ? themeColors.primary : themeColors.textSecondary} />
              </View>
              <Text style={[styles.sideBtnLabel, isPaused && { color: themeColors.primary }]}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.sideBtn} 
              onPress={() => setIsAutoAIEnabled(!isAutoAIEnabled)}
            >
              <View style={[styles.sideBtnCircle, isAutoAIEnabled && { backgroundColor: themeColors.primary + '15' }]}>
                <Feather name="mic" size={20} color={isAutoAIEnabled ? themeColors.primary : themeColors.textMuted} />
              </View>
              <Text style={[styles.sideBtnLabel, isAutoAIEnabled && { color: themeColors.primary }]}>{isAutoAIEnabled ? 'Auto-AI On' : 'Auto-AI Off'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
