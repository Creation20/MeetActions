import { Tabs } from 'expo-router';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { getTabStyles } from '../../src/styles/tabs.styles';
import { useTheme } from '../../src/context/ThemeContext';

interface TabIconProps {
  name: keyof typeof Feather.glyphMap;
  focused: boolean;
  color: string;
}

function TabIcon({ name, focused, styles }: any) {
  return (
    <View style={styles.iconContainer}>
      {focused && (
        <View style={styles.iconGlow} />
      )}
      <Feather 
        name={name} 
        size={24} 
        color={focused ? styles.iconGlow.backgroundColor : styles.activePill.backgroundColor} 
      />
      {focused && <View style={styles.activePill} />}
    </View>
  );
}

function RecordOrb({ onPress, styles, colors }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.orbWrapper}
      activeOpacity={0.85}
    >
      <View style={styles.orbGlow} />
      <LinearGradient
        colors={colors.gradientAccent as [string, string]}
        style={styles.orb}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Feather name="mic" size={26} color="#fff" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getTabStyles(isDarkMode), [isDarkMode]);

  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRecordPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/record');
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveTintColor: colors.primary,
        tabBarBackground: () => (
          <View style={styles.backgroundContainer}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={80} tint={isDarkMode ? "dark" : "light"} style={styles.blur} />
            ) : (
              <View style={[styles.blur, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.94)' : 'rgba(255, 255, 255, 0.94)' }]} />
            )}
            <View style={styles.border} />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              {focused && <View style={styles.iconGlow} />}
              <Feather name="home" size={24} color={focused ? colors.primary : colors.textMuted} />
              {focused && <View style={styles.activePill} />}
            </View>
          ),
        }}
        listeners={{ tabPress: handleTabPress }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              {focused && <View style={styles.iconGlow} />}
              <Feather name="layers" size={24} color={focused ? colors.primary : colors.textMuted} />
              {focused && <View style={styles.activePill} />}
            </View>
          ),
        }}
        listeners={{ tabPress: handleTabPress }}
      />
      <Tabs.Screen
        name="_fab"
        options={{
          tabBarButton: () => <RecordOrb onPress={handleRecordPress} styles={styles} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              {focused && <View style={styles.iconGlow} />}
              <Feather name="check-circle" size={24} color={focused ? colors.primary : colors.textMuted} />
              {focused && <View style={styles.activePill} />}
            </View>
          ),
        }}
        listeners={{ tabPress: handleTabPress }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              {focused && <View style={styles.iconGlow} />}
              <Feather name="settings" size={24} color={focused ? colors.primary : colors.textMuted} />
              {focused && <View style={styles.activePill} />}
            </View>
          ),
        }}
        listeners={{ tabPress: handleTabPress }}
      />
    </Tabs>
  );
}
