import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useOAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { Image } from 'expo-image';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: 'oauth_google' });

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setLoading(true);
      const { createdSessionId, setActive } = await startGoogle({
        redirectUrl: Linking.createURL('/', { scheme: 'aurora-mobile' }),
      });
      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
      }
    } catch (err) {
      Alert.alert('Sign in failed', 'Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startGoogle]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={['rgba(124,58,237,0.18)', 'rgba(217,70,239,0.08)', 'transparent']}
        style={styles.gradientOverlay}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>
        {/* Logo / icon */}
        <View style={styles.logoArea}>
          <Image
            source={require('../assets/images/icon.png')}
            style={styles.icon}
            contentFit="contain"
          />
          <Text style={[styles.appName, { color: colors.foreground }]}>Aurora</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            AI Creative Studio for Performing Artists
          </Text>
        </View>

        {/* Feature pills */}
        <View style={styles.pills}>
          {['AI Photos', 'AI Videos', 'Lip Sync', 'Music Videos'].map((f) => (
            <View key={f} style={[styles.pill, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="flash" size={12} color={colors.primary} />
              <Text style={[styles.pillText, { color: colors.mutedForeground }]}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />

        {/* Sign in button */}
        <TouchableOpacity
          style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={colors.foreground} />
              <Text style={[styles.googleBtnText, { color: colors.foreground }]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.terms, { color: colors.mutedForeground }]}>
          By continuing you agree to our Terms of Service
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    zIndex: 1,
    alignItems: 'center',
  },
  logoArea: {
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 8,
  },
  appName: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 28,
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  spacer: {
    flex: 1,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  googleBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  terms: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
