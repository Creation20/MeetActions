import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FontSize, FontWeight, Spacing } from '../src/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { GlassCard, GradientButton } from '../src/components/ui';

export default function PaywallScreen() {
  const router = useRouter();
  const { setPremiumStatus } = useAuth();
  const { isDarkMode, colors: themeColors } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    // Simulate payment processing
    setTimeout(async () => {
      await setPremiumStatus(true);
      setLoading(false);
      Alert.alert(
        "Welcome to Pro!",
        "Your subscription was successful. All premium features are now unlocked.",
        [{ text: "Awesome", onPress: () => router.back() }]
      );
    }, 2000);
  };

  const features = [
    { icon: 'zap', text: 'Global AI Hub (Cross-meeting search)' },
    { icon: 'message-circle', text: 'Interactive Meeting Chat' },
    { icon: 'camera', text: 'Whiteboard & Photo Capture' },
    { icon: 'file-text', text: 'Professional PDF Reports' },
    { icon: 'calendar', text: 'Smart Follow-up Scheduling' },
    { icon: 'globe', text: 'Multi-language Translation' },
    { icon: 'share-2', text: 'Slack & Notion Integrations' },
    { icon: 'activity', text: 'Tone & Conflict Detection' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <LinearGradient colors={isDarkMode ? ['#1a0a2e', '#000'] : ['#F2F2F7', '#FFFFFF']} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={[styles.closeBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} 
            onPress={() => router.back()}
          >
            <Feather name="x" size={24} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>MeetActions Pro</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <LinearGradient colors={themeColors.gradientPrimary as any} style={styles.proIcon}>
              <Feather name="star" size={40} color="#fff" />
            </LinearGradient>
            <Text style={[styles.heroTitle, { color: themeColors.textPrimary }]}>Unlock Your Productivity</Text>
            <Text style={[styles.heroSubtitle, { color: themeColors.textSecondary }]}>Get the most out of your meetings with enterprise-grade AI tools.</Text>
          </View>

          <View style={featureStyles.featureList}>
            {features.map((f, i) => (
              <View key={i} style={[featureStyles.featureItem, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={[featureStyles.featureIconWrap, { backgroundColor: themeColors.primary + '15' }]}>
                  <Feather name={f.icon as any} size={16} color={themeColors.primary} />
                </View>
                <Text style={[featureStyles.featureText, { color: themeColors.textPrimary }]}>{f.text}</Text>
                <Feather name="check" size={16} color={themeColors.success} />
              </View>
            ))}
          </View>

          <View style={planStyles.plans}>
            <TouchableOpacity 
              style={[
                planStyles.planCard, 
                { backgroundColor: themeColors.bgCard },
                selectedPlan === 'monthly' && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '05' }
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <View style={planStyles.planInfo}>
                <Text style={[planStyles.planName, { color: themeColors.textPrimary }]}>Monthly</Text>
                <Text style={[planStyles.planPrice, { color: themeColors.textPrimary }]}>$9.99<Text style={planStyles.planPeriod}>/mo</Text></Text>
              </View>
              <View style={[planStyles.radio, { borderColor: themeColors.border }, selectedPlan === 'monthly' && { borderColor: themeColors.primary, backgroundColor: themeColors.primary, borderWidth: 6 }]} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                planStyles.planCard, 
                { backgroundColor: themeColors.bgCard },
                selectedPlan === 'yearly' && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '05' }
              ]}
              onPress={() => setSelectedPlan('yearly')}
            >
              <View style={planStyles.planInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[planStyles.planName, { color: themeColors.textPrimary }]}>Yearly</Text>
                  <View style={[planStyles.saveBadge, { backgroundColor: themeColors.success }]}>
                    <Text style={planStyles.saveText}>SAVE 20%</Text>
                  </View>
                </View>
                <Text style={[planStyles.planPrice, { color: themeColors.textPrimary }]}>$79.99<Text style={planStyles.planPeriod}>/yr</Text></Text>
              </View>
              <View style={[planStyles.radio, { borderColor: themeColors.border }, selectedPlan === 'yearly' && { borderColor: themeColors.primary, backgroundColor: themeColors.primary, borderWidth: 6 }]} />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 20 }}>
            <GradientButton 
              label={loading ? "" : "Unlock MeetActions Pro"} 
              onPress={handleSubscribe}
              size="lg"
              colors={themeColors.gradientPrimary}
              disabled={loading}
              icon={loading ? <ActivityIndicator color="#fff" /> : <Feather name="zap" size={20} color="#fff" />}
            />
            <Text style={[styles.footerNote, { color: themeColors.textMuted }]}>Recurring billing. Cancel anytime.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, justifyContent: 'center' },
  closeBtn: { position: 'absolute', left: Spacing.lg, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 60 },
  hero: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  proIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heroTitle: { fontSize: 28, fontWeight: FontWeight.extrabold, textAlign: 'center', marginBottom: 10 },
  heroSubtitle: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
  footerNote: { textAlign: 'center', fontSize: 12, marginTop: 15 },
});

const featureStyles = StyleSheet.create({
  featureList: { gap: 12, marginBottom: 40 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  featureIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 14, fontWeight: '500' },
});

const planStyles = StyleSheet.create({
  plans: { gap: 12, marginBottom: 30 },
  planCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  planInfo: { gap: 4 },
  planName: { fontSize: 16, fontWeight: 'bold' },
  planPrice: { fontSize: 22, fontWeight: FontWeight.extrabold },
  planPeriod: { fontSize: 14, color: '#8E8E93', fontWeight: 'normal' },
  saveBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  saveText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
});
