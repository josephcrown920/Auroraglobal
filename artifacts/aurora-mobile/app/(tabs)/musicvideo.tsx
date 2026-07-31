import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  useGenerateMusicVideo,
  useGetGenerationStatus,
} from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useShareDownload } from '@/hooks/useShareDownload';
import { useFileUpload } from '@/hooks/useFileUpload';

const { width } = Dimensions.get('window');

const MV_STYLES = ['performance', 'narrative', 'abstract', 'lyric_video'] as const;
const MV_STYLE_LABELS: Record<string, string> = {
  performance: 'Performance',
  narrative: 'Narrative',
  abstract: 'Abstract',
  lyric_video: 'Lyric Video',
};
type MVStyle = (typeof MV_STYLES)[number];

export default function MusicVideoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>('audio.mp3');
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<MVStyle>('performance');
  const [beatSync, setBeatSync] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const generateMutation = useGenerateMusicVideo();
  const audioUpload = useFileUpload();
  const { shareMedia, saveToLibrary, isSharing, isSaving } = useShareDownload();

  const failedPollsRef = React.useRef(0);

  const { data: statusData, dataUpdatedAt } = useGetGenerationStatus(jobId ?? '', {
    query: {
      enabled: !!jobId && !resultUrl,
      refetchInterval: (query) => {
        const d = query.state.data;
        if (!d) return 3000;
        if (d.status === 'completed') return false;
        if (d.status === 'failed') {
          if (d.refunded === true) return false;
          if (failedPollsRef.current >= 4) return false;
          return 2000;
        }
        return 3000;
      },
    },
  });

  React.useEffect(() => {
    if (!statusData) return;
    if (statusData.status === 'completed') {
      if (statusData.outputUrl) setResultUrl(statusData.outputUrl);
      if (statusData.thumbnailUrl) setThumbnailUrl(statusData.thumbnailUrl);
      failedPollsRef.current = 0;
      setJobId(null);
      setStatusMsg('');
    } else if (statusData.status === 'failed') {
      if (statusData.refunded === true) {
        failedPollsRef.current = 0;
        setJobId(null);
        setStatusMsg('');
        Alert.alert(
          'Generation failed',
          `Your ${statusData.creditsRefunded} credits have been refunded.`,
        );
      } else {
        failedPollsRef.current += 1;
        if (failedPollsRef.current > 4) {
          failedPollsRef.current = 0;
          setJobId(null);
          setStatusMsg('');
          Alert.alert('Generation failed', 'Something went wrong with this generation.');
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt]);

  const isGenerating =
    !!jobId || generateMutation.isPending || audioUpload.isUploading;

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
    if (!audioUri) {
      Alert.alert('Add audio', 'Pick the music track to generate a video from.');
      return;
    }
    if (!prompt.trim()) {
      Alert.alert('Add a prompt', 'Describe the visual style for your music video.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResultUrl(null);
    setThumbnailUrl(null);
    try {
      setStatusMsg('Uploading audio…');
      const { objectPath: audioPath } = await audioUpload.upload(
        audioUri,
        audioName,
        'audio/mpeg',
      );
      setStatusMsg('Generating music video…');
      const job = await generateMutation.mutateAsync({
        data: {
          prompt: prompt.trim(),
          audioUrl: audioPath,
          style: selectedStyle,
          beatSync,
        },
      });
      setJobId(job.id);
    } catch (err: any) {
      setStatusMsg('');
      Alert.alert('Error', err?.message ?? 'Generation failed. Check your credits.');
    }
  }, [audioUri, audioName, prompt, selectedStyle, beatSync, audioUpload, generateMutation]);

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
        colors={['rgba(245,158,11,0.22)', 'transparent']}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Music Video</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          AI-generated visuals from your music
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
              <Text style={styles.videoDone}>Music video ready</Text>
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
          /* Audio picker */
          <TouchableOpacity
            style={[styles.audioPicker, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={pickAudio}
            activeOpacity={0.8}
          >
            {audioUri ? (
              <View style={styles.audioFilled}>
                <View style={[styles.audioIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <Ionicons name="musical-note" size={26} color="#F59E0B" />
                </View>
                <View style={styles.audioInfo}>
                  <Text style={[styles.audioName, { color: colors.foreground }]} numberOfLines={1}>
                    {audioName}
                  </Text>
                  <Text style={[styles.audioLabel, { color: colors.mutedForeground }]}>
                    Audio track selected · tap to change
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAudioUri(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.audioEmpty}>
                <View style={[styles.audioIconLarge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                  <Ionicons name="musical-notes-outline" size={34} color="#F59E0B" />
                </View>
                <Text style={[styles.audioPickerTitle, { color: colors.foreground }]}>
                  Add your music track
                </Text>
                <Text style={[styles.audioPickerSub, { color: colors.mutedForeground }]}>
                  MP3, M4A, WAV, or AAC
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Prompt */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Describe the visuals: setting, mood, color palette…"
            placeholderTextColor={colors.mutedForeground}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            maxLength={400}
          />
        </View>

        {/* Style */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Style</Text>
        <View style={styles.chipRow}>
          {MV_STYLES.map((s) => {
            const active = s === selectedStyle;
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.secondary : colors.card,
                    borderColor: active ? colors.secondary : colors.border,
                  },
                ]}
                onPress={() => {
                  setSelectedStyle(s);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : colors.mutedForeground }]}>
                  {MV_STYLE_LABELS[s]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Beat Sync toggle */}
        <TouchableOpacity
          style={[
            styles.toggleRow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => {
            setBeatSync((v) => !v);
            Haptics.selectionAsync();
          }}
          activeOpacity={0.8}
        >
          <View style={styles.toggleLeft}>
            <Ionicons name="pulse" size={18} color={beatSync ? colors.accent : colors.mutedForeground} />
            <View>
              <Text style={[styles.toggleTitle, { color: colors.foreground }]}>Beat Sync</Text>
              <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
                Align cuts to the beat
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.toggle,
              { backgroundColor: beatSync ? colors.accent : colors.muted },
            ]}
          >
            <View
              style={[
                styles.toggleThumb,
                { transform: [{ translateX: beatSync ? 18 : 2 }] },
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* Credit cost */}
        <View style={[styles.costRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="flash" size={14} color={colors.accent} />
          <Text style={[styles.costText, { color: colors.mutedForeground }]}>
            ~12 credits · AI music video generation
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
            colors={['#F59E0B', '#D946EF']}
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
                <Ionicons name="film" size={20} color="#fff" />
                <Text style={styles.generateText}>Generate Music Video</Text>
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
  audioPicker: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioEmpty: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  audioIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPickerTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  audioPickerSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  audioFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
    width: '100%',
  },
  audioIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioInfo: { flex: 1 },
  audioName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  audioLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
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
  inputWrapper: { borderRadius: 14, borderWidth: 1, padding: 14, minHeight: 80 },
  input: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  sectionLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: -8 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  toggleSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
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
