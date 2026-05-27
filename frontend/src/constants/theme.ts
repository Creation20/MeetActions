const DarkColors = {
  bg: '#000000',
  bgCard: '#111111',
  bgElevated: '#1C1C1E',
  bgOverlay: 'rgba(0,0,0,0.9)',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#52525B',
  border: 'rgba(255,255,255,0.1)',
  gradientCard: ['#1C1C1E', '#111111'],
  gradientDark: ['#000000', '#111111'],
};

const LightColors = {
  bg: '#F2F2F7',
  bgCard: '#FFFFFF',
  bgElevated: '#FFFFFF',
  bgOverlay: 'rgba(255,255,255,0.9)',
  textPrimary: '#000000',
  textSecondary: '#666666',
  textMuted: '#8E8E93',
  border: 'rgba(0,0,0,0.1)',
  gradientCard: ['#FFFFFF', '#F2F2F7'],
  gradientDark: ['#F2F2F7', '#E5E5EA'],
};

const BrandColors = {
  primary: '#007AFF',
  primaryLight: '#58A6FF',
  primaryDark: '#0056B3',
  primaryGlow: 'rgba(0,122,255,0.15)',
  accent: '#007AFF',
  accentLight: '#58A6FF',
  accentGlow: 'rgba(0,122,255,0.15)',
  success: '#32D74B',
  successLight: '#63E6BE',
  successGlow: 'rgba(50,215,75,0.15)',
  warning: '#FF9F0A',
  warningLight: '#FFB340',
  warningGlow: 'rgba(255,159,10,0.15)',
  danger: '#FF453A',
  dangerLight: '#FF6961',
  dangerGlow: 'rgba(255,69,58,0.15)',
  gradientPrimary: ['#007AFF', '#004CFF'],
  gradientAccent: ['#58A6FF', '#007AFF'],
};

export const Colors = {
  ...BrandColors,
  ...DarkColors, // Default
};

export const getThemeColors = (isDark: boolean) => ({
  ...BrandColors,
  ...(isDark ? DarkColors : LightColors)
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 40,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadow = {
  primary: {
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  accent: {
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
};
