import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  useGenerateLipsync,
  useGetGenerationStatus,
} from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useShareDownload } from '@/hooks/useShareDownload';
import { useFileUpload } from '@/hooks/useFileUpload';

const { width } = Dimensions.get('window');

export default function LipSyncScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('video.mp4');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>('audio.mp3');
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const generateMutation = useGenerateLipsync();
  const videoUpload = useFileUpload();
  const audioUpload = useFileUpload();
  const { shareMedia, saveToLibrary, isSharing, isSaving } = useShareDownload();

  const { data: statusData } = useGetGenerationStatus(jobId ?? '', {
    query: {
      enabled: !!jobId && !resultUrl,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === 'completed' || status === 'failed') return false;
        return 3000;
      },
    },
  });

  React.useEffect(() => {
    if (statusData?.status === 'completed') {
      if (statusData.outputUrl) setResultUrl(statusData.outputUrl);
      if (statusData.thumbnailUrl) setThumbnailUrl(statusData.thumbnailUrl);
      setJobId(null);
      setStatusMsg('');
    } else if (statusData?.status === 'failed') {
      setJobId(null);
      setStatusMsg('');
      Alert.alert('Generation failed', 'Your credits have been returned.');
    }
  }, [statusData?.status, statusData?.outputUrl, statusData?.thumbnailUrl]);

  const isGenerating =
    !!jobId ||
    generateMutation.isPending ||
    videoUpload.isUploading ||
    audioUpload.isUploading;

  const pickVideo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
      setVideoName(result.assets[0].fileName ?? 'video.mp4');
      setResultUrl(null);
    }
  }, []);

  const pickAudio = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        setAudioUri(result.assets[0].uri);
        setAudioName(result.assets[0].name ?? 'audio.mp3');
        setResultUrl(null);
      }
    } catch {
      Alert.alert('Error', 'Could not open the audio picker.');
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!videoUri) {
      Alert.alert('Add a video', 'Pick the video clip you want to lip-sync.');
      return;
    }
    if (!audioUri) {
      Alert.alert('Add audio', 'Pick the audio track to sync to the video.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResultUrl(null);
    setThumbnailUrl(null);
    try {
      setStatusMsg('Uploading video…');
      const { objectPath: videoPath } = await videoUpload.upload(
        videoUri,
        videoName,
        'video/mp4',
      );
      setStatusMsg('Uploading audio…');
      const { objectPath: audioPath } = await audioUpload.upload(
        audioUri,
        audioName,
        'audio/mpeg',
      );
      setStatusMsg('Generating lip-sync…');
      const job = await generateMutation.mutateAsync({
        data: {
          videoUrl: videoPath,
          audioUrl: audioPath,
        },
      });
      setJobId(job.id);
    } catch (err: any) {
      setStatusMsg('');
      Alert.alert('Error', err?.message ?? 'Generation failed. Check your credits.');
    }
  }, [videoUri, audioUri, videoName, audioName, videoUpload, audioUpload, generateMutation]);

  const handleReset = () => {
    setResultUrl(null);
    setThumbnailUrl(null);
    setJobId(null);
    setStatusMsg('');
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <LinearGradient
        colors={['rgba(16,185,129,0.22)', 'transparent']}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Lip Sync</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Sync any audio to any video clip
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        {resultUrl || thumbnailUrl ? (
          /* Result */
          <View style={styles.resultBox}>
            <Image
              source={{ uri: thumbnailUrl ?? resultUrl! }}
              style={styles.resultImage}
              contentFit="cover"
              transition={400}
            />
            <View style={styles.videoOverlay}>
              <View style={styles.playBadge}>
                <Ionicons name="play" size={18} color="#fff" />
              </View>
              <Text style={styles.videoDone}>Lip-sync ready</Text>
            </View>
            <View style={styles.resultBtns}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={handleReset}
              >
                <Ionicons name="refresh" size={16} color={colors.foreground} />
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>New</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => saveToLibrary(resultUrl!, 'video')}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <Ionicons name="download-outline" size={16} color={colors.foreground} />
                )}
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => shareMedia(resultUrl!, 'video')}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="share-outline" size={16} color="#fff" />
                )}
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Pickers */
          <View style={styles.pickersCol}>
            {/* Video picker */}
            <TouchableOpacity
              style={[styles.pickerBox, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={pickVideo}
              activeOpacity={0.8}
            >
              {videoUri ? (
                <View style={styles.pickerFilled}>
                  <View style={[styles.fileIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                    <Ionicons name="videocam" size={22} color="#10B981" />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
                      {videoName}
                    </Text>
                    <Text style={[styles.fileLabel, { color: colors.mutedForeground }]}>
                      Video clip selected
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setVideoUri(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickerEmpty}>
                  <View style={[styles.pickerIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                    <Ionicons name="videocam-outline" size={30} color="#10B981" />
                  </View>
                  <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Add video clip</Text>
                  <Text style={[styles.pickerSub, { color: colors.mutedForeground }]}>
                    The video you want to animate
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Divider arrow */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <View style={[styles.arrowCircle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="add" size={16} color={colors.mutedForeground} />
              </View>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Audio picker */}
            <TouchableOpacity
              style={[styles.pickerBox, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={pickAudio}
              activeOpacity={0.8}
            >
              {audioUri ? (
                <View style={styles.pickerFilled}>
                  <View style={[styles.fileIcon, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
                    <Ionicons name="musical-note" size={22} color="#7C3AED" />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
                      {audioName}
                    </Text>
                    <Text style={[styles.fileLabel, { color: colors.mutedForeground }]}>
                      Audio track selected
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setAudioUri(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickerEmpty}>
                  <View style={[styles.pickerIcon, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
                    <Ionicons name="musical-notes-outline" size={30} color="#7C3AED" />
                  </View>
                  <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Add audio track</Text>
                  <Text style={[styles.pickerSub, { color: colors.mutedForeground }]}>
                    MP3, M4A, WAV, or AAC
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Credit cost hint */}
        <View style={[styles.costRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="flash" size={14} color={colors.accent} />
          <Text style={[styles.costText, { color: colors.mutedForeground }]}>
            ~8 credits · AI lip-sync generation
          </Text>
        </View>

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateBtn, { opacity: isGenerating ? 0.7 : 1 }]}
          onPress={handleGenerate}
          disabled={isGenerating}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#10B981', '#7C3AED']}
            style={styles.generateGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.generateText}>
                  {statusMsg ||
                    (statusData?.status === 'processing' ? 'Rendering…' : 'Generating…')}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="mic" size={20} color="#fff" />
                <Text style={styles.generateText}>Generate Lip-Sync</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {generateMutation.error && (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            Generation failed — check your credit balance.
          </Text>
        )}
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 2 },
  body: { paddingHorizontal: 20, gap: 16 },
  pickersCol: { gap: 0 },
  pickerBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerEmpty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  pickerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  pickerSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  pickerFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
    width: '100%',
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  fileLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  dividerLine: { flex: 1, height: 1 },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  resultBox: { gap: 12 },
  resultImage: { width: '100%', height: 220, borderRadius: 16 },
  videoOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  playBadge: { alignItems: 'center', justifyContent: 'center' },
  videoDone: { color: '#fff', fontSize: 12, fontFamily: 'Inter_500Medium' },
  resultBtns: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  costText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  generateBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  generateText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  errorText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
