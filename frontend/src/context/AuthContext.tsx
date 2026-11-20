import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { fetchMe } from '../services/api';

interface User {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  isPremium?: boolean;
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
  refreshEntitlement: () => Promise<void>;
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
          // The cached flag is only an offline hint so the UI doesn't flicker to
          // "free" on launch. The server is the authority — refresh it below.
          if (storedPremium) setIsPremium(storedPremium === 'true');
          refreshEntitlement();
        }
      } catch (error) {
        console.error('Failed to load auth data', error);
      } finally {
        setLoading(false);
      }
    }
    loadStorageData();
  }, []);

  /**
   * Pulls entitlement from the server and caches it. Every paid feature is also
   * enforced server-side, so a stale or tampered cache can't unlock anything —
   * it would only misdraw a lock icon until this resolves.
   */
  const refreshEntitlement = async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      setIsPremium(me.isPremium);
      await AsyncStorage.setItem('@auth_user', JSON.stringify(me));
      await AsyncStorage.setItem('@is_premium', me.isPremium ? 'true' : 'false');
    } catch {
      // Offline or expired session: keep the cached hint and let the API layer
      // handle a real 401.
    }
  };

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
      // Login/register responses now carry the server's entitlement.
      const premium = Boolean(newUser.isPremium);
      await AsyncStorage.setItem('@is_premium', premium ? 'true' : 'false');
      setToken(newToken);
      setUser(newUser);
      setIsPremium(premium);
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

  /**
   * Display-only. Setting this does NOT grant access to anything: every paid
   * feature is gated server-side by the entitlement on the user record. Once a
   * payment provider is wired up, the purchase should be verified on the server
   * and this should be replaced by a call to refreshEntitlement().
   */
  const setPremiumStatus = async (status: boolean) => {
    try {
      await AsyncStorage.setItem('@is_premium', status ? 'true' : 'false');
      setIsPremium(status);
    } catch (error) {
      console.error('Failed to update premium status', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isPremium, loading, signIn, signOut, updateUser, setPremiumStatus, refreshEntitlement }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
