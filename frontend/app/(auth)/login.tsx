import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { loginUser, googleLoginUser } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { useTheme } from '../../src/context/ThemeContext';
import { getLoginStyles } from '../../src/styles/login.styles';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { isDarkMode, colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getLoginStyles(isDarkMode), [isDarkMode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      handleGoogleLogin(authentication?.idToken || '');
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    setLoading(true);
    try {
      // In a real app, you'd get the name and email from the Google response or token
      const res = await googleLoginUser(idToken, 'user@example.com', 'Google User');
      await signIn(res.token, res.user);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const res = await loginUser(email, password);
      await signIn(res.token, res.user);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: themeColors.primary + '10', borderColor: themeColors.primary + '20' }]}>
          <Feather name="mic" size={32} color={themeColors.primary} />
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputWrap}>
          <Feather name="mail" size={20} color={themeColors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor={themeColors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputWrap}>
          <Feather name="lock" size={20} color={themeColors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={themeColors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
            <Feather name={showPassword ? "eye" : "eye-off"} size={18} color={themeColors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => {}}>
          <Text style={styles.forgotPassword}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.loginBtn} 
          onPress={handleLogin}
          disabled={loading}
        >
          <LinearGradient
            colors={themeColors.gradientPrimary as [string, string]}
            style={styles.loginGradient}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
        </View>

        <TouchableOpacity 
          style={[styles.googleBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]} 
          onPress={() => promptAsync()}
          disabled={!request || loading}
        >
          <Feather name="globe" size={20} color={themeColors.textPrimary} style={styles.googleIcon} />
          <Text style={styles.googleBtnText}>Google</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.signupText}>Create One</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
