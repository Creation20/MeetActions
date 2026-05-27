import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { getThemeColors } from '../constants/theme';

interface ThemeContextData {
  isDarkMode: boolean;
  isOffline: boolean;
  colors: any;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    async function loadTheme() {
      const stored = await AsyncStorage.getItem('@is_dark_mode');
      if (stored !== null) {
        setIsDarkMode(stored === 'true');
      }
    }
    loadTheme();

    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsOffline(!state.isConnected || !state.isInternetReachable);
      } catch (e) {}
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = async () => {
    const newVal = !isDarkMode;
    setIsDarkMode(newVal);
    await AsyncStorage.setItem('@is_dark_mode', newVal ? 'true' : 'false');
  };

  const colors = getThemeColors(isDarkMode);

  return (
    <ThemeContext.Provider value={{ isDarkMode, isOffline, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
