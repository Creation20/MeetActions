import { StyleSheet } from 'react-native';
import { FontSize, FontWeight, Radii, Spacing, Shadow, getThemeColors } from '../constants/theme';

export const getTasksStyles = (isDarkMode: boolean) => {
  const colors = getThemeColors(isDarkMode);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 16,
    },
    tabsContainer: {
      marginBottom: 8,
    },
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: 120,
    },
    taskCard: {
      padding: Spacing.md,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    taskMain: {
      flexDirection: 'row',
      gap: 12,
    },
    checkbox: {
      marginTop: 2,
    },
    taskContent: {
      flex: 1,
    },
    taskTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 22,
    },
    taskCompleted: {
      color: colors.textMuted,
      textDecorationLine: 'line-through',
    },
    meetingRef: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
    },
    taskFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    chipRow: {
      flexDirection: 'row',
      gap: 12,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    chipText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 8,
    },
  });
};
