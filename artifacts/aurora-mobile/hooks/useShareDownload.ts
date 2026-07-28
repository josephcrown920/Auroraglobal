import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

type MediaType = 'photo' | 'video' | 'lipsync' | 'music_video' | 'ugc' | string;

function isVideo(type: MediaType) {
  return type === 'video' || type === 'lipsync' || type === 'music_video';
}

function fileExtension(url: string, type: MediaType): string {
  // Try to get extension from URL
  const match = url.split('?')[0].match(/\.(\w{2,5})$/);
  if (match) return match[1];
  return isVideo(type) ? 'mp4' : 'jpg';
}

async function downloadToCache(url: string, type: MediaType): Promise<string> {
  const ext = fileExtension(url, type);
  const filename = `aurora_${Date.now()}.${ext}`;
  const localUri = `${FileSystem.cacheDirectory}${filename}`;
  const { uri } = await FileSystem.downloadAsync(url, localUri);
  return uri;
}

export function useShareDownload() {
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const saveToLibrary = useCallback(async (url: string, type: MediaType = 'photo') => {
    if (Platform.OS === 'web') {
      // On web, open in new tab
      window.open(url, '_blank');
      return;
    }

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to save to your camera roll.');
      return;
    }

    setIsSaving(true);
    try {
      const localUri = await downloadToCache(url, type);
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert('Saved!', isVideo(type) ? 'Video saved to camera roll.' : 'Photo saved to camera roll.');
    } catch (err: any) {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const shareMedia = useCallback(async (url: string, type: MediaType = 'photo') => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
      return;
    }

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Not available', 'Sharing is not available on this device.');
      return;
    }

    setIsSharing(true);
    try {
      const localUri = await downloadToCache(url, type);
      await Sharing.shareAsync(localUri, {
        mimeType: isVideo(type) ? 'video/mp4' : 'image/jpeg',
        dialogTitle: 'Share your creation',
        UTI: isVideo(type) ? 'public.movie' : 'public.image',
      });
    } catch (err: any) {
      // User dismissed share sheet — not an error
    } finally {
      setIsSharing(false);
    }
  }, []);

  return { saveToLibrary, shareMedia, isSaving, isSharing };
}
