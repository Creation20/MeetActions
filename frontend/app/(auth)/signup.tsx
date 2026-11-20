import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { registerUser, googleLoginUser } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { getSignupStyles } from '../../src/styles/signup.styles';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { showError } from '../../src/utils/errors';

WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen() {
  const { isDarkMode, colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getSignupStyles(isDarkMode), [isDarkMode]);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    webClientId: 'YOUR_WEB_CLIENT_ID',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleSignup(authentication?.idToken || '');
    }
  }, [response]);

  const handleGoogleSignup = async (idToken: string) => {
    setLoading(true);
    try {
      const res = await googleLoginUser(idToken, 'user@example.com', 'Google User');
      await signIn(res.token, res.user);
      router.replace('/onboarding');
    } catch (error: any) {
      showError(error, 'Sign-up failed', "We couldn't create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser(name, email, password);
      await signIn(res.token, res.user);
      router.replace('/onboarding');
    } catch (error: any) {
      showError(error, 'Sign-up failed', "We couldn't create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.bg }}>
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: themeColors.primary + '15', borderColor: themeColors.primary + '20' }]}>
              <Feather name="user-plus" size={32} color={themeColors.primary} />
            </View>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Join MeetActions and supercharge your productivity.</Text>
          </View>

          <View style={styles.form}>
            <View style={[styles.inputWrap, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Feather name="user" size={20} color={themeColors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: themeColors.textPrimary }]}
                placeholder="Full Name"
                placeholderTextColor={themeColors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Feather name="mail" size={20} color={themeColors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: themeColors.textPrimary }]}
                placeholder="Email Address"
                placeholderTextColor={themeColors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Feather name="lock" size={20} color={themeColors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: themeColors.textPrimary }]}
                placeholder="Password"
                placeholderTextColor={themeColors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity 
              style={styles.signupBtn} 
              onPress={handleSignup}
              disabled={loading}
            >
              <LinearGradient
                colors={themeColors.gradientPrimary as [string, string]}
                style={styles.signupGradient}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signupBtnText}>Get Started</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: themeColors.border }} />
              <Text style={{ color: themeColors.textMuted, paddingHorizontal: 16, fontSize: 13, fontWeight: '600' }}>or signup with</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: themeColors.border }} />
            </View>

            <TouchableOpacity 
              style={{ 
                flexDirection: 'row', 
                height: 56, 
                borderRadius: 18, 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', 
                borderWidth: 1, 
                borderColor: themeColors.border 
              }} 
              onPress={() => promptAsync()}
              disabled={!request || loading}
            >
              <Feather name="globe" size={20} color={themeColors.textPrimary} style={{ marginRight: 12 }} />
              <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: '600' }}>Google</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={[styles.loginText, { color: themeColors.primary }]}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
