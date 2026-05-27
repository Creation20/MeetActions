import { StyleSheet } from 'react-native';
import { FontSize, FontWeight, Radii, Spacing, Shadow, getThemeColors } from '../constants/theme';

export const getLoginStyles = (isDarkMode: boolean) => {
  const colors = getThemeColors(isDarkMode);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    header: {
      alignItems: 'center',
      marginBottom: 48,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(0,122,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: 'rgba(0,122,255,0.2)',
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 8,
    },
    form: {
      gap: 16,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      height: 56,
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 16,
    },
    forgotPassword: {
      color: colors.primaryLight,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'right',
    },
    loginBtn: {
      height: 56,
      borderRadius: 18,
      marginTop: 10,
      overflow: 'hidden',
      ...Shadow.primary,
    },
    loginGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 32,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textMuted,
      paddingHorizontal: 16,
      fontSize: 13,
      fontWeight: '600',
    },
    googleBtn: {
      flexDirection: 'row',
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      borderWidth: 1,
      borderColor: colors.border,
    },
    googleIcon: {
      marginRight: 12,
    },
    googleBtnText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 40,
    },
    footerText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    signupText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
  });
};
