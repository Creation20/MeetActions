import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing } from '../../src/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useTheme } from '../../src/context/ThemeContext';

export default function ProcessingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isDarkMode, colors: themeColors } = useTheme();

  useEffect(() => {
    const timeout = setTimeout(() => {
      // In production, we would poll the backend, but for this demo:
      if (id && id !== 'pending') {
        router.replace(`/meeting/${id}`);
      } else {
        router.replace('/(tabs)/history');
      }
    }, 6000);

    return () => clearTimeout(timeout);
  }, [id]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <LinearGradient 
        colors={isDarkMode ? ['#1a0a2e', '#0A0A0F'] : ['#F0F4FF', '#FFFFFF']} 
        style={StyleSheet.absoluteFill} 
      />
      
      <View style={styles.content}>
        <View style={styles.lottieContainer}>
          <LottieView 
            source={{ uri: 'https://assets5.lottiefiles.com/packages/lf20_t9gk0u4e.json' }} 
            autoPlay 
            loop 
            style={styles.lottie}
          />
          <View style={[styles.glow, { backgroundColor: themeColors.primary, opacity: isDarkMode ? 0.2 : 0.1 }]} />
        </View>
        
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>AI is Working...</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Transcribing speakers, summarizing outcomes, and extracting your next steps.
        </Text>
        
        <View style={styles.factCard}>
          <Ionicons name="bulb-outline" size={18} color={themeColors.primary} />
          <Text style={[styles.factText, { color: themeColors.textSecondary }]}>
            Did you know? Gemini 2.5 Flash analyzes audio and visuals simultaneously for 100% accuracy.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  lottieContainer: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  lottie: {
    width: 300,
    height: 300,
  },
  glow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    zIndex: -1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.md,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  factCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,122,255,0.05)',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.1)',
    marginTop: 20,
  },
  factText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
