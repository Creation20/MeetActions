import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, Radii, Spacing, getThemeColors } from '../src/constants/theme';
import { GradientButton } from '../src/components/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';

const { width, height } = Dimensions.get('window');

interface Slide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  gradientColors: [string, string];
  title: string;
  subtitle: string;
}

const getSlides = (themeColors: any): Slide[] => [
  {
    id: '1',
    icon: 'mic-circle',
    iconColor: themeColors.primaryLight,
    gradientColors: ['#1a0a2e', '#0A0A0F'],
    title: 'Record Any Meeting',
    subtitle: 'Capture lectures, team syncs, community meetings, or voice notes — from anywhere.',
  },
  {
    id: '2',
    icon: 'document-text',
    iconColor: themeColors.primaryLight,
    gradientColors: ['#0a1a2e', '#0A0A0F'],
    title: 'Instant Transcripts',
    subtitle: 'Powered by Whisper AI to generate accurate transcripts even with background noise and accents.',
  },
  {
    id: '3',
    icon: 'bulb',
    iconColor: themeColors.warning,
    gradientColors: ['#1a1a0a', '#0A0A0F'],
    title: 'AI-Powered Summaries',
    subtitle: 'Google Gemini extracts decisions, key points, and a concise summary from every recording.',
  },
  {
    id: '4',
    icon: 'checkmark-circle',
    iconColor: themeColors.success,
    gradientColors: ['#0a1a10', '#0A0A0F'],
    title: 'Action Items, Done Right',
    subtitle: 'Review, assign owners, set due dates — every task captured so nothing slips through the cracks.',
  },
  {
    id: '5',
    icon: 'star',
    iconColor: themeColors.primaryLight,
    gradientColors: ['#1a0a2e', '#0A0A0F'],
    title: 'MeetActions Pro',
    subtitle: 'Unlock AI Meeting Chat, Global AI Hub, Professional PDF Export, and Workspace Integrations.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { isDarkMode, colors: themeColors } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const SLIDES = useMemo(() => getSlides(themeColors), [themeColors]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@has_completed_onboarding', 'true');
      router.replace('/(tabs)');
    } catch (e) {}
  };

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      completeOnboarding();
    }
  };

  const skip = () => completeOnboarding();

  const renderSlide = ({ item }: { item: Slide }) => (
    <LinearGradient colors={isDarkMode ? item.gradientColors : [themeColors.bg, themeColors.bgCard]} style={styles.slide}>
      {/* Hero Icon */}
      <View style={styles.iconWrap}>
        <LinearGradient
          colors={themeColors.gradientPrimary as [string, string]}
          style={styles.iconGradient}
        >
          <Ionicons name={item.icon} size={72} color={item.iconColor} />
        </LinearGradient>
        <View style={[styles.glowRing, { borderColor: item.iconColor + '30' }]} />
      </View>

      <Text style={[styles.slideTitle, { color: themeColors.textPrimary }]}>{item.title}</Text>
      <Text style={[styles.slideSubtitle, { color: themeColors.textSecondary }]}>{item.subtitle}</Text>
    </LinearGradient>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />

      <View style={[styles.controls, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)' }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: themeColors.textMuted },
                i === activeIndex && [styles.dotActive, { backgroundColor: themeColors.primary }],
              ]}
            />
          ))}
        </View>

        <View style={styles.btnRow}>
          {activeIndex < SLIDES.length - 1 ? (
            <>
              <TouchableOpacity onPress={skip} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: themeColors.textSecondary }]}>Skip</Text>
              </TouchableOpacity>
              <GradientButton
                label="Next"
                onPress={goNext}
                size="md"
                style={{ flex: 1 }}
                icon={<Ionicons name="arrow-forward" size={18} color="#fff" />}
              />
            </>
          ) : (
            <GradientButton
              label="Get Started"
              onPress={goNext}
              size="lg"
              style={{ flex: 1 }}
              colors={themeColors.gradientAccent}
              icon={<Ionicons name="rocket" size={20} color="#fff" />}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 200,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  iconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
    opacity: 0.6,
  },
  slideTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    textAlign: 'center',
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  slideSubtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 48,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderColor: 'rgba(128,128,128,0.1)',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  skipBtn: {
    paddingHorizontal: Spacing.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
});
