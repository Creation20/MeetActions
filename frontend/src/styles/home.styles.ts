import { StyleSheet, Platform } from 'react-native';
import { FontSize, FontWeight, Radii, Spacing, Shadow, getThemeColors } from '../constants/theme';

export const getHomeStyles = (isDarkMode: boolean) => {
  const colors = getThemeColors(isDarkMode);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      marginBottom: Spacing.xl,
    },
    greeting: {
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: FontSize.md,
      color: colors.textSecondary,
      marginTop: 2,
    },
    avatarContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      padding: 2,
    },
    avatarGradient: {
      flex: 1,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    scrollContent: {
      paddingBottom: 120,
    },
    section: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    statCard: {
      flex: 1,
      padding: Spacing.md,
      borderRadius: 20,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    recentCard: {
      padding: Spacing.md,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    },
    recentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    recentIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentInfo: {
      flex: 1,
    },
    recentTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    recentMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    tipCard: {
      borderRadius: 24,
      padding: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    },
    tipIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(0,122,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    tipText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 4,
    },
    analyticsCard: {
      padding: Spacing.lg,
      backgroundColor: colors.bgCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    },
    analyticsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 16,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    progressLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    progressValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.accent,
    },
    progressBarBg: {
      height: 8,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 20,
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: 4,
    },
    topicRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    topicChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    },
    topicName: {
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    topicCount: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: '700',
    },
  });
};
