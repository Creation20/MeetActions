import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  StyleProp,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radii, FontSize, FontWeight, Shadow, Spacing } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

// ─── GradientButton ──────────────────────────────────────────────────────────

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  colors?: string[];
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  label,
  onPress,
  colors,
  style,
  loading = false,
  disabled = false,
  icon,
  size = 'md',
}) => {
  const { colors: themeColors } = useTheme();
  const height = size === 'sm' ? 40 : size === 'lg' ? 60 : 50;
  const fontSize = size === 'sm' ? FontSize.sm : size === 'lg' ? FontSize.lg : FontSize.md;
  const gradColors = colors || themeColors.gradientPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      <LinearGradient
        colors={gradColors as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradBtn, { height, borderRadius: Radii.lg }, Shadow.primary]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
            <Text style={[styles.gradBtnLabel, { fontSize }]}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

// ─── GlassCard ───────────────────────────────────────────────────────────────

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style, onPress }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  
  const cardStyle: ViewStyle = {
    backgroundColor: themeColors.bgCard,
    borderColor: themeColors.border,
    shadowColor: isDarkMode ? '#000' : '#888',
  };

  if (onPress) {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.85} 
        style={[styles.glassCard, cardStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.glassCard, cardStyle, style]}>{children}</View>;
};

// ─── Badge ───────────────────────────────────────────────────────────────────

interface BadgeProps {
  label: string;
  color?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color,
  bg,
  style,
  textStyle,
}) => {
  const { colors: themeColors } = useTheme();
  const textColor = color || themeColors.primaryLight;
  const bgColor = bg || themeColors.primaryGlow;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, style]}>
      <Text style={[styles.badgeText, { color: textColor }, textStyle]}>{label}</Text>
    </View>
  );
};

// ─── SectionHeader ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, action }) => {
  const { colors: themeColors } = useTheme();
  
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={[styles.sectionAction, { color: themeColors.primaryLight }]}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Divider ─────────────────────────────────────────────────────────────────

export const Divider = ({ style }: { style?: ViewStyle }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.divider, { backgroundColor: themeColors.border }, style]} />
  );
};

// ─── EmptyState ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: { label: string; onPress: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, action }) => {
  const { colors: themeColors } = useTheme();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: themeColors.bgElevated }]}>{icon}</View>
      <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>{subtitle}</Text>
      {action && (
        <GradientButton
          label={action.label}
          onPress={action.onPress}
          size="sm"
          style={{ marginTop: Spacing.lg }}
        />
      )}
    </View>
  );
};

// ─── Pill Tab ─────────────────────────────────────────────────────────────────

interface PillTabsProps {
  tabs: string[];
  active: number;
  onChange: (i: number) => void;
}

export const PillTabs: React.FC<PillTabsProps> = ({ tabs, active, onChange }) => {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.pillRow, { backgroundColor: themeColors.bgElevated }]}>
      {tabs.map((tab, i) => (
        <TouchableOpacity
          key={tab}
          onPress={() => onChange(i)}
          style={[styles.pill, active === i && [styles.pillActive, { backgroundColor: themeColors.primary }]]}
        >
          <Text style={[styles.pillText, { color: themeColors.textSecondary }, active === i && styles.pillTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

interface SkeletonProps {
  width: number | string;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width, height, radius = 8, style }) => {
  const { isDarkMode } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [isDarkMode ? 0.05 : 0.1, isDarkMode ? 0.15 : 0.2],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: isDarkMode ? '#fff' : '#000',
          opacity,
        } as any,
        style,
      ]}
    />
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  gradBtnLabel: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
  },
  glassCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
    ...Shadow.card,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  sectionAction: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  pillRow: {
    flexDirection: 'row',
    borderRadius: Radii.full,
    padding: 4,
  },
  pill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radii.full,
  },
  pillActive: {
    ...Shadow.primary,
  },
  pillText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
  },
});
