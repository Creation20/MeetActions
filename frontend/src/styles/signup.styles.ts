import { StyleSheet } from 'react-native';
import { FontSize, FontWeight, Radii, Spacing, Shadow, getThemeColors } from '../constants/theme';

export const getSignupStyles = (isDarkMode: boolean) => {
  const colors = getThemeColors(isDarkMode);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      padding: Spacing.xl,
    },
    header: {
      alignItems: 'center',
      marginTop: 40,
      marginBottom: 48,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(0,122,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'rgba(0,122,255,0.2)',
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 22,
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
      height: 60,
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 16,
    },
    signupBtn: {
      height: 60,
      borderRadius: 18,
      marginTop: 10,
      overflow: 'hidden',
      ...Shadow.primary,
    },
    signupGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signupBtnText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 40,
      paddingBottom: 40,
    },
    footerText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    loginText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
  });
};
