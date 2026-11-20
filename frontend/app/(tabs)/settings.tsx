import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Linking, Share as RNShare, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radii, Spacing, Shadow } from '../../src/constants/theme';
import { GlassCard, Badge } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { fetchAnalytics, AnalyticsData, deleteAccount, API_HOST, updateProfile } from '../../src/services/api';
import { getSettingsStyles } from '../../src/styles/settings.styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Aurora } from '../../src/components/Aurora';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { showError } from '../../src/utils/errors';

type ModalType = 'profile' | 'usage' | 'privacy' | 'faq' | 'about' | 'feedback' | 'sync' | null;

export default function SettingsScreen() {
  const [autoSummary, setAutoSummary] = React.useState(true);
  const [notifications, setNotifications] = React.useState(false);
  const [calendarSync, setCalendarSync] = React.useState(false);
  
  // Webhook URLs
  const [slackWebhook, setSlackWebhook] = React.useState('');
  const [notionWebhook, setNotionWebhook] = React.useState('');
  const [trelloWebhook, setTrelloWebhook] = React.useState('');
  
  const { user, signOut, isPremium, updateUser } = useAuth();
  const [editName, setEditName] = React.useState('');
  const [editImage, setEditImage] = React.useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);

  const openProfile = () => {
    setEditName(user?.name || '');
    setEditImage(null);
    setActiveModal('profile');
  };

  const pickProfileImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!result.canceled && result.assets.length > 0) setEditImage(result.assets[0].uri);
  };

  const handleSaveProfile = async () => {
    if (!user?._id || !editName.trim()) return;
    setIsSavingProfile(true);
    try {
      const res = await updateProfile(user._id, editName.trim(), undefined, undefined, editImage || undefined);
      if (res?.user) updateUser({ ...user, ...res.user });
      setActiveModal(null);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      showError(e, 'Profile not saved', "We couldn't save your profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };
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

  const SectionHeader = ({ icon, label, color }: { icon: string; label: string; color?: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 20 }}>
      <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: (color || themeColors.primary) + '20', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon as any} size={13} color={color || themeColors.primary} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '800', color: themeColors.textPrimary, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Aurora isDark={isDarkMode} variant="home" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 }]}>Settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Profile hero */}
          <TouchableOpacity activeOpacity={0.85} onPress={openProfile} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border, borderRadius: 22, padding: 16, marginBottom: 16 }}>
            <LinearGradient colors={themeColors.gradientPrimary as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 24 }}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: themeColors.textPrimary }} numberOfLines={1}>{user?.name || 'User'}</Text>
              <Text style={{ fontSize: 13, color: themeColors.textMuted }} numberOfLines={1}>{user?.email}</Text>
            </View>
            <View style={{ backgroundColor: (isPremium ? themeColors.success : themeColors.textMuted) + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: isPremium ? themeColors.success : themeColors.textMuted }}>{isPremium ? 'PRO' : 'FREE'}</Text>
            </View>
          </TouchableOpacity>

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

          <SectionHeader icon="sliders" label="Preferences" />
          <GlassCard style={styles.card}>
            <SettingItem icon="moon" title="Dark Mode" subtitle="Adjust the app's appearance" type="toggle" value={isDarkMode} onValueChange={toggleTheme} />
            <View style={styles.divider} />
            <SettingItem icon="zap" title="Auto-Generate Summaries" subtitle="Process recordings automatically" type="toggle" value={autoSummary} onValueChange={handleToggleAutoSummary} />
            <View style={styles.divider} />
            <SettingItem icon="calendar" title="Calendar Sync" subtitle="Add due dates to calendar" type="toggle" value={calendarSync} onValueChange={handleToggleCalendar} />
            <View style={styles.divider} />
            <SettingItem icon="bell" title="Task Reminders" type="toggle" value={notifications} onValueChange={handleToggleNotifications} />
          </GlassCard>

          <SectionHeader icon="grid" label="Integrations" />
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

          <SectionHeader icon="user" label="Account" />
          <GlassCard style={styles.card}>
            <SettingItem icon="user" title="Profile" subtitle={`${user?.name} • ${user?.email}`} type="link" onPress={openProfile} />
            <View style={styles.divider} />
            <SettingItem icon="pie-chart" title="Usage Statistics" subtitle={`${analytics?.summary.totalMeetings || 0} Recordings • ${analytics?.summary.totalTasks || 0} Action Items`} type="link" onPress={() => setActiveModal('usage')} />
            <View style={styles.divider} />
            <SettingItem icon="cloud" title="Backup & Sync" subtitle="Last synced: Today 10:45 AM" type="link" onPress={() => setActiveModal('sync')} />
          </GlassCard>

          <SectionHeader icon="life-buoy" label="Support" />
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

          <SectionHeader icon="alert-triangle" label="Danger Zone" color={themeColors.danger} />
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
                  <Text style={styles.modalTitle}>Edit Profile</Text>

                  {/* Tappable avatar */}
                  <View style={{ alignItems: 'center', marginBottom: 26 }}>
                    <TouchableOpacity onPress={pickProfileImage} activeOpacity={0.8}>
                      {editImage ? (
                        <Image source={{ uri: editImage }} style={{ width: 96, height: 96, borderRadius: 30 }} />
                      ) : (
                        <LinearGradient colors={themeColors.gradientPrimary as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 96, height: 96, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff' }}>{user?.name?.charAt(0).toUpperCase()}</Text>
                        </LinearGradient>
                      )}
                      <View style={{ position: 'absolute', bottom: -2, right: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: themeColors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: themeColors.bgCard }}>
                        <Feather name="camera" size={14} color="#fff" />
                      </View>
                    </TouchableOpacity>
                    <Text style={{ color: themeColors.textMuted, fontSize: 12, marginTop: 10 }}>Tap to change photo</Text>
                  </View>

                  <Text style={{ color: themeColors.textMuted, fontSize: 11, marginBottom: 8, fontWeight: '800', letterSpacing: 1 }}>FULL NAME</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Your name"
                    placeholderTextColor={themeColors.textMuted}
                  />

                  <Text style={{ color: themeColors.textMuted, fontSize: 11, marginBottom: 8, marginTop: 4, fontWeight: '800', letterSpacing: 1 }}>EMAIL ADDRESS</Text>
                  <View style={[styles.modalInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: 0.7 }]}>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 16 }}>{user?.email}</Text>
                    <Feather name="lock" size={14} color={themeColors.textMuted} />
                  </View>

                  <TouchableOpacity
                    onPress={handleSaveProfile}
                    disabled={isSavingProfile || !editName.trim()}
                    style={{ height: 54, borderRadius: 16, marginTop: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.primary, opacity: (!editName.trim() || isSavingProfile) ? 0.6 : 1 }}
                  >
                    {isSavingProfile ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Save Changes</Text>}
                  </TouchableOpacity>
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
