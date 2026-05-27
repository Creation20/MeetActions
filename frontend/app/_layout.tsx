import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might cause this to error */
});

function RootLayoutContent() {
  const { colors, isDarkMode, isOffline } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDarkMode ? "light" : "dark"} backgroundColor={colors.bg} />
      
      {isOffline && (
        <View style={{ backgroundColor: '#FF3B30', paddingVertical: 4, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
          <Feather name="wifi-off" size={12} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>OFFLINE MODE</Text>
        </View>
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="record"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="processing/[id]"
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="meeting/[id]"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const prepare = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    };
    prepare();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <RootLayoutContent />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
