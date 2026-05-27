import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';

interface User {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  isPremium: boolean;
  loading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;
  setPremiumStatus: (status: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    async function loadStorageData() {
      try {
        const storedToken = await AsyncStorage.getItem('@auth_token');
        const storedUser = await AsyncStorage.getItem('@auth_user');
        const storedPremium = await AsyncStorage.getItem('@is_premium');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }

        if (storedPremium) {
          setIsPremium(storedPremium === 'true');
        }
      } catch (error) {
        console.error('Failed to load auth data', error);
      } finally {
        setLoading(false);
      }
    }
    loadStorageData();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isSplash = !segments[0] || (segments[0] as string) === 'index';
    const isOnboarding = (segments[0] as string) === 'onboarding';

    // We only enforce auth redirect if they are trying to access protected routes
    if (!token && !inAuthGroup && !isSplash && !isOnboarding) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      // If logged in and in auth pages, go to tabs
      router.replace('/(tabs)');
    }
  }, [token, segments, loading]);

  const signIn = async (newToken: string, newUser: User) => {
    try {
      await AsyncStorage.setItem('@auth_token', newToken);
      await AsyncStorage.setItem('@auth_user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
    } catch (error) {
      console.error('Failed to sign in', error);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('@auth_token');
      await AsyncStorage.removeItem('@auth_user');
      await AsyncStorage.removeItem('@is_premium');
      setToken(null);
      setUser(null);
      setIsPremium(false);
    } catch (error) {
      console.error('Failed to sign out', error);
    }
  };

  const updateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    await AsyncStorage.setItem('@auth_user', JSON.stringify(updatedUser));
  };

  const setPremiumStatus = async (status: boolean) => {
    try {
      await AsyncStorage.setItem('@is_premium', status ? 'true' : 'false');
      setIsPremium(status);
    } catch (error) {
      console.error('Failed to update premium status', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isPremium, loading, signIn, signOut, updateUser, setPremiumStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
