import { StyleSheet, Platform, Dimensions } from 'react-native';
import { FontSize, FontWeight, Radii, Spacing, Shadow, getThemeColors } from '../constants/theme';

export const getTabStyles = (isDarkMode: boolean) => {
  const colors = getThemeColors(isDarkMode);

  return StyleSheet.create({
    tabBar: {
      position: 'absolute',
      bottom: Platform.OS === 'ios' ? 34 : 24,
      marginHorizontal: 24,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDarkMode ? 0.4 : 0.1,
      shadowRadius: 16,
      paddingHorizontal: 8,
    },
    backgroundContainer: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 32,
      overflow: 'hidden',
    },
    blur: {
      ...StyleSheet.absoluteFillObject,
    },
    border: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconContainer: {
      marginTop: 20,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: 50,
    },
    iconGlow: {
      position: 'absolute',
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      opacity: 0.12,
    },
    activePill: {
      position: 'absolute',
      bottom: 6,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    orbWrapper: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    orbGlow: {
      position: 'absolute',
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      opacity: 0.15,
    },
    orb: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      ...Shadow.primary,
      top: -12,
    },
  });
};
