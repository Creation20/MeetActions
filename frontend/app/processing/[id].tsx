import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '../../src/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { GlassCard } from '../../src/components/ui';
import { fetchMeetingById } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const STAGES = [
  { title: 'Neural Transcription', sub: 'Converting audio to high-fidelity text' },
  { title: 'Speaker Diarization', sub: 'Identifying unique voices and personas' },
  { title: 'Semantic Extraction', sub: 'Distilling decisions and action items' },
  { title: 'Intelligence Synthesis', sub: 'Generating final executive summary' }
];

export default function ProcessingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isDarkMode, colors: themeColors } = useTheme();
  const [currentStage, setCurrentStage] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Cosmetic stage stepper — advances through the stages and holds on the last
    // one until the backend genuinely reports the meeting as ready/error.
    const stageInterval = setInterval(() => {
      setCurrentStage(prev => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 2600);

    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // ── Real status polling ──────────────────────────────────────────────────
    let cancelled = false;
    let targetId: string | null = id && id !== 'pending' ? String(id) : null;
    const startedAt = Date.now();
    const MAX_WAIT = 4 * 60 * 1000; // give up after 4 minutes

    const poll = async () => {
      if (cancelled) return;
      try {
        // For uploads we don't yet know the id — the upload flow stashes it here.
        if (!targetId) {
          const stored = await AsyncStorage.getItem('@last_upload_id');
          if (stored) targetId = stored;
        }
        if (targetId) {
          const m = await fetchMeetingById(targetId).catch(() => null);
          if (!cancelled && m && (m.status === 'ready' || m.status === 'error')) {
            await AsyncStorage.removeItem('@last_upload_id').catch(() => {});
            cancelled = true;
            router.replace(`/meeting/${targetId}`);
            return;
          }
        }
      } catch { /* keep polling */ }

      if (!cancelled) {
        if (Date.now() - startedAt > MAX_WAIT) {
          cancelled = true;
          router.replace('/(tabs)/history');
        } else {
          pollTimer = setTimeout(poll, 3000);
        }
      }
    };
    let pollTimer: any = setTimeout(poll, 2500);

    return () => {
      cancelled = true;
      clearInterval(stageInterval);
      clearTimeout(pollTimer);
    };
  }, [id]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      {/* Dynamic Background Elements */}
      <LinearGradient 
        colors={isDarkMode ? ['#050508', '#0f0720', '#050508'] : ['#FFFFFF', '#F0F4FF', '#FFFFFF']} 
        style={StyleSheet.absoluteFill} 
      />
      
      {/* Animated Orbs */}
      <Animated.View style={[
        styles.orb, 
        { 
          backgroundColor: themeColors.primary, 
          top: height * 0.1, 
          left: -width * 0.2, 
          opacity: isDarkMode ? 0.15 : 0.08,
          transform: [{ scale: pulseAnim }]
        }
      ]} />
      <Animated.View style={[
        styles.orb, 
        { 
          backgroundColor: themeColors.warning, 
          bottom: height * 0.2, 
          right: -width * 0.3, 
          opacity: isDarkMode ? 0.1 : 0.05,
          transform: [{ scale: pulseAnim }]
        }
      ]} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.replace('/(tabs)/history')}
            style={[styles.closeBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
          >
            <Feather name="x" size={20} color={themeColors.textMuted} />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Main Visualizer */}
          <View style={styles.visualizerContainer}>
            <Animated.View style={[styles.ring, { borderColor: themeColors.primary + '30', transform: [{ rotate: rotation }] }]}>
              <View style={[styles.ringDot, { backgroundColor: themeColors.primary }]} />
            </Animated.View>
            <Animated.View style={[styles.ring, { width: 140, height: 140, borderColor: themeColors.warning + '20', transform: [{ rotate: '-120deg' }] }]} />
            
            <View style={styles.lottieWrap}>
              <LottieView 
                source={{ uri: 'https://assets2.lottiefiles.com/packages/lf20_S69rpk.json' }} 
                autoPlay 
                loop 
                style={styles.lottie}
              />
            </View>
          </View>
          
          <View style={styles.textCenter}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>Processing Intelligence</Text>
            <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
              Groq LPU™ Engine is distilling your meeting into actionable insights.
            </Text>
          </View>

          {/* Stepper Pipeline */}
          <View style={styles.stepperContainer}>
            {STAGES.map((stage, index) => {
              const isActive = index === currentStage;
              const isCompleted = index < currentStage;
              
              return (
                <View key={index} style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View style={[
                      styles.stepCircle, 
                      { borderColor: isCompleted ? themeColors.success : isActive ? themeColors.primary : themeColors.border },
                      isActive && { backgroundColor: themeColors.primary + '10' }
                    ]}>
                      {isCompleted ? (
                        <Feather name="check" size={14} color={themeColors.success} />
                      ) : (
                        <Text style={{ fontSize: 12, fontWeight: '800', color: isActive ? themeColors.primary : themeColors.textMuted }}>{index + 1}</Text>
                      )}
                    </View>
                    {index < STAGES.length - 1 && (
                      <View style={[styles.stepLine, { backgroundColor: isCompleted ? themeColors.success : themeColors.border }]} />
                    )}
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[
                      styles.stepTitle, 
                      { color: isActive || isCompleted ? themeColors.textPrimary : themeColors.textMuted, opacity: isActive ? 1 : isCompleted ? 0.7 : 0.4 }
                    ]}>
                      {stage.title}
                    </Text>
                    {isActive && (
                      <Text style={[styles.stepSub, { color: themeColors.textMuted }]}>{stage.sub}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <GlassCard style={[styles.statusCard, { borderColor: themeColors.border }]}>
            <Feather name="lock" size={14} color={themeColors.success} />
            <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
              Encrypted in transit · Private to your account
            </Text>
          </GlassCard>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
  },
  header: {
    paddingHorizontal: 25,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  visualizerContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  ringDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: -4,
  },
  lottieWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: 'rgba(128,128,128,0.05)',
  },
  lottie: {
    width: 120,
    height: 120,
  },
  textCenter: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 15,
  },
  stepperContainer: {
    width: '100%',
    paddingLeft: 20,
    marginBottom: 40,
  },
  stepRow: {
    flexDirection: 'row',
    height: 65,
  },
  stepLeft: {
    alignItems: 'center',
    marginRight: 15,
    width: 30,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stepLine: {
    flex: 1,
    width: 2,
    marginVertical: 4,
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  stepSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

