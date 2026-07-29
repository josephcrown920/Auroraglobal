import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

/**
 * Requests push-notification permission, registers the Expo push token with
 * the API server, and handles notification taps to deep-link to the Gallery.
 *
 * Must be mounted inside ClerkProvider + after the user is signed in.
 */
export function usePushNotifications() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    if (Platform.OS === 'web') return; // Push is native-only

    // Configure how notifications appear when the app is foregrounded
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    let tokenValue: string | null = null;

    async function registerToken() {
      try {
        const existing = (await Notifications.getPermissionsAsync()) as any;

        let granted: boolean = existing.granted ?? false;
        if (!granted && existing.canAskAgain !== false) {
          const result = (await Notifications.requestPermissionsAsync()) as any;
          granted = result.granted ?? false;
        }

        if (!granted) return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        tokenValue = tokenData.data;

        // Send token to server
        const authToken = await getToken();
        await fetch(`${API_BASE}/api/me/push-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ token: tokenValue }),
        });
      } catch (err) {
        // Swallow — push is non-critical
        console.warn('[push] Token registration failed:', err);
      }
    }

    registerToken();

    // Show banner when notification arrives while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // No-op — the system banner handles display
      },
    );

    // Deep-link when user taps a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        if (data?.screen === 'gallery') {
          router.push('/(tabs)/gallery');
        }
      },
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isSignedIn, getToken, router]);
}
