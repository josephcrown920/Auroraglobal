import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useGenerateVideo, useGetGenerationStatus } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useShareDownload } from '@/hooks/useShareDownload';

const { width } = Dimensions.get('window');
const VIDEO_STYLES = ['cinematic', 'realistic', 'performance'] as const;
const DURATIONS = [5, 10] as const;

type VideoStyle = (typeof VIDEO_STYLES)[number];

export default function VideoAgentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<VideoStyle>('cinematic');
  const [duration, setDuration] = useState<5 | 10>(5);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const generateMutation = useGenerateVideo();

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

  // React to completed status outside select to avoid side effects in pure fn
  React.useEffect(() => {
    if (statusData?.status === 'completed') {
      if (statusData.outputUrl) setResultUrl(statusData.outputUrl);
      if (statusData.thumbnailUrl) setThumbnailUrl(statusData.thumbnailUrl);
      setJobId(null);
    }
  }, [statusData?.status, statusData?.outputUrl, statusData?.thumbnailUrl]);

  const isGenerating = !!jobId || generateMutation.isPending;
  const { shareMedia, saveToLibrary, isSharing, isSaving } = useShareDownload();

  const pickSource = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setSourceUri(result.assets[0].uri);
      setResultUrl(null);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setSourceUri(result.assets[0].uri);
      setResultUrl(null);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      Alert.alert('Add a prompt', 'Describe the video you want to create.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResultUrl(null);
    setThumbnailUrl(null);
    try {
      const job = await generateMutation.mutateAsync({
        data: {
          prompt: prompt.trim(),
          style: selectedStyle,
          duration,
          sourceImageUrl: sourceUri ?? undefined,
        },
      });
      setJobId(job.id);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Generation failed. Check your credits.');
    }
  }, [prompt, selectedStyle, duration, sourceUri, generateMutation]);

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <LinearGradient
        colors={['rgba(217,70,239,0.22)', 'transparent']}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Video Agent</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          AI video generation
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        {/* Result or source image */}
        {resultUrl || thumbnailUrl ? (
          <View style={styles.resultBox}>
            <Image
              source={{ uri: thumbnailUrl ?? resultUrl! }}
              style={styles.resultImage}
              contentFit="cover"
              transition={400}
            />
            <View style={[styles.videoOverlay]}>
              <View style={styles.playBadge}>
                <Ionicons name="play" size={20} color="#fff" />
              </View>
              <Text style={styles.videoDone}>Video ready</Text>
            </View>
            <View style={styles.resultBtns}>
              <TouchableOpacity
                style={[styles.resetBtn, { backgroundColor: colors.muted, borderColor: colors.border, flex: 1 }]}
                onPress={() => { setResultUrl(null); setThumbnailUrl(null); setJobId(null); }}
              >
                <Ionicons name="refresh" size={16} color={colors.foreground} />
                <Text style={[styles.resetBtnText, { color: colors.foreground }]}>New</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resetBtn, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}
                onPress={() => saveToLibrary(resultUrl!, 'video')}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <Ionicons name="download-outline" size={16} color={colors.foreground} />
                )}
                <Text style={[styles.resetBtnText, { color: colors.foreground }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resetBtn, { backgroundColor: colors.primary, borderColor: colors.primary, flex: 1 }]}
                onPress={() => shareMedia(resultUrl!, 'video')}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="share-outline" size={16} color="#fff" />
                )}
                <Text style={[styles.resetBtnText, { color: '#fff' }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Source image */
          <TouchableOpacity
            style={[
              styles.sourceBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={pickSource}
            activeOpacity={0.8}
          >
            {sourceUri ? (
              <>
                <Image source={{ uri: sourceUri }} style={styles.sourcePreview} contentFit="cover" />
                <View style={styles.sourceOverlay}>
                  <TouchableOpacity
                    style={styles.changePhotoBtn}
                    onPress={pickSource}
                  >
                    <Ionicons name="swap-horizontal" size={14} color="#fff" />
                    <Text style={styles.changePhotoText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto}>
                    <Ionicons name="camera" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.sourcePlaceholder}>
                <Ionicons name="image-outline" size={36} color={colors.secondary} />
                <Text style={[styles.sourcePlaceholderTitle, { color: colors.foreground }]}>
                  Add source image
                </Text>
                <Text style={[styles.sourcePlaceholderSub, { color: colors.mutedForeground }]}>
                  Optional — adds you to the video
                </Text>
                <View style={styles.sourceActions}>
                  <TouchableOpacity
                    style={[styles.sourceBtn, { backgroundColor: colors.muted }]}
                    onPress={pickSource}
                  >
                    <Ionicons name="images" size={15} color={colors.foreground} />
                    <Text style={[styles.sourceBtnText, { color: colors.foreground }]}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sourceBtn, { backgroundColor: colors.muted }]}
                    onPress={takePhoto}
                  >
                    <Ionicons name="camera" size={15} color={colors.foreground} />
                    <Text style={[styles.sourceBtnText, { color: colors.foreground }]}>Camera</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Prompt */}
        <View
          style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Describe the scene, movement, atmosphere…"
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
          {VIDEO_STYLES.map((s) => {
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
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Duration */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Duration</Text>
        <View style={styles.durationRow}>
          {DURATIONS.map((d) => {
            const active = d === duration;
            return (
              <TouchableOpacity
                key={d}
                style={[
                  styles.durationBtn,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    flex: 1,
                  },
                ]}
                onPress={() => {
                  setDuration(d);
                  Haptics.selectionAsync();
                }}
              >
                <Text
                  style={[
                    styles.durationText,
                    { color: active ? '#fff' : colors.mutedForeground },
                  ]}
                >
                  {d}s
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Estimated credits */}
        <View
          style={[styles.costRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="flash" size={14} color={colors.accent} />
          <Text style={[styles.costText, { color: colors.mutedForeground }]}>
            {duration === 5 ? '~12' : '~20'} credits · {duration}s {selectedStyle} video
          </Text>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, { opacity: isGenerating ? 0.7 : 1 }]}
          onPress={handleGenerate}
          disabled={isGenerating}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#D946EF', '#7C3AED']}
            style={styles.generateGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.generateText}>
                  {statusData?.status === 'processing' ? 'Rendering…' : 'Generating…'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="film" size={20} color="#fff" />
                <Text style={styles.generateText}>Generate Video</Text>
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
  sourceBox: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourcePreview: { width: '100%', height: '100%' },
  sourceOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changePhotoText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_500Medium' },
  cameraBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 8,
  },
  sourcePlaceholder: { alignItems: 'center', gap: 8, padding: 20 },
  sourcePlaceholderTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  sourcePlaceholderSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  sourceActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sourceBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  resultBox: { gap: 12 },
  resultImage: { width: '100%', height: 200, borderRadius: 16 },
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
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  inputWrapper: { borderRadius: 14, borderWidth: 1, padding: 14, minHeight: 80 },
  input: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  sectionLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: -8 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  durationRow: { flexDirection: 'row', gap: 10 },
  durationBtn: { alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  durationText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
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
