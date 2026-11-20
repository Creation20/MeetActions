import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSize, FontWeight, Spacing } from '../../src/constants/theme';
import { GlassCard, SectionHeader, Badge, Divider, Skeleton } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchMeetings, ApiMeeting, fetchAnalytics, AnalyticsData, askGlobal, API_BASE_URL, fetchProactiveInsights, ProactiveInsights, fetchBriefing } from '../../src/services/api';
import { getHomeStyles } from '../../src/styles/home.styles';
import LottieView from 'lottie-react-native';
import { Aurora } from '../../src/components/Aurora';
import * as Haptics from 'expo-haptics';
import { showError } from '../../src/utils/errors';

export default function HomeScreen() {
  const router = useRouter();
  const { user, isPremium } = useAuth();
  const { isDarkMode, isOffline, colors: themeColors } = useTheme();
  const styles = useMemo(() => getHomeStyles(isDarkMode), [isDarkMode]);
  
  const [meetings, setMeetings] = useState<ApiMeeting[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [proactive, setProactive] = useState<ProactiveInsights | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [upcomingEvent, setUpcomingEvent] = useState<Calendar.Event | null>(null);

  // AI Hub State
  const [hubQuestion, setHubQuestion] = useState('');
  const [hubAnswer, setHubAnswer] = useState<string | null>(null);
  const [isAskingHub, setIsAskingHub] = useState(false);

  const loadData = async (isFirstLoad = false) => {
    if (isFirstLoad) setIsLoading(true);
    try {
      const [meetingsData, analyticsData, proactiveData] = await Promise.all([
        fetchMeetings(),
        fetchAnalytics(),
        fetchProactiveInsights()
      ]);
      setMeetings(meetingsData);
      setAnalytics(analyticsData);
      setProactive(proactiveData);
      checkUpcomingCalendar();
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') return;
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkUpcomingCalendar = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const yesterday = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const events = await Calendar.getEventsAsync(
          calendars.map(c => c.id),
          new Date(),
          tomorrow
        );

        if (events.length > 0) {
          const next = events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .find(e => new Date(e.startDate).getTime() > Date.now());
          setUpcomingEvent(next || null);
        }
      }
    } catch (e) {}
  };

  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const handleOpenBriefing = async () => {
    if (!upcomingEvent?.title) return;
    setLoadingBriefing(true);
    try {
      const b = await fetchBriefing(upcomingEvent.title);
      if (!b.hasHistory) {
        Alert.alert(upcomingEvent.title, "No related history found. This looks like a fresh topic — you're starting with a clean slate.");
        return;
      }
      const points = b.talkingPoints.length ? '\n\n📌 Talking points:\n' + b.talkingPoints.map(p => `• ${p}`).join('\n') : '';
      const open = b.openItems.length ? `\n\n⏳ ${b.openItems.length} open item(s) from last time:\n` + b.openItems.slice(0, 4).map(i => `• ${i.title}${i.owner ? ` (${i.owner})` : ''}`).join('\n') : '';
      Alert.alert(
        `Briefing · ${upcomingEvent.title}`,
        `${b.lastMeeting?.summary ? b.lastMeeting.summary.slice(0, 220) + '…' : ''}${open}${points}`,
        b.lastMeeting ? [
          { text: 'Open last meeting', onPress: () => router.push(`/meeting/${b.lastMeeting!.id}`) },
          { text: 'Done', style: 'cancel' },
        ] : undefined
      );
    } catch (e: any) {
      showError(e, 'Briefing unavailable', "We couldn't prepare your briefing. Please try again.");
    } finally {
      setLoadingBriefing(false);
    }
  };

  const handleAskHub = async () => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    if (!hubQuestion.trim()) return;
    setIsAskingHub(true);
    setHubAnswer(null);
    try {
      const { answer } = await askGlobal(hubQuestion.trim());
      setHubAnswer(answer);
    } catch (e: any) {
      showError(e, 'Assistant unavailable', "The assistant couldn't answer that right now. Please try again in a moment.");
    } finally {
      setIsAskingHub(false);
    }
  };

  const pickAndUploadAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (result.canceled || result.assets.length === 0) return;
      
      const file = result.assets[0];
      await AsyncStorage.removeItem('@last_upload_id');
      router.replace('/processing/pending');

      const formData = new FormData();
      formData.append('title', file.name);
      formData.append('autoGenerate', 'true');
      formData.append('audio', {
        uri: file.uri,
        name: file.name,
        type: 'audio/m4a',
      } as any);

      const token = await AsyncStorage.getItem('@auth_token');
      const res = await fetch(API_BASE_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      });
      const data = await res.json().catch(() => null);
      if (data?.meeting?._id) {
        await AsyncStorage.setItem('@last_upload_id', String(data.meeting._id));
      }
    } catch (e) {
      Alert.alert('Upload Error', 'Could not import audio file.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(meetings.length === 0);
    }, [meetings.length])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const recentMeetings = meetings.slice(0, 3);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Last 7 days of recorded hours, oldest → today, plus the week-over-week delta.
  const pulse = useMemo(() => {
    const dayMs = 86400000;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const hoursOnDay = (offset: number) => {
      const from = startOfToday.getTime() - offset * dayMs;
      const to = from + dayMs;
      const secs = meetings.reduce((acc, m) => {
        const t = new Date(m.date).getTime();
        return t >= from && t < to ? acc + (m.duration || 0) : acc;
      }, 0);
      return secs / 3600;
    };

    const days = Array.from({ length: 7 }, (_, i) => {
      const offset = 6 - i;
      const date = new Date(startOfToday.getTime() - offset * dayMs);
      return {
        hours: hoursOnDay(offset),
        initial: date.toLocaleDateString(undefined, { weekday: 'narrow' }),
        isToday: offset === 0,
      };
    });

    const thisWeek = days.reduce((a, d) => a + d.hours, 0);
    const prevWeek = Array.from({ length: 7 }, (_, i) => hoursOnDay(7 + i)).reduce((a, h) => a + h, 0);
    const delta = prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : null;

    return { days, peak: Math.max(...days.map(d => d.hours), 0.5), delta };
  }, [meetings]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <Aurora isDark={isDarkMode} variant="home" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {isLoading ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View>
                <Skeleton width={120} height={24} style={{ marginBottom: 8 }} />
                <Skeleton width={80} height={16} />
              </View>
              <Skeleton width={44} height={44} radius={22} />
            </View>
            <View style={styles.section}>
              <Skeleton width="100%" height={56} radius={22} />
            </View>
            <View style={styles.section}>
              <Skeleton width={140} height={20} style={{ marginBottom: 12 }} />
              <Skeleton width="100%" height={140} radius={24} />
            </View>
            <View style={styles.section}>
              <Skeleton width={140} height={20} style={{ marginBottom: 12 }} />
              <Skeleton width="100%" height={180} radius={24} />
            </View>
          </ScrollView>
        ) : (
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            scrollEventThrottle={16}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
          >
            {/* Header */}
            <View style={[styles.header, { marginBottom: 14 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: themeColors.textMuted, fontWeight: '700', fontSize: 12, letterSpacing: 0.3 }}>
                  {greeting} · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </Text>
                <Text style={[styles.greeting, { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginTop: 3 }]} numberOfLines={1}>
                  {user?.name?.split(' ')[0] || 'there'}
                </Text>
              </View>

              <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.8}>
                <LinearGradient
                  colors={themeColors.gradientPrimary as [string, string]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: themeColors.primary, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* 1 · NOW — the only time-sensitive thing on the screen */}
            {upcomingEvent && (
              <View style={styles.section}>
                <SectionHeader title="Up Next" />
                <TouchableOpacity onPress={handleOpenBriefing} disabled={loadingBriefing}>
                  <LinearGradient
                    colors={[themeColors.primary + '15', 'transparent']}
                    style={{ padding: 18, borderRadius: 24, borderWidth: 1, borderColor: themeColors.primary + '20' }}
                  >
                    <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: themeColors.primary, alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="calendar" size={22} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: '700' }}>{upcomingEvent.title}</Text>
                        <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 2 }}>
                          Commencing at {new Date(upcomingEvent.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                          <Feather name="zap" size={11} color={themeColors.primary} />
                          <Text style={{ color: themeColors.primary, fontSize: 11, fontWeight: '800' }}>Tap for AI briefing</Text>
                        </View>
                      </View>
                      {loadingBriefing
                        ? <ActivityIndicator size="small" color={themeColors.primary} />
                        : <Feather name="chevron-right" size={18} color={themeColors.textMuted} />}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* 2 · CAPTURE — the app's core job, both entry points together */}
            <View style={styles.section}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/record'); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: themeColors.textPrimary, borderRadius: 22, paddingVertical: 17 }}
              >
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: themeColors.danger, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="mic" size={15} color="#fff" />
                </View>
                <Text style={{ color: themeColors.bg, fontSize: 16, fontWeight: '800' }}>Start New Recording</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={pickAndUploadAudio}
                style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 22, paddingVertical: 15, borderWidth: 1, borderColor: themeColors.border, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}
              >
                <Feather name="upload" size={16} color={themeColors.textSecondary} />
                <Text style={{ color: themeColors.textSecondary, fontSize: 14, fontWeight: '700' }}>Import audio file</Text>
              </TouchableOpacity>
            </View>

            {/* 3 · ACT — what needs doing, pulled out of the tasks board */}
            {proactive && proactive.tasks.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="Priority Focus"
                  action={{ label: 'View Board', onPress: () => router.push('/(tabs)/tasks') }}
                />
                <GlassCard style={{ padding: 16, borderRadius: 24 }}>
                  {proactive.tasks.slice(0, 3).map((task, idx, arr) => (
                    <TouchableOpacity
                      key={task._id}
                      style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, idx !== arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: themeColors.border }]}
                      onPress={() => router.push(`/meeting/${task.meetingId}`)}
                    >
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: task.priority === 'high' ? themeColors.danger : themeColors.warning }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{task.title}</Text>
                        <Text style={{ color: themeColors.textMuted, fontSize: 11, marginTop: 2 }}>{task.meetingTitle}</Text>
                      </View>
                      <Feather name="arrow-right" size={14} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </GlassCard>
              </View>
            )}

            {/* 4 · ASK — the two ways to interrogate past meetings, side by side */}
            <View style={styles.section}>
              <SectionHeader title="Intelligence" />
              <GlassCard style={{ padding: 16, borderRadius: 24, backgroundColor: themeColors.bgCard }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: 14, paddingHorizontal: 16, color: themeColors.textPrimary, fontSize: 14, height: 48 }}
                    placeholder="Ask across all your meetings..."
                    placeholderTextColor={themeColors.textMuted}
                    value={hubQuestion}
                    onChangeText={setHubQuestion}
                    onSubmitEditing={handleAskHub}
                    returnKeyType="search"
                  />
                  <TouchableOpacity
                    onPress={handleAskHub}
                    disabled={isAskingHub}
                    style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: themeColors.primary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {isAskingHub ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Feather name="zap" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
                {hubAnswer && (
                  <View style={{ marginTop: 16, padding: 14, backgroundColor: themeColors.primary + '08', borderRadius: 16, borderLeftWidth: 3, borderLeftColor: themeColors.primary }}>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 14, lineHeight: 22 }}>{hubAnswer}</Text>
                    <TouchableOpacity onPress={() => setHubAnswer(null)} style={{ alignSelf: 'flex-end', marginTop: 10 }}>
                      <Text style={{ color: themeColors.textMuted, fontSize: 10, fontWeight: '800' }}>DISMISS</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Divider style={{ marginVertical: 16 }} />

                <TouchableOpacity onPress={() => router.push('/memory')} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: themeColors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="cpu" size={22} color={themeColors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 15, fontWeight: '700' }}>Memory</Text>
                    <Text style={{ color: themeColors.textMuted, fontSize: 12, marginTop: 2 }}>Timelines, open commitments & decision drift</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={themeColors.textMuted} />
                </TouchableOpacity>
              </GlassCard>
            </View>

            {/* 5 · REVIEW — retrospective stats, then the archive they summarize */}
            <View style={styles.section}>
              <SectionHeader title="This Week" />
              <LinearGradient
                colors={['#0A84FF', '#5B54E8']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ borderRadius: 28, padding: 20, overflow: 'hidden', shadowColor: '#0A84FF', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}
              >
                <View pointerEvents="none" style={{ position: 'absolute', top: -70, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.10)' }} />

                {/* Headline: hours focused, with week-over-week change */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', fontSize: 10, letterSpacing: 1.2 }}>HOURS FOCUSED</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 6 }}>
                      <Text style={{ color: '#fff', fontSize: 46, fontWeight: '800', letterSpacing: -2, lineHeight: 50 }}>{analytics?.summary.totalHours || '0.0'}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '700', marginBottom: 8 }}>this week</Text>
                    </View>
                  </View>
                  {pulse.delta !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, marginTop: 2 }}>
                      <Feather name={pulse.delta >= 0 ? 'trending-up' : 'trending-down'} size={12} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{Math.abs(pulse.delta)}%</Text>
                    </View>
                  )}
                </View>

                {/* Last 7 days — one bar per day, today called out */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 56 }}>
                  {pulse.days.map((d, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}>
                        <View
                          style={{
                            height: `${Math.max((d.hours / pulse.peak) * 100, 4)}%`,
                            borderRadius: 4,
                            backgroundColor: d.isToday ? '#fff' : 'rgba(255,255,255,0.35)',
                          }}
                        />
                      </View>
                      <Text style={{ color: d.isToday ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '800' }}>{d.initial}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 18, marginBottom: 14 }} />

                {/* Supporting counts */}
                <View style={{ flexDirection: 'row' }}>
                  {[
                    { label: 'Sessions', value: String(meetings.length) },
                    { label: 'Actions', value: String(analytics?.summary.totalTasks ?? 0) },
                    { label: 'Completed', value: `${analytics?.summary.completionRate || 0}%` },
                  ].map((s, i) => (
                    <View key={s.label} style={{ flex: 1, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: 'rgba(255,255,255,0.18)', paddingLeft: i === 0 ? 0 : 14 }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 19 }}>{s.value}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </View>

            <View style={[styles.section, { marginBottom: 30 }]}>
              <SectionHeader
                title="Recent Sessions"
                action={{ label: 'View All', onPress: () => router.push('/(tabs)/history') }}
              />
              {recentMeetings.length === 0 ? (
                <GlassCard style={{ padding: 32, alignItems: 'center', borderRadius: 24 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: themeColors.primary + '12', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="layers" size={26} color={themeColors.primary} />
                  </View>
                  <Text style={{ color: themeColors.textPrimary, marginTop: 14, fontSize: 15, fontWeight: '700' }}>No sessions yet</Text>
                  <Text style={{ color: themeColors.textMuted, marginTop: 4, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                    Record or import a meeting and it will show up here, summarized.
                  </Text>
                </GlassCard>
              ) : (
                recentMeetings.map((meeting) => {
                  const processing = meeting.status === 'processing';
                  const errored = meeting.status === 'error';
                  const accent = processing ? themeColors.warning : errored ? themeColors.danger : themeColors.primary;
                  return (
                    <GlassCard
                      key={meeting._id}
                      style={[styles.recentCard, { borderRadius: 20, padding: 14, borderLeftWidth: 3, borderLeftColor: accent }]}
                      onPress={() => router.push(`/meeting/${meeting._id}`)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: accent + '18', alignItems: 'center', justifyContent: 'center' }}>
                          <Feather
                            name={processing ? 'loader' : errored ? 'alert-circle' : 'file-text'}
                            size={18}
                            color={accent}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.recentTitle, { flex: 1, fontWeight: '700' }]} numberOfLines={1}>{meeting.title}</Text>
                            {processing
                              ? <Badge label="Processing" color={themeColors.warning} bg={themeColors.warning + '15'} />
                              : errored
                                ? <Badge label="Failed" color={themeColors.danger} bg={themeColors.danger + '15'} />
                                : <Feather name="chevron-right" size={16} color={themeColors.textMuted} />}
                          </View>

                          <Text style={styles.recentMeta}>
                            {new Date(meeting.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {Math.round((meeting.duration || 0) / 60)} min
                          </Text>

                          {meeting.status === 'ready' && !!meeting.summary && (
                            <Text style={{ color: themeColors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 }} numberOfLines={2}>
                              {meeting.summary}
                            </Text>
                          )}

                          {meeting.status === 'ready' && (
                            <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Feather name="check-square" size={12} color={themeColors.textMuted} />
                                <Text style={{ color: themeColors.textMuted, fontSize: 11, fontWeight: '700' }}>{meeting.tasks?.length || 0} tasks</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Feather name="zap" size={12} color={themeColors.textMuted} />
                                <Text style={{ color: themeColors.textMuted, fontSize: 11, fontWeight: '700' }}>{meeting.decisions?.length || 0} decisions</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    </GlassCard>
                  );
                })
              )}
            </View>

          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
