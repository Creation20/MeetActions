import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Linking, Share as RNShare, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radii, Spacing, Shadow } from '../../src/constants/theme';
import { GlassCard, Badge } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { fetchAnalytics, AnalyticsData, deleteAccount, API_HOST } from '../../src/services/api';
import { getSettingsStyles } from '../../src/styles/settings.styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

type ModalType = 'profile' | 'usage' | 'privacy' | 'faq' | 'about' | 'feedback' | 'sync' | null;

export default function SettingsScreen() {
  const [autoSummary, setAutoSummary] = React.useState(true);
  const [notifications, setNotifications] = React.useState(false);
  const [calendarSync, setCalendarSync] = React.useState(false);
  
  // Webhook URLs
  const [slackWebhook, setSlackWebhook] = React.useState('');
  const [notionWebhook, setNotionWebhook] = React.useState('');
  const [trelloWebhook, setTrelloWebhook] = React.useState('');
  
  const { user, signOut, isPremium } = useAuth();
  const { isDarkMode, colors: themeColors, toggleTheme } = useTheme();
  const styles = React.useMemo(() => getSettingsStyles(isDarkMode), [isDarkMode]);
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [activeModal, setActiveModal] = React.useState<ModalType>(null);
  const router = useRouter();
  
  // Feedback State
  const [feedback, setFeedback] = React.useState('');
  const [isSendingFeedback, setIsSendingFeedback] = React.useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Permanently Delete Account?',
      'This will erase all your recordings, projects, and profile data. This action is irreversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Forever', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteAccount();
              signOut();
              router.replace('/(auth)/login');
            } catch (e: any) {
              Alert.alert('Error', 'Could not delete account. Please try again later.');
            }
          } 
        }
      ]
    );
  };

  React.useEffect(() => {
    loadSettings();
    loadAnalytics();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('user_settings');
      if (stored) {
        const s = JSON.parse(stored);
        setAutoSummary(s.autoSummary ?? true);
        setNotifications(s.notifications ?? false);
        setCalendarSync(s.calendarSync ?? false);
        setSlackWebhook(s.slackWebhook || '');
        setNotionWebhook(s.notionWebhook || '');
        setTrelloWebhook(s.trelloWebhook || '');
      }
    } catch (e) {}
  };

  const loadAnalytics = async () => {
    try {
      const data = await fetchAnalytics();
      setAnalytics(data);
    } catch (e) {}
  };

  const saveSettings = async (updates: any) => {
    try {
      const current = await AsyncStorage.getItem('user_settings');
      const updated = { ...(current ? JSON.parse(current) : {}), ...updates };
      await AsyncStorage.setItem('user_settings', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleToggleAutoSummary = (v: boolean) => {
    setAutoSummary(v);
    saveSettings({ autoSummary: v });
  };

  const handleToggleNotifications = (v: boolean) => {
    setNotifications(v);
    saveSettings({ notifications: v });
  };

  const handleToggleCalendar = (v: boolean) => {
    setCalendarSync(v);
    saveSettings({ calendarSync: v });
  };

  const handleSendFeedback = async () => {
    if (!feedback.trim()) return;
    setIsSendingFeedback(true);
    // Simulate API call
    setTimeout(() => {
      setIsSendingFeedback(false);
      setFeedback('');
      Alert.alert('Thank You', 'Your feedback has been sent to our team.');
      setActiveModal(null);
    }, 1500);
  };

  const SettingItem = React.useCallback(({ icon, title, subtitle, type = 'link', value, onValueChange, onPress }: any) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress} 
      disabled={type === 'toggle'}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        <Feather name={icon} size={18} color={themeColors.primary} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {type === 'toggle' ? (
        <Switch 
          value={value} 
          onValueChange={onValueChange}
          trackColor={{ false: isDarkMode ? '#333333' : '#E5E5EA', true: themeColors.primary }}
          thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
          ios_backgroundColor={isDarkMode ? '#333333' : '#E5E5EA'}
        />
      ) : (
        <Feather name="chevron-right" size={18} color={themeColors.textMuted} />
      )}
    </TouchableOpacity>
  ), [isDarkMode, themeColors, styles]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Subscription Card */}
          <LinearGradient
            colors={isPremium ? themeColors.gradientPrimary as any : (isDarkMode ? ['#1C1C1E', '#1C1C1E'] : ['#E5E5EA', '#E5E5EA'])}
            style={styles.subCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.subTitle, { color: isPremium || isDarkMode ? '#fff' : '#000' }]}>{isPremium ? 'MeetActions Pro active' : 'MeetActions Free'}</Text>
              <Text style={[styles.subText, { color: isPremium || isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)' }]}>
                {isPremium 
                  ? 'You have unlimited access to all AI features.' 
                  : 'Upgrade to unlock AI Chat, PDF Export, and more.'}
              </Text>
              {!isPremium && (
                <TouchableOpacity style={[styles.upgradeBtn, { backgroundColor: isDarkMode ? '#fff' : themeColors.primary }]} onPress={() => router.push('/paywall')}>
                  <Text style={[styles.upgradeText, { color: isDarkMode ? themeColors.primary : '#fff' }]}>Upgrade Now</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.subIconWrap, { backgroundColor: isPremium || isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)' }]}>
              <Feather name="star" size={32} color={isPremium || isDarkMode ? '#fff' : themeColors.textMuted} />
            </View>
          </LinearGradient>

          <Text style={styles.sectionTitle}>Preferences</Text>
          <GlassCard style={styles.card}>
            <SettingItem icon="moon" title="Dark Mode" subtitle="Adjust the app's appearance" type="toggle" value={isDarkMode} onValueChange={toggleTheme} />
            <View style={styles.divider} />
            <SettingItem icon="zap" title="Auto-Generate Summaries" subtitle="Process recordings automatically" type="toggle" value={autoSummary} onValueChange={handleToggleAutoSummary} />
            <View style={styles.divider} />
            <SettingItem icon="calendar" title="Calendar Sync" subtitle="Add due dates to calendar" type="toggle" value={calendarSync} onValueChange={handleToggleCalendar} />
            <View style={styles.divider} />
            <SettingItem icon="bell" title="Task Reminders" type="toggle" value={notifications} onValueChange={handleToggleNotifications} />
          </GlassCard>

          <Text style={styles.sectionTitle}>Integrations</Text>
          <GlassCard style={styles.card}>
            <View style={styles.settingItem}>
              <View style={[styles.iconWrap, { backgroundColor: '#4A154B15', borderColor: '#4A154B30' }]}><Feather name="slack" size={18} color="#4A154B" /></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Slack Webhook</Text>
                <TextInput 
                  style={styles.webhookInput} 
                  value={slackWebhook} 
                  onChangeText={(v) => { setSlackWebhook(v); saveSettings({ slackWebhook: v }); }} 
                  placeholder="https://hooks.slack.com/..." 
                  placeholderTextColor={themeColors.textMuted}
                />
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <View style={[styles.iconWrap, { backgroundColor: '#00000015', borderColor: '#00000030' }]}><Feather name="book-open" size={18} color="#000" /></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Notion Webhook</Text>
                <TextInput 
                  style={styles.webhookInput} 
                  value={notionWebhook} 
                  onChangeText={(v) => { setNotionWebhook(v); saveSettings({ notionWebhook: v }); }} 
                  placeholder="Enter endpoint URL..." 
                  placeholderTextColor={themeColors.textMuted}
                />
              </View>
            </View>
          </GlassCard>

          <Text style={styles.sectionTitle}>Account</Text>
          <GlassCard style={styles.card}>
            <SettingItem icon="user" title="Profile" subtitle={`${user?.name} • ${user?.email}`} type="link" onPress={() => setActiveModal('profile')} />
            <View style={styles.divider} />
            <SettingItem icon="pie-chart" title="Usage Statistics" subtitle={`${analytics?.summary.totalMeetings || 0} Recordings • ${analytics?.summary.totalTasks || 0} Action Items`} type="link" onPress={() => setActiveModal('usage')} />
            <View style={styles.divider} />
            <SettingItem icon="cloud" title="Backup & Sync" subtitle="Last synced: Today 10:45 AM" type="link" onPress={() => setActiveModal('sync')} />
          </GlassCard>

          <Text style={styles.sectionTitle}>Support</Text>
          <GlassCard style={styles.card}>
            <SettingItem icon="help-circle" title="Help Center & FAQ" type="link" onPress={() => setActiveModal('faq')} />
            <View style={styles.divider} />
            <SettingItem icon="message-square" title="Send Feedback" type="link" onPress={() => setActiveModal('feedback')} />
            <View style={styles.divider} />
            <SettingItem icon="shield" title="Privacy Policy" type="link" onPress={() => setActiveModal('privacy')} />
          </GlassCard>

          <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <GlassCard style={[styles.card, { borderColor: '#FF3B3030' }]}>
            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomWidth: 0 }]} 
              onPress={handleDeleteAccount}
            >
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
                <Feather name="trash-2" size={18} color="#FF3B30" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: '#FF3B30' }]}>Delete Account</Text>
                <Text style={styles.settingSubtitle}>Permanently remove all your data.</Text>
              </View>
            </TouchableOpacity>
          </GlassCard>

          <Text style={styles.version}>MeetActions v1.0.0</Text>
        </ScrollView>
      </SafeAreaView>

      {/* Modals */}
      <Modal visible={!!activeModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity 
            style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.4)' }]} 
            activeOpacity={1} 
            onPress={() => setActiveModal(null)}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                <TouchableOpacity style={styles.modalCloseIcon} onPress={() => setActiveModal(null)}>
                  <Feather name="x" size={20} color={themeColors.textPrimary} />
                </TouchableOpacity>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {activeModal === 'profile' && (
                <View>
                  <Text style={styles.modalTitle}>User Profile</Text>
                  <View style={{ alignItems: 'center', marginBottom: 30 }}>
                    <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: themeColors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: themeColors.primary }}>
                      <Text style={{ fontSize: 40, fontWeight: 'bold', color: themeColors.textPrimary }}>{user?.name?.charAt(0)}</Text>
                    </View>
                  </View>
                  <View style={{ gap: 20 }}>
                    <View><Text style={{ color: themeColors.textMuted, fontSize: 12, marginBottom: 8, fontWeight: 'bold' }}>FULL NAME</Text><Text style={{ color: themeColors.textPrimary, fontSize: 18 }}>{user?.name}</Text></View>
                    <View><Text style={{ color: themeColors.textMuted, fontSize: 12, marginBottom: 8, fontWeight: 'bold' }}>EMAIL ADDRESS</Text><Text style={{ color: themeColors.textPrimary, fontSize: 18 }}>{user?.email}</Text></View>
                    <View><Text style={{ color: themeColors.textMuted, fontSize: 12, marginBottom: 8, fontWeight: 'bold' }}>MEMBER SINCE</Text><Text style={{ color: themeColors.textPrimary, fontSize: 18 }}>May 2026</Text></View>
                  </View>
                </View>
              )}

              {activeModal === 'usage' && analytics && (
                <View>
                  <Text style={styles.modalTitle}>Usage Statistics</Text>
                  <View style={{ gap: 16 }}>
                    <View style={styles.usageItem}><Text style={styles.usageLabel}>Recording Hours</Text><Text style={styles.usageValue}>{analytics.summary.totalHours}h</Text></View>
                    <View style={styles.usageItem}><Text style={styles.usageLabel}>Tasks Extracted</Text><Text style={styles.usageValue}>{analytics.summary.totalTasks}</Text></View>
                    <View style={styles.usageItem}><Text style={styles.usageLabel}>Completion Rate</Text><Text style={styles.usageValue}>{analytics.summary.completionRate}%</Text></View>
                  </View>
                </View>
              )}

              {activeModal === 'feedback' && (
                <View>
                  <Text style={styles.modalTitle}>Send Feedback</Text>
                  <Text style={{ color: themeColors.textSecondary, marginBottom: 20 }}>How can we improve MeetActions for you?</Text>
                  <TextInput 
                    style={[styles.modalInput, { height: 150, textAlignVertical: 'top' }]} 
                    multiline 
                    value={feedback}
                    onChangeText={setFeedback}
                    placeholder="Your suggestions or bug reports..."
                    placeholderTextColor={themeColors.textMuted}
                  />
                  <TouchableOpacity 
                    style={[styles.modalBtnSave, { width: '100%' }]} 
                    onPress={handleSendFeedback}
                    disabled={isSendingFeedback}
                  >
                    {isSendingFeedback ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnTextSave}>Submit Feedback</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {activeModal === 'sync' && (
                <View>
                  <View style={{ alignItems: 'center' }}>
                    <View style={[styles.modalIconWrap, { backgroundColor: 'rgba(0,122,255,0.1)' }]}><Feather name="upload-cloud" size={24} color={themeColors.primary} /></View>
                    <Text style={styles.modalTitle}>Cloud Center</Text>
                    <Text style={styles.modalSubtitle}>Real-time backup and synchronization.</Text>
                  </View>
                  
                  <View style={styles.syncStatusCard}>
                    <Feather name="check-circle" size={20} color={themeColors.success} />
                    <Text style={styles.syncStatusText}>Cloud Database Active</Text>
                  </View>

                  <View style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderRadius: 16, padding: 16, gap: 12, marginTop: 10 }}>
                    <Text style={{ color: themeColors.textPrimary, fontWeight: '800', fontSize: 13, marginBottom: 4 }}>TECHNICAL DIAGNOSTICS</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: themeColors.textSecondary }}>Backend Status</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: themeColors.success }} />
                        <Text style={{ color: themeColors.success, fontWeight: '700' }}>Connected</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: themeColors.textSecondary }}>API Host</Text>
                      <Text style={{ color: themeColors.textPrimary, fontSize: 10 }}>{API_HOST}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: themeColors.textSecondary }}>AI Engine</Text>
                      <Text style={{ color: themeColors.textPrimary, fontWeight: '600' }}>Gemini 2.5 Flash</Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  </Modal>
</View>
  );
}
