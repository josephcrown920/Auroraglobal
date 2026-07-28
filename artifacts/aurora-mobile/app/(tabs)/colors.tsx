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
import {
  useGeneratePhoto,
  useGetGenerationStatus,
} from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useShareDownload } from '@/hooks/useShareDownload';

const { width } = Dimensions.get('window');
const STYLES = ['cinematic', 'editorial', 'performance', 'concert', 'portrait', 'studio'] as const;
const RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const;

type PhotoStyle = (typeof STYLES)[number];
type AspectRatio = (typeof RATIOS)[number];

export default function ColorsStudioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [referenceUri, setReferenceUri] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<PhotoStyle>('cinematic');
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('3:4');
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const generateMutation = useGeneratePhoto();

  // Poll for generation result
  const { data: statusData } = useGetGenerationStatus(jobId ?? '', {
    query: {
      enabled: !!jobId && !resultUrl,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === 'completed' || status === 'failed') return false;
        return 2500;
      },
    },
  });

  // React to completed status outside select to avoid side effects in pure fn
  React.useEffect(() => {
    if (statusData?.status === 'completed' && statusData.outputUrl) {
      setResultUrl(statusData.outputUrl);
      setJobId(null);
    }
  }, [statusData?.status, statusData?.outputUrl]);

  const isGenerating = !!jobId || generateMutation.isPending;

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setReferenceUri(result.assets[0].uri);
      setResultUrl(null);
    }
  }, []);

  const takeSelfie = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setReferenceUri(result.assets[0].uri);
      setResultUrl(null);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      Alert.alert('Add a prompt', 'Describe your desired photo to get started.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResultUrl(null);
    try {
      const job = await generateMutation.mutateAsync({
        data: {
          prompt: prompt.trim(),
          style: selectedStyle,
          aspectRatio: selectedRatio,
          referenceImageUrl: referenceUri ?? undefined,
        },
      });
      setJobId(job.id);
    } catch (err: any) {
      const msg = err?.message ?? 'Generation failed. Check your credits.';
      Alert.alert('Error', msg);
    }
  }, [prompt, selectedStyle, selectedRatio, referenceUri, generateMutation]);

  const { shareMedia, saveToLibrary, isSharing, isSaving } = useShareDownload();

  const handleReset = () => {
    setResultUrl(null);
    setJobId(null);
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
        colors={['rgba(124,58,237,0.22)', 'transparent']}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Colors Studio</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          AI performance photography
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        {/* Result or reference image */}
        {resultUrl ? (
          <View style={styles.resultContainer}>
            <Image
              source={{ uri: resultUrl }}
              style={styles.resultImage}
              contentFit="cover"
              transition={400}
            />
            <View style={styles.resultActions}>
              <TouchableOpacity
                style={[styles.resultBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={handleReset}
              >
                <Ionicons name="refresh" size={18} color={colors.foreground} />
                <Text style={[styles.resultBtnText, { color: colors.foreground }]}>New</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resultBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => saveToLibrary(resultUrl!, 'photo')}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <Ionicons name="download-outline" size={18} color={colors.foreground} />
                )}
                <Text style={[styles.resultBtnText, { color: colors.foreground }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resultBtn, { backgroundColor: colors.primary }]}
                onPress={() => shareMedia(resultUrl!, 'photo')}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="share-outline" size={18} color="#fff" />
                )}
                <Text style={[styles.resultBtnText, { color: '#fff' }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Reference image picker */
          <View style={styles.captureRow}>
            <TouchableOpacity
              style={[styles.captureBox, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={takeSelfie}
              activeOpacity={0.8}
            >
              {referenceUri ? (
                <Image source={{ uri: referenceUri }} style={styles.capturePreview} contentFit="cover" />
              ) : (
                <View style={styles.capturePlaceholder}>
                  <Ionicons name="camera" size={28} color={colors.primary} />
                  <Text style={[styles.captureLabel, { color: colors.mutedForeground }]}>Selfie</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.captureBox, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              {referenceUri ? (
                <TouchableOpacity style={styles.clearBtn} onPress={() => setReferenceUri(null)}>
                  <Ionicons name="close-circle" size={22} color={colors.destructive} />
                </TouchableOpacity>
              ) : (
                <View style={styles.capturePlaceholder}>
                  <Ionicons name="images" size={28} color={colors.secondary} />
                  <Text style={[styles.captureLabel, { color: colors.mutedForeground }]}>Gallery</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Prompt */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Describe your look, mood, lighting…"
            placeholderTextColor={colors.mutedForeground}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            maxLength={400}
          />
        </View>

        {/* Style chips */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Style</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {STYLES.map((s) => {
            const active = s === selectedStyle;
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setSelectedStyle(s);
                  Haptics.selectionAsync();
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#fff' : colors.mutedForeground },
                  ]}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Aspect Ratio */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Aspect Ratio</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {RATIOS.map((r) => {
            const active = r === selectedRatio;
            return (
              <TouchableOpacity
                key={r}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.secondary : colors.card,
                    borderColor: active ? colors.secondary : colors.border,
                  },
                ]}
                onPress={() => {
                  setSelectedRatio(r);
                  Haptics.selectionAsync();
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#fff' : colors.mutedForeground },
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Generate Button */}
        <TouchableOpacity
          style={[
            styles.generateBtn,
            { opacity: isGenerating ? 0.7 : 1 },
          ]}
          onPress={handleGenerate}
          disabled={isGenerating}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7C3AED', '#D946EF']}
            style={styles.generateGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.generateText}>
                  {statusData?.status === 'processing' ? 'Processing…' : 'Generating…'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.generateText}>Generate Photo</Text>
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
  captureRow: { flexDirection: 'row', gap: 12 },
  captureBox: {
    flex: 1,
    height: 140,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturePreview: { width: '100%', height: '100%' },
  capturePlaceholder: { alignItems: 'center', gap: 8 },
  captureLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  clearBtn: { padding: 6 },
  resultContainer: { gap: 12 },
  resultImage: { width: '100%', height: width * 0.9, borderRadius: 14 },
  resultActions: { flexDirection: 'row', gap: 8 },
  resultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  resultBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  inputWrapper: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 80,
  },
  input: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  sectionLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: -8 },
  chipScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
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
