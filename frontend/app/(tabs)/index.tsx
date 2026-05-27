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
import { fetchMeetings, ApiMeeting, fetchAnalytics, AnalyticsData, askGlobal, API_BASE_URL, fetchProactiveInsights, ProactiveInsights } from '../../src/services/api';
import { getHomeStyles } from '../../src/styles/home.styles';
import LottieView from 'lottie-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut, isPremium } = useAuth();
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

  const loadData = async () => {
    setIsLoading(true);
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

  const handleAskHub = async () => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    if (!hubQuestion.trim()) return;
    setIsAskingHub(true);
    setHubAnswer(null);
    try {
      const answer = await askGlobal(hubQuestion.trim());
      setHubAnswer(answer);
    } catch (e: any) {
      Alert.alert('AI Hub Error', e.message);
    } finally {
      setIsAskingHub(false);
    }
  };

  const pickAndUploadAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (result.canceled || result.assets.length === 0) return;
      
      const file = result.assets[0];
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
      await fetch(API_BASE_URL, {
        method: 'POST',
        body: formData,
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      });
    } catch (e) {
      Alert.alert('Upload Error', 'Could not import audio file.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut }
    ]);
  };

  const recentMeetings = meetings.slice(0, 3);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
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
              <Skeleton width="100%" height={160} radius={24} />
            </View>
            <View style={styles.statsContainer}>
              <Skeleton width="30%" height={100} radius={20} />
              <Skeleton width="30%" height={100} radius={20} />
              <Skeleton width="30%" height={100} radius={20} />
            </View>
            <View style={styles.section}>
              <Skeleton width="100%" height={200} radius={24} />
            </View>
          </ScrollView>
        ) : (
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
          >
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] || 'User'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOffline ? '#FF3B30' : '#30D158' }} />
                  <Text style={[styles.subtitle, { color: isOffline ? '#FF3B30' : '#30D158', fontWeight: '800', fontSize: 10 }]}>{isOffline ? 'OFFLINE' : 'LIVE'}</Text>
                  <Text style={styles.subtitle}>• {meetings.length} recordings</Text>
                  {isPremium && <Badge label="PRO" color={themeColors.primary} bg={themeColors.primary + '15'} />}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity 
                  onPress={pickAndUploadAudio}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Feather name="upload" size={20} color={themeColors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.avatarContainer} onPress={handleLogout}>
                  <LinearGradient colors={themeColors.gradientAccent as any} style={styles.avatarGradient}>
                    <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Smart Proactive Section */}
            {isPremium && upcomingEvent && (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={styles.sectionTitle}>Up Next</Text>
                  <Badge label="Prep Mode" color={themeColors.success} bg={themeColors.success + '15'} />
                </View>
                <GlassCard style={{ padding: 18, borderColor: themeColors.success + '30', backgroundColor: themeColors.success + '05' }}>
                  <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: themeColors.success + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="calendar" size={22} color={themeColors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: '700' }}>{upcomingEvent.title}</Text>
                      <Text style={{ color: themeColors.textSecondary, fontSize: 13, marginTop: 2 }}>
                        Starts at {new Date(upcomingEvent.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  <Divider style={{ marginVertical: 15, opacity: 0.3 }} />
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    onPress={() => {
                      if (proactive?.lastMeeting) {
                        Alert.alert("Context from " + proactive.lastMeeting.title, proactive.lastMeeting.summary.slice(0, 200) + "...");
                      } else {
                        Alert.alert("No previous context", "We couldn't find a related previous meeting to prep you with.");
                      }
                    }}
                  >
                    <Feather name="zap" size={14} color={themeColors.success} />
                    <Text style={{ color: themeColors.success, fontWeight: '700', fontSize: 13 }}>BRIEF ME ON LAST SESSION</Text>
                  </TouchableOpacity>
                </GlassCard>
              </View>
            )}

            {/* Daily Action Plan */}
            {proactive && proactive.tasks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Daily Action Plan</Text>
                <GlassCard style={{ padding: 16, marginTop: 12 }}>
                  {proactive.tasks.map((task, idx) => (
                    <TouchableOpacity 
                      key={task._id} 
                      style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }, idx !== proactive.tasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: themeColors.border }]}
                      onPress={() => router.push(`/meeting/${task.meetingId}`)}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: task.priority === 'high' ? themeColors.danger : themeColors.warning }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{task.title}</Text>
                        <Text style={{ color: themeColors.textMuted, fontSize: 11, marginTop: 2 }}>{task.meetingTitle}</Text>
                      </View>
                      <Feather name="chevron-right" size={14} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </GlassCard>
              </View>
            )}

            {/* AI Hub Section */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>AI Hub</Text>
                <Badge label="Premium" color={themeColors.accent} bg={themeColors.accent + '15'} />
              </View>
              <GlassCard style={{ padding: 16 }}>
                <Text style={{ color: themeColors.textSecondary, fontSize: 13, marginBottom: 12 }}>Ask questions across all your recent meetings.</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput 
                    style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, color: themeColors.textPrimary, fontSize: 14, height: 44 }} 
                    placeholder="What was discussed about budget?" 
                    placeholderTextColor={themeColors.textMuted}
                    value={hubQuestion}
                    onChangeText={setHubQuestion}
                  />
                  <TouchableOpacity 
                    onPress={handleAskHub}
                    disabled={isAskingHub}
                    style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isPremium ? themeColors.primary : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                  >
                    {isAskingHub ? (
                      <LottieView source={{ uri: 'https://assets10.lottiefiles.com/packages/lf20_S69rU8.json' }} autoPlay loop style={{ width: 40, height: 40 }} />
                    ) : (
                      <Feather name={isPremium ? "zap" : "lock"} size={20} color={isPremium ? "#fff" : themeColors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
                {hubAnswer && (
                  <View style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 14, lineHeight: 20 }}>{hubAnswer}</Text>
                    <TouchableOpacity onPress={() => setHubAnswer(null)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                      <Text style={{ color: themeColors.textMuted, fontSize: 11, fontWeight: '700' }}>DISMISS</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </GlassCard>
            </View>

            {/* Stats Grid */}
            <View style={styles.section}>
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
                    <Feather name="mic" size={18} color={themeColors.primary} />
                  </View>
                  <Text style={styles.statValue}>{analytics?.summary.totalMeetings || 0}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(48,209,88,0.1)' }]}>
                    <Feather name="check-square" size={18} color={themeColors.success} />
                  </View>
                  <Text style={styles.statValue}>{analytics?.summary.totalTasks || 0}</Text>
                  <Text style={styles.statLabel}>Tasks</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(255,159,10,0.1)' }]}>
                    <Feather name="clock" size={18} color={themeColors.warning} />
                  </View>
                  <Text style={styles.statValue}>{analytics?.summary.totalHours || '0.0'}h</Text>
                  <Text style={styles.statLabel}>Hours</Text>
                </View>
              </View>
            </View>

            {/* Analytics Dashboard */}
            <View style={styles.section}>
              <View style={styles.analyticsCard}>
                <Text style={styles.analyticsTitle}>Meeting Insights</Text>
                
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>Task Completion</Text>
                  <Text style={styles.progressValue}>{analytics?.summary.completionRate || 0}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${analytics?.summary.completionRate || 0}%` }
                    ]} 
                  />
                </View>

                <Text style={[styles.progressLabel, { marginBottom: 12 }]}>Top Topics</Text>
                <View style={styles.topicRow}>
                  {analytics?.topTags.map(tag => (
                    <View key={tag.name} style={styles.topicChip}>
                      <Text style={styles.topicName}>{tag.name}</Text>
                      <Text style={styles.topicCount}>{tag.count}</Text>
                    </View>
                  ))}
                  {(!analytics?.topTags || analytics.topTags.length === 0) && (
                    <Text style={{ color: themeColors.textMuted, fontSize: 12 }}>Record more sessions to see trends</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Recent Feed */}
            <View style={styles.section}>
              <SectionHeader 
                title="Recent Sessions" 
                action={{ label: 'View All', onPress: () => router.push('/(tabs)/history') }} 
              />
              {recentMeetings.length === 0 ? (
                <GlassCard style={{ padding: 40, alignItems: 'center' }}>
                  <Feather name="file-text" size={32} color={themeColors.textMuted} />
                  <Text style={{ color: themeColors.textMuted, marginTop: 12 }}>No recordings yet</Text>
                </GlassCard>
              ) : (
                recentMeetings.map((meeting) => (
                  <GlassCard 
                    key={meeting._id} 
                    style={styles.recentCard}
                    onPress={() => router.push(`/meeting/${meeting._id}`)}
                  >
                    <View style={styles.recentHeader}>
                      <View style={styles.recentIcon}>
                        <Feather 
                          name={meeting.status === 'processing' ? 'refresh-cw' : 'file-text'} 
                          size={20} 
                          color={meeting.status === 'processing' ? themeColors.warning : themeColors.primaryLight} 
                        />
                      </View>
                      <View style={styles.recentInfo}>
                        <Text style={styles.recentTitle} numberOfLines={1}>{meeting.title}</Text>
                        <Text style={styles.recentMeta}>
                          {new Date(meeting.date).toLocaleDateString()} • {Math.round(meeting.duration / 60)} min
                        </Text>
                      </View>
                      {meeting.status === 'processing' && (
                        <Badge label="Processing" color={themeColors.warning} bg={themeColors.warning + '15'} />
                      )}
                    </View>
                  </GlassCard>
                ))
              )}
            </View>

            {/* Pro Tip */}
            <View style={styles.section}>
              <LinearGradient 
                colors={isDarkMode ? ['#1C1C1E', '#000'] : ['#E5E5EA', '#FFFFFF']} 
                style={styles.tipCard}
                start={{x:0, y:0}} end={{x:1, y:1}}
              >
                <View style={[styles.tipIcon, { backgroundColor: themeColors.primary + '15' }]}>
                  <Feather name="zap" size={24} color={themeColors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tipTitle, { color: themeColors.textPrimary }]}>Smart Export</Text>
                  <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>
                    Sync your tasks directly to your calendar or Notion workspace.
                  </Text>
                </View>
              </LinearGradient>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
