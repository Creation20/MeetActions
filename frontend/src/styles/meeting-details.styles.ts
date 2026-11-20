import { StyleSheet, Platform } from 'react-native';
import { FontSize, FontWeight, Spacing, Radii, Shadow, getThemeColors } from '../constants/theme';

export const getMeetingStyles = (isDarkMode: boolean) => {
  const colors = getThemeColors(isDarkMode);
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    notFound: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      padding: Spacing.xs,
    },
    headerTitleWrap: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
    },
    headerTitle: {
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actionBtn: {
      padding: Spacing.xs,
    },
    tabsWrap: {
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: 120,
    },
    tabContent: {
      gap: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 10,
      marginTop: 5,
    },
    card: {
      padding: Spacing.md,
      borderRadius: 20,
    },
    paragraph: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 24,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    bullet: {
      marginTop: 4,
      marginRight: 10,
    },
    listText: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 22,
    },
    audioPlayerContainer: {
      backgroundColor: colors.bgCard,
      borderRadius: 32,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.card,
    },
    audioControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 40,
    },
    seekBtn: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    playBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadow.primary,
    },
    progressContainer: {
      width: '100%',
    },
    audioTrack: {
      height: 6,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      borderRadius: 3,
      marginBottom: 8,
      overflow: 'hidden',
    },
    audioProgress: {
      height: '100%',
      backgroundColor: colors.primaryLight,
    },
    timeLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    audioTime: {
      fontSize: 12,
      color: colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    transcriptText: {
      fontSize: FontSize.md,
      color: colors.textPrimary,
      lineHeight: 28,
    },
    speakerRow: {
      marginBottom: 20,
    },
    speakerLabel: {
      fontSize: 11,
      fontWeight: '900',
      color: colors.primaryLight,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    speakerBubble: {
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    speakerText: {
      fontSize: 15,
      lineHeight: 24,
      color: colors.textPrimary,
    },
    tasksHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    addTaskBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryGlow,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radii.full,
    },
    addTaskText: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.primaryLight,
      marginLeft: 4,
    },
    taskCard: {
      padding: Spacing.md,
    },
    taskHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    checkbox: {
      marginTop: 2,
    },
    taskInfo: {
      flex: 1,
    },
    taskTitle: {
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    taskCompleted: {
      color: colors.textMuted,
      textDecorationLine: 'line-through',
    },
    taskDesc: {
      fontSize: FontSize.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    taskFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerChips: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    chipText: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      width: '100%',
      ...Shadow.card,
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: 24,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 20,
    },
    modalInput: {
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      color: colors.textPrimary,
      padding: 18,
      fontSize: 16,
      marginBottom: 20,
    },
    modalActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    modalBtnCancel: {
      flex: 1,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    },
    modalBtnTextCancel: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    modalBtnSave: {
      flex: 1,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadow.primary,
    },
    modalBtnTextSave: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });
};
