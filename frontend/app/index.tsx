import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Spacing } from '../src/constants/theme';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AnimatedSplashScreen() {
  const router = useRouter();
  const { token, loading } = useAuth();
  
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start animation sequence
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 1200,
          easing: Easing.elastic(1.5),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ]).start(() => {
      // After animation, if auth context is still loading, wait
      // Otherwise navigate
      if (!loading) {
        navigate();
      }
    });
  }, [loading]);

  const navigate = () => {
    setTimeout(async () => {
      if (token) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }, 400);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#000', '#111', '#000']} style={StyleSheet.absoluteFill} />
      
      <Animated.View 
        style={[
          styles.logoContainer, 
          { 
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={Colors.gradientPrimary as [string, string]}
          style={styles.iconGradient}
        >
          <Feather name="mic" size={60} color="#fff" />
        </LinearGradient>
        
        <View style={styles.glow} />
        
        <Animated.Text style={[styles.appName, { opacity: titleOpacity }]}>
          Meet<Text style={{ color: Colors.primary }}>Actions</Text>
        </Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity: titleOpacity }]}>
          AI MEETING ASSISTANT
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glow: {
    position: 'absolute',
    top: 0,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primary,
    opacity: 0.15,
    zIndex: 1,
  },
  appName: {
    fontSize: 44,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
