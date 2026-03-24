import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputContentSizeChangeEventData,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassSurface from '@/components/glass-surface';
import PromptHistoryPreviewCard from '@/components/prompt-history-preview-card';
import SceneFrame from '@/components/scene-frame';
import { SceneEditorProvider, useSceneEditor } from '@/context/scene-editor-context';
import { useSceneCollaborationFeed } from '@/hooks/use-scene-collaboration-feed';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useWebKeyboardControls } from '@/hooks/use-web-keyboard-controls';
import { getEditorPalette } from '@/lib/editor/editor-palette';
import { getPromptTelemetryMock } from '@/lib/editor/prompt-telemetry';
import { buildSceneUrl, DEFAULT_SCENE_BASE_URL, getSceneOption, resolveMode } from '@/lib/scene-config';
import type { AssetReference, HistoryEntry, SlotHint } from '@/types/editor';

const SLOT_HINTS: SlotHint[] = ['walk', 'kill', 'seed', 'idle'];
const VOICE_PROCESS_THRESHOLD = 52;
const MIN_INPUT_HEIGHT = 56;
const MAX_INPUT_HEIGHT = 120;

type AssistantThreadEntry = {
  id: string;
  agent: string;
  fullText: string;
  label: string;
  slot?: SlotHint;
  timestamp: string;
  type: 'assistant';
  isStreaming: boolean;
};

type ThreadMessage =
  | {
      id: string;
      timestamp: string;
      type: 'assistant';
      entry: AssistantThreadEntry;
    }
  | {
      id: string;
      timestamp: string;
      type: 'history';
      entry: HistoryEntry;
    };

const TOOL_ACTIONS = [
  {
    id: 'image2sprite',
    label: 'Image2sprite',
    prompt:
      'Turn the latest multi-photo phone upload into sprite-ready cutouts with consistent framing, naming, and animation grouping.',
    subtitle: 'Batch multiple phone photos into sprite packs.',
    symbol: { ios: 'photo.stack', android: 'collections', web: 'collections' } as const,
  },
  {
    id: 'space-scan',
    label: '3D space scan',
    prompt:
      'Use iPhone room scan data to block out the scene in correct scale, then suggest lighting anchors and collision-safe paths.',
    subtitle: 'Capture and reuse a real room volume from iPhone.',
    symbol: { ios: 'viewfinder.circle', android: 'view_in_ar', web: 'view_in_ar' } as const,
  },
];

const AGENT_PLAYBOOKS = [
  {
    id: 'scene-director-md',
    fileName: 'scene-director.md',
    prompt:
      'Load scene-director.md and plan the next beat with shot intent, pacing, lighting changes, and player focus cues.',
    subtitle: 'Camera, pacing, blocking, and tone instructions.',
  },
  {
    id: 'asset-librarian-md',
    fileName: 'asset-librarian.md',
    prompt:
      'Load asset-librarian.md and organize attached references by genre, file type, naming, and delivery priority.',
    subtitle: 'Asset organization, naming, tagging, and shelf hygiene.',
  },
  {
    id: 'service-orchestrator-md',
    fileName: 'service-orchestrator.md',
    prompt:
      'Load service-orchestrator.md and map the next prompt to the required service calls, background jobs, and agent handoffs.',
    subtitle: 'Instruction bundles plus service-call routing.',
  },
];

const ASSISTANT_OPTIONS = [
  {
    id: 'codex',
    label: 'Codex',
    note: 'tool-first scene edits',
  },
  {
    id: 'claude',
    label: 'Claude',
    note: 'long-form direction',
  },
  {
    id: 'gpt-5',
    label: 'GPT-5',
    note: 'balanced prompting',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    note: 'fast visual passes',
  },
] as const;

function formatTimeLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function describeEntry(entry: HistoryEntry) {
  if (entry.type === 'asset') {
    return 'asset workflow';
  }
  if (entry.type === 'voice') {
    return 'voice cue';
  }
  if (entry.type === 'photo') {
    return 'photo note';
  }
  return 'prompt';
}

function clampInputHeight(value: number) {
  return Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, value));
}

function buildUploadedAssetReference(asset: DocumentPicker.DocumentPickerAsset, slot: SlotHint): AssetReference {
  const uniqueKey = asset.uri || asset.name || `${Date.now()}`;
  const safeId = uniqueKey.replace(/[^a-zA-Z0-9-_:.]/g, '-');

  return {
    id: `upload-${safeId}`,
    license: 'Private',
    metadata: {
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? null,
    },
    name: asset.name,
    source: 'upload',
    slot,
    thumbnail: asset.mimeType?.startsWith('image/') ? asset.uri : undefined,
    updatedAt: new Date().toISOString(),
    url: asset.uri,
  };
}

function formatAssetChipLabel(name: string) {
  return name.length > 18 ? `${name.slice(0, 15)}...` : name;
}

function buildAssistantReply(promptText: string, slot: SlotHint, assistantLabel: string) {
  const focus = promptText.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
  const shortFocus = focus.length > 96 ? `${focus.slice(0, 93)}...` : focus;
  return `${assistantLabel} is tuning the ${slot} pass. Focus first on: ${shortFocus}. Keep the staging readable, preserve the current scene rhythm, and hold heavier tool calls until you explicitly ask for them.`;
}

function buildVoiceReply(slot: SlotHint, assistantLabel: string) {
  return `${assistantLabel} is processing the ${slot} voice cue and folding it into the next scene pass with the current mood, camera, and asset context intact.`;
}

function AnimatedMessageCard({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        delay,
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        delay,
        bounciness: 6,
        speed: 18,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function EditorScreenContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    inputModel?: string | string[];
    mode?: string | string[];
    promptSessionId?: string | string[];
    sceneDraftId?: string | string[];
    title?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const palette = getEditorPalette(colorScheme);
  const { addAsset, addHistory, assets, collaborators, history, removeAsset, sessionId, setSlotHint, slotHint } =
    useSceneEditor();
  const { reset, startRecording, status, stopRecording } = useVoiceRecorder();
  const [sceneVersion] = useState(() => Date.now());
  const [draft, setDraft] = useState('');
  const [selectedAssistantId, setSelectedAssistantId] = useState<(typeof ASSISTANT_OPTIONS)[number]['id']>('codex');
  const [toolsSheetVisible, setToolsSheetVisible] = useState(false);
  const [assistantEntries, setAssistantEntries] = useState<AssistantThreadEntry[]>([]);
  const [composerInputHeight, setComposerInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [headerDockHeight, setHeaderDockHeight] = useState(168);
  const [composerDockHeight, setComposerDockHeight] = useState(168);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [voiceGestureState, setVoiceGestureState] = useState<'idle' | 'holding' | 'primed'>('idle');
  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const hasSceneMode = typeof rawMode === 'string' && rawMode.trim().length > 0;
  const mode = resolveMode(rawMode);
  const draftTitle = Array.isArray(params.title) ? params.title[0] : params.title;
  const sceneDraftId = Array.isArray(params.sceneDraftId) ? params.sceneDraftId[0] : params.sceneDraftId;
  const scene = getSceneOption(mode);
  const promptTelemetry = getPromptTelemetryMock(mode);
  const collaborationFeed = useSceneCollaborationFeed(mode, collaborators);
  const displayTitle = draftTitle?.trim() ? draftTitle : scene.label;
  const hasDraft = draft.trim().length > 0;
  const runCount = promptTelemetry.recentRuns.length + 1;
  const selectedAssistant = ASSISTANT_OPTIONS.find(option => option.id === selectedAssistantId) ?? ASSISTANT_OPTIONS[0];
  const chatScrollRef = useRef<ScrollView | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const activeAssistantStreamRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const scrollViewportHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const scrollY = useRef(new Animated.Value(0)).current;
  const actionMorphScale = useRef(new Animated.Value(1)).current;
  const threadEntries = useMemo(
    () =>
      [...history]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-10),
    [history],
  );
  const chatMessages = useMemo<ThreadMessage[]>(
    () =>
      ([
        ...assistantEntries.map(entry => ({
          entry,
          id: entry.id,
          timestamp: entry.timestamp,
          type: 'assistant' as const,
        })),
        ...threadEntries.map(entry => ({
          entry,
          id: entry.id,
          timestamp: entry.timestamp,
          type: 'history' as const,
        })),
      ] as ThreadMessage[]).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [assistantEntries, threadEntries],
  );
  const sceneUri = useMemo(
    () =>
      hasSceneMode
        ? buildSceneUrl(DEFAULT_SCENE_BASE_URL, mode, sceneVersion, {
            embedded: true,
          })
        : null,
    [hasSceneMode, mode, sceneVersion],
  );

  const composerHint = useMemo(() => {
    if (status === 'error') {
      return 'Mic capture failed. Retry or type the scene note instead.';
    }
    if (!sessionId) {
      return 'Prompt session is syncing. You can still queue the next instruction.';
    }
    return null;
  }, [sessionId, status]);

  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
  const liveCountLabel = `${collaborationFeed.activeCollaborators.length} live`;
  const overlayTopPadding = Platform.OS === 'ios' ? Math.max(insets.top + 40, 94) : Math.max(insets.top + 12, 24);
  const overlayBottomPadding = Math.max(insets.bottom, 14);
  const voiceGestureLift = useRef(new Animated.Value(0)).current;
  const voiceGestureScale = useRef(new Animated.Value(1)).current;
  const voiceGestureGlow = useRef(new Animated.Value(0)).current;
  const voiceGestureStartYRef = useRef<number | null>(null);
  const voiceGesturePrimedRef = useRef(false);
  const voiceStartPromiseRef = useRef<Promise<void> | null>(null);
  const statusRef = useRef(status);
  const composerActionMode = hasDraft ? 'send' : status === 'recording' || voiceGestureState !== 'idle' ? 'stop' : 'mic';

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    return () => {
      if (activeAssistantStreamRef.current) {
        clearInterval(activeAssistantStreamRef.current);
      }
    };
  }, []);

  useEffect(() => {
    actionMorphScale.setValue(0.9);
    Animated.spring(actionMorphScale, {
      bounciness: 8,
      speed: 18,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [actionMorphScale, composerActionMode]);

  const runSelectionHaptics = useCallback(() => {
    return Haptics.selectionAsync().catch(() => null);
  }, []);

  const runSuccessHaptics = useCallback(() => {
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
  }, []);

  const stopAssistantStream = useCallback((entryId?: string) => {
    if (activeAssistantStreamRef.current) {
      clearInterval(activeAssistantStreamRef.current);
      activeAssistantStreamRef.current = null;
    }

    const targetId = entryId ?? activeAssistantIdRef.current;
    if (!targetId) {
      return;
    }

    setAssistantEntries(prev =>
      prev.map(entry =>
        entry.id === targetId
          ? {
              ...entry,
              isStreaming: false,
            }
          : entry,
      ),
    );
    activeAssistantIdRef.current = null;
  }, []);

  const startAssistantStream = useCallback(
    ({
      agent,
      fullText,
      id,
      slot,
      timestamp,
    }: Omit<AssistantThreadEntry, 'label' | 'type' | 'isStreaming'>) => {
      stopAssistantStream();

      const words = fullText.split(' ');
      let revealCount = Math.min(3, words.length);
      activeAssistantIdRef.current = id;
      setAssistantEntries(prev => [
        ...prev.filter(entry => entry.id !== id),
        {
          agent,
          fullText,
          id,
          isStreaming: true,
          label: words.slice(0, revealCount).join(' '),
          slot,
          timestamp,
          type: 'assistant',
        },
      ]);

      activeAssistantStreamRef.current = setInterval(() => {
        revealCount = Math.min(words.length, revealCount + 2);
        setAssistantEntries(prev =>
          prev.map(entry =>
            entry.id === id
              ? {
                  ...entry,
                  isStreaming: revealCount < words.length,
                  label: words.slice(0, revealCount).join(' '),
                }
              : entry,
          ),
        );

        if (revealCount >= words.length && activeAssistantStreamRef.current) {
          clearInterval(activeAssistantStreamRef.current);
          activeAssistantStreamRef.current = null;
          activeAssistantIdRef.current = null;
        }
      }, 70);
    },
    [stopAssistantStream],
  );

  const resetVoiceGestureVisuals = useCallback(() => {
    Animated.parallel([
      Animated.spring(voiceGestureLift, {
        bounciness: 6,
        speed: 16,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(voiceGestureScale, {
        bounciness: 6,
        speed: 18,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(voiceGestureGlow, {
        duration: 160,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [voiceGestureGlow, voiceGestureLift, voiceGestureScale]);

  const armVoiceGestureVisuals = useCallback(() => {
    Animated.parallel([
      Animated.spring(voiceGestureScale, {
        bounciness: 8,
        speed: 18,
        toValue: 1.06,
        useNativeDriver: true,
      }),
      Animated.timing(voiceGestureGlow, {
        duration: 140,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [voiceGestureGlow, voiceGestureScale]);

  const setVoiceGesturePrimed = useCallback(
    (primed: boolean) => {
      if (voiceGesturePrimedRef.current === primed) {
        return;
      }

      voiceGesturePrimedRef.current = primed;
      setVoiceGestureState(primed ? 'primed' : 'holding');
      Animated.spring(voiceGestureScale, {
        bounciness: 8,
        speed: 20,
        toValue: primed ? 1.12 : 1.06,
        useNativeDriver: true,
      }).start();
      if (primed) {
        void runSelectionHaptics();
      }
    },
    [runSelectionHaptics, voiceGestureScale],
  );

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    setAssistantEntries([]);
    startAssistantStream({
      agent: promptTelemetry.activeRun.agent,
      fullText: promptTelemetry.activeRun.responsePreview,
      id: promptTelemetry.activeRun.id,
      slot: promptTelemetry.activeRun.slot,
      timestamp: promptTelemetry.activeRun.createdAt,
    });

    return () => {
      stopAssistantStream(promptTelemetry.activeRun.id);
    };
  }, [mode, promptTelemetry.activeRun.agent, promptTelemetry.activeRun.createdAt, promptTelemetry.activeRun.id, promptTelemetry.activeRun.responsePreview, promptTelemetry.activeRun.slot, startAssistantStream, stopAssistantStream]);

  const handleAssistantMenuOpen = useCallback(() => {
    const optionLabels = ASSISTANT_OPTIONS.map(option => option.label);
    const selectedIndex = ASSISTANT_OPTIONS.findIndex(option => option.id === selectedAssistantId);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: optionLabels.length,
          options: [...optionLabels, 'Cancel'],
          title: 'Choose assistant',
        },
        buttonIndex => {
          if (buttonIndex == null || buttonIndex === optionLabels.length) {
            return;
          }
          setSelectedAssistantId(ASSISTANT_OPTIONS[buttonIndex].id);
          void runSelectionHaptics();
        },
      );
      return;
    }

    Alert.alert(
      'Choose assistant',
      undefined,
      [
        ...ASSISTANT_OPTIONS.map(option => ({
          onPress: () => {
            setSelectedAssistantId(option.id);
            void runSelectionHaptics();
          },
          style: option.id === ASSISTANT_OPTIONS[selectedIndex]?.id ? ('default' as const) : undefined,
          text: option.label,
        })),
        {
          style: 'cancel' as const,
          text: 'Cancel',
        },
      ],
      { cancelable: true },
    );
  }, [runSelectionHaptics, selectedAssistantId]);

  const cycleSlot = useCallback(() => {
    const nextIndex = (SLOT_HINTS.indexOf(slotHint) + 1) % SLOT_HINTS.length;
    setSlotHint(SLOT_HINTS[nextIndex]);
    void runSelectionHaptics();
  }, [runSelectionHaptics, setSlotHint, slotHint]);

  const injectDraft = useCallback(
    (nextDraft: string, sheet?: 'tools') => {
      setDraft(nextDraft);
      setComposerInputHeight(MIN_INPUT_HEIGHT);
      if (sheet === 'tools') {
        setToolsSheetVisible(false);
      }
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      void runSelectionHaptics();
    },
    [runSelectionHaptics],
  );

  const handleAssetImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
        type: '*/*',
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      result.assets.forEach(asset => {
        addAsset(buildUploadedAssetReference(asset, slotHint));
      });
      void runSuccessHaptics();
    } catch (error) {
      void error;
      Alert.alert('Upload failed', 'Could not attach files right now.');
    }
  }, [addAsset, runSuccessHaptics, slotHint]);

  const queuePrompt = useCallback(
    (promptText: string) => {
      const nextDraft = promptText.trim();
      if (!nextDraft) {
        return;
      }

      const timestamp = new Date().toISOString();
      addHistory({
        label: nextDraft,
        slot: slotHint,
        timestamp,
        type: 'text',
      });
      startAssistantStream({
        agent: selectedAssistant.label,
        fullText: buildAssistantReply(nextDraft, slotHint, selectedAssistant.label),
        id: `assistant-${Date.now()}`,
        slot: slotHint,
        timestamp: new Date(Date.now() + 1).toISOString(),
      });
      void runSuccessHaptics();
    },
    [addHistory, runSuccessHaptics, selectedAssistant.label, slotHint, startAssistantStream],
  );

  const handleSend = useCallback(() => {
    const nextDraft = draft.trim();
    if (!nextDraft) {
      return;
    }

    queuePrompt(nextDraft);
    setDraft('');
    setComposerInputHeight(MIN_INPUT_HEIGHT);
  }, [draft, queuePrompt]);

  const finishVoiceCapture = useCallback(async () => {
    if (voiceStartPromiseRef.current) {
      await voiceStartPromiseRef.current.catch(() => null);
      voiceStartPromiseRef.current = null;
    }

    if (statusRef.current !== 'recording') {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => null);
    const audioUri = await stopRecording();
    if (!audioUri) {
      return;
    }

    addHistory({
      audioUri,
      label: `Voice cue captured for ${slotHint}`,
      slot: slotHint,
      timestamp: new Date().toISOString(),
      type: 'voice',
    });
    startAssistantStream({
      agent: selectedAssistant.label,
      fullText: buildVoiceReply(slotHint, selectedAssistant.label),
      id: `assistant-voice-${Date.now()}`,
      slot: slotHint,
      timestamp: new Date(Date.now() + 1).toISOString(),
    });
    reset();
    void runSuccessHaptics();
  }, [addHistory, reset, runSuccessHaptics, selectedAssistant.label, slotHint, startAssistantStream, stopRecording]);

  const handleRecord = useCallback(async () => {
    if (status === 'processing') {
      return;
    }

    if (status === 'recording') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => null);
      const audioUri = await stopRecording();
      if (!audioUri) {
        return;
      }

      addHistory({
        audioUri,
        label: `Voice cue captured for ${slotHint}`,
        slot: slotHint,
        timestamp: new Date().toISOString(),
        type: 'voice',
      });
      startAssistantStream({
        agent: selectedAssistant.label,
        fullText: buildVoiceReply(slotHint, selectedAssistant.label),
        id: `assistant-voice-${Date.now()}`,
        slot: slotHint,
        timestamp: new Date(Date.now() + 1).toISOString(),
      });
      reset();
      void runSuccessHaptics();
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);
    await startRecording();
  }, [addHistory, reset, runSuccessHaptics, selectedAssistant.label, slotHint, startRecording, startAssistantStream, status, stopRecording]);

  const handleInputContentSizeChange = useCallback((event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    setComposerInputHeight(clampInputHeight(event.nativeEvent.contentSize.height));
  }, []);

  const scrollToLatest = useCallback((animated = true) => {
    chatScrollRef.current?.scrollToEnd({ animated });
  }, []);

  const updateScrollState = useCallback((offsetY: number, viewportHeight: number, contentHeight: number) => {
    const distanceFromBottom = Math.max(0, contentHeight - (offsetY + viewportHeight));
    const nextShowScrollToLatest = distanceFromBottom > 140;
    isNearBottomRef.current = !nextShowScrollToLatest;
    setShowScrollToLatest(nextShowScrollToLatest);
  }, []);

  const handleChatLayout = useCallback((event: LayoutChangeEvent) => {
    scrollViewportHeightRef.current = event.nativeEvent.layout.height;
    updateScrollState(0, scrollViewportHeightRef.current, scrollContentHeightRef.current);
  }, [updateScrollState]);

  const handleHeaderDockLayout = useCallback((event: LayoutChangeEvent) => {
    setHeaderDockHeight(event.nativeEvent.layout.height);
  }, []);

  const handleComposerDockLayout = useCallback((event: LayoutChangeEvent) => {
    setComposerDockHeight(event.nativeEvent.layout.height);
  }, []);

  const handleChatScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      scrollViewportHeightRef.current = layoutMeasurement.height;
      scrollContentHeightRef.current = contentSize.height;
      updateScrollState(contentOffset.y, layoutMeasurement.height, contentSize.height);
    },
    [updateScrollState],
  );

  const handleChatContentSizeChange = useCallback(
    (_width: number, height: number) => {
      scrollContentHeightRef.current = height;
      if (isNearBottomRef.current) {
        requestAnimationFrame(() => {
          scrollToLatest(false);
        });
      }
    },
    [scrollToLatest],
  );

  const latestMessageId = chatMessages[chatMessages.length - 1]?.id;

  useEffect(() => {
    if (!latestMessageId || !isNearBottomRef.current) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollToLatest(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [latestMessageId, scrollToLatest]);

  const handleMessageAction = useCallback(
    async (message: ThreadMessage, action: 'copy' | 'edit' | 'resend') => {
      const label = message.entry.label;

      if (action === 'copy') {
        await Clipboard.setStringAsync(label);
        void runSelectionHaptics();
        return;
      }

      if (action === 'edit') {
        setDraft(label);
        setComposerInputHeight(MIN_INPUT_HEIGHT);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
        void runSelectionHaptics();
        return;
      }

      queuePrompt(label);
    },
    [queuePrompt, runSelectionHaptics],
  );

  const openMessageMenu = useCallback(
    (message: ThreadMessage) => {
      const actions = [
        {
          id: 'copy' as const,
          label: 'Copy',
        },
        {
          id: 'edit' as const,
          label: 'Edit',
        },
        {
          id: 'resend' as const,
          label: 'Resend',
        },
      ];

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            cancelButtonIndex: actions.length,
            options: [...actions.map(action => action.label), 'Cancel'],
            title: 'Message actions',
          },
          buttonIndex => {
            if (buttonIndex == null || buttonIndex === actions.length) {
              return;
            }
            void handleMessageAction(message, actions[buttonIndex].id);
          },
        );
        return;
      }

      Alert.alert('Message actions', undefined, [
        ...actions.map(action => ({
          onPress: () => {
            void handleMessageAction(message, action.id);
          },
          text: action.label,
        })),
        {
          style: 'cancel' as const,
          text: 'Cancel',
        },
      ]);
    },
    [handleMessageAction],
  );

  const handleVoicePressIn = useCallback(
    (pageY?: number) => {
      if (Platform.OS === 'web' || hasDraft || statusRef.current === 'processing' || statusRef.current === 'recording') {
        return;
      }

      voiceGestureStartYRef.current = pageY ?? null;
      voiceGesturePrimedRef.current = false;
      setVoiceGestureState('holding');
      armVoiceGestureVisuals();
      voiceStartPromiseRef.current = (async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);
        await startRecording();
      })();
    },
    [armVoiceGestureVisuals, hasDraft, startRecording],
  );

  const handleVoiceTouchMove = useCallback(
    (pageY?: number) => {
      if (Platform.OS === 'web' || voiceGestureState === 'idle' || voiceGestureStartYRef.current == null || pageY == null) {
        return;
      }

      const nextLift = Math.max(0, Math.min(72, voiceGestureStartYRef.current - pageY));
      voiceGestureLift.setValue(nextLift);
      setVoiceGesturePrimed(nextLift >= VOICE_PROCESS_THRESHOLD);
    },
    [setVoiceGesturePrimed, voiceGestureLift, voiceGestureState],
  );

  const endVoiceGesture = useCallback(
    async (shouldProcess: boolean) => {
      if (Platform.OS === 'web' || voiceGestureState === 'idle') {
        return;
      }

      voiceGestureStartYRef.current = null;
      voiceGesturePrimedRef.current = false;
      setVoiceGestureState('idle');
      resetVoiceGestureVisuals();

      if (shouldProcess) {
        await finishVoiceCapture();
        return;
      }

      if (voiceStartPromiseRef.current) {
        await voiceStartPromiseRef.current.catch(() => null);
        voiceStartPromiseRef.current = null;
      }

      if (statusRef.current === 'recording') {
        reset();
      }
    },
    [finishVoiceCapture, reset, resetVoiceGestureVisuals, voiceGestureState],
  );

  const voiceOrbStyle = useMemo(
    () => ({
      transform: [{ scale: voiceGestureScale }],
    }),
    [voiceGestureScale],
  );

  const voiceGestureArrowStyle = useMemo(
    () => ({
      opacity: voiceGestureGlow,
      transform: [
        {
          translateY: voiceGestureLift.interpolate({
            extrapolate: 'clamp',
            inputRange: [0, 72],
            outputRange: [0, -30],
          }),
        },
      ],
    }),
    [voiceGestureGlow, voiceGestureLift],
  );

  const voiceGestureGhostStyle = useMemo(
    () => ({
      opacity: voiceGestureGlow.interpolate({
        extrapolate: 'clamp',
        inputRange: [0, 1],
        outputRange: [0, 0.92],
      }),
      transform: [
        {
          translateY: voiceGestureLift.interpolate({
            extrapolate: 'clamp',
            inputRange: [0, 72],
            outputRange: [0, -44],
          }),
        },
        {
          scale: voiceGestureGlow.interpolate({
            extrapolate: 'clamp',
            inputRange: [0, 1],
            outputRange: [0.84, 1],
          }),
        },
      ],
    }),
    [voiceGestureGlow, voiceGestureLift],
  );

  const headerMetaAnimatedStyle = useMemo(
    () => ({
      opacity: scrollY.interpolate({
        extrapolate: 'clamp',
        inputRange: [0, 28, 92],
        outputRange: [1, 0.88, 0.24],
      }),
      transform: [
        {
          translateY: scrollY.interpolate({
            extrapolate: 'clamp',
            inputRange: [0, 92],
            outputRange: [0, -12],
          }),
        },
      ],
    }),
    [scrollY],
  );

  const composerActionMorphStyle = useMemo(
    () => ({
      transform: [{ scale: actionMorphScale }],
    }),
    [actionMorphScale],
  );

  const inputDynamicStyle = useMemo(
    () => ({
      paddingBottom: composerInputHeight > MIN_INPUT_HEIGHT + 4 ? 8 : 0,
      paddingTop: composerInputHeight > MIN_INPUT_HEIGHT + 4 ? 8 : 0,
      textAlignVertical: (composerInputHeight > MIN_INPUT_HEIGHT + 4 ? 'top' : 'center') as 'top' | 'center',
    }),
    [composerInputHeight],
  );

  useWebKeyboardControls([
    {
      handler: handleClose,
      keys: ['Escape'],
    },
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerBlurEffect: undefined,
          headerShadowVisible: false,
          headerShown: true,
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTintColor: '#fff7f1',
          headerTitleAlign: 'center',
          headerTransparent: true,
          title: '',
        }}
      />
      <Stack.Screen.Title>{displayTitle}</Stack.Screen.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View>
          <Pressable
            accessibilityLabel="open editor settings"
            accessibilityRole="button"
            accessible
            hitSlop={8}
            onPress={() => {
              setToolsSheetVisible(true);
              void runSelectionHaptics();
            }}
            testID="editor-settings-button">
            {({ pressed }) => (
              <View style={[styles.nativeHeaderIconButton, pressed && styles.buttonPressed]}>
                <SymbolView
                  name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
                  size={18}
                  tintColor="#fff7f1"
                  weight="semibold"
                />
              </View>
            )}
          </Pressable>
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.View>
          <Pressable
            accessibilityLabel="close editor"
            accessibilityRole="button"
            accessible
            hitSlop={8}
            onPress={handleClose}
            testID="editor-close-button">
            {({ pressed }) => (
              <View style={[styles.nativeHeaderIconButton, pressed && styles.buttonPressed]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={18}
                  tintColor="#fff7f1"
                  weight="bold"
                />
              </View>
            )}
          </Pressable>
        </Stack.Toolbar.View>
      </Stack.Toolbar>

      <KeyboardAvoidingView behavior={keyboardBehavior} style={styles.screen}>
        <StatusBar style="light" />

        {sceneUri ? (
          <View style={StyleSheet.absoluteFill}>
            <SceneFrame editorBackdropActive interactive testID="editor-scene-frame" uri={sceneUri} />
          </View>
        ) : (
          <View pointerEvents="none" style={styles.fallbackBackdrop}>
            <View style={styles.backdropGlowPrimary} />
            <View style={styles.backdropGlowSecondary} />
          </View>
        )}

        <View pointerEvents="none" style={styles.globalBlurLayer}>
          <GlassSurface style={styles.globalBlurSurface}>
            <View style={styles.globalBlurFill} />
          </GlassSurface>
        </View>
        <View pointerEvents="none" style={styles.sceneScrim} />
        <View pointerEvents="none" style={styles.topShade} />
        <View pointerEvents="none" style={styles.bottomShade} />

        <View
          style={styles.overlayLayer}
          testID="editor-chat-shell">
          <View
            onLayout={handleHeaderDockLayout}
            style={[
              styles.headerDock,
              {
                paddingHorizontal: 18,
                paddingTop: overlayTopPadding,
              },
            ]}>
            <View style={styles.sceneHeaderMeta}>
              <View style={styles.nativeHeaderLiveCount} testID="editor-live-count">
                <View style={styles.nativeHeaderLiveDot} />
                <Text style={styles.nativeHeaderLiveText}>{liveCountLabel}</Text>
              </View>
            </View>

            <Animated.View style={headerMetaAnimatedStyle}>
              <ScrollView
                contentContainerStyle={styles.headerMetaRow}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.headerMetaScroll}>
                <Pressable onPress={cycleSlot} testID="editor-slot-button">
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.headerPill,
                        {
                          backgroundColor: palette.accentMuted,
                          borderColor: palette.border,
                        },
                        pressed && styles.buttonPressed,
                      ]}>
                      <Text style={[styles.headerPillText, { color: palette.strongText }]}>slot {slotHint}</Text>
                    </View>
                  )}
                </Pressable>

                <View style={[styles.headerPill, { backgroundColor: palette.chip, borderColor: palette.border }]}>
                  <Text style={[styles.headerPillText, { color: palette.strongText }]}>{assets.length} refs</Text>
                </View>

                <Link
                  href={{
                    pathname: '/prompt-history',
                    params: {
                      mode,
                      promptSessionId: sessionId ?? undefined,
                      sceneDraftId,
                      title: displayTitle,
                    },
                  }}>
                  <Link.Trigger>
                    <Pressable
                      accessibilityLabel="Open prompt history"
                      accessibilityRole="button"
                      accessible
                      testID="editor-history-link">
                      {({ pressed }) => (
                        <View
                          style={[
                            styles.headerPill,
                            {
                              backgroundColor: palette.chip,
                              borderColor: palette.border,
                            },
                            pressed && styles.buttonPressed,
                          ]}>
                          <Text style={[styles.headerPillText, { color: palette.strongText }]}>{runCount} runs</Text>
                        </View>
                      )}
                    </Pressable>
                  </Link.Trigger>
                  {Platform.OS === 'ios' ? (
                    <Link.Preview style={{ width: 320, height: 252 }}>
                      <PromptHistoryPreviewCard mode={mode} />
                    </Link.Preview>
                  ) : null}
                </Link>

                {sceneDraftId ? (
                  <View style={[styles.headerPill, { backgroundColor: palette.chip, borderColor: palette.border }]}>
                    <Text style={[styles.headerPillText, { color: palette.strongText }]}>draft linked</Text>
                  </View>
                ) : null}
              </ScrollView>
            </Animated.View>
          </View>

          <Animated.ScrollView
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={[
              styles.chatContent,
              {
                paddingBottom: composerDockHeight + overlayBottomPadding + 20,
                paddingTop: headerDockHeight + 8,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={handleChatContentSizeChange}
            onLayout={handleChatLayout}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              listener: handleChatScroll,
              useNativeDriver: true,
            })}
            ref={chatScrollRef}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={styles.chatViewport}>
            <View style={styles.threadList}>
              {chatMessages.map((message, index) => {
                if (message.type === 'assistant') {
                  return (
                    <AnimatedMessageCard delay={Math.min(index * 28, 160)} key={message.id}>
                      <View style={[styles.messageRow, styles.messageRowLeft]}>
                        <Pressable delayLongPress={220} onLongPress={() => openMessageMenu(message)}>
                          <GlassSurface
                            style={[
                              styles.systemBubble,
                              {
                                backgroundColor: 'rgba(10,12,14,0.34)',
                                borderColor: palette.border,
                              },
                            ]}>
                            <Text style={styles.systemEyebrow}>{message.entry.agent}</Text>
                            <Text style={styles.systemText}>{message.entry.label}</Text>
                            <View style={styles.assistantBubbleFooter}>
                              <Text style={styles.assistantBubbleMeta}>
                                {message.entry.slot ? `${message.entry.slot} · ` : ''}
                                {message.entry.isStreaming ? 'streaming' : formatTimeLabel(message.entry.timestamp)}
                              </Text>
                              {message.entry.isStreaming ? (
                                <Pressable
                                  accessibilityLabel="stop streaming response"
                                  accessibilityRole="button"
                                  accessible
                                  onPress={() => stopAssistantStream(message.entry.id)}
                                  style={({ pressed }) => [
                                    styles.streamingStopButton,
                                    pressed && styles.buttonPressed,
                                  ]}>
                                  <Text style={styles.streamingStopText}>Stop</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </GlassSurface>
                        </Pressable>
                      </View>
                    </AnimatedMessageCard>
                  );
                }

                const systemEntry = message.entry.type === 'asset';

                return (
                  <AnimatedMessageCard delay={Math.min(index * 28, 160)} key={message.id}>
                    <View style={[styles.messageRow, systemEntry ? styles.messageRowLeft : styles.messageRowRight]}>
                      <Pressable delayLongPress={220} onLongPress={() => openMessageMenu(message)}>
                        <GlassSurface
                          style={[
                            styles.messageBubble,
                            systemEntry ? styles.messageBubbleSystem : styles.messageBubbleUser,
                          ]}>
                          <Text style={[styles.messageType, systemEntry && styles.messageTypeSystem]}>
                            {describeEntry(message.entry)}
                          </Text>
                          <Text style={[styles.messageText, systemEntry && styles.messageTextSystem]}>
                            {message.entry.label}
                          </Text>
                          <Text style={[styles.messageMeta, systemEntry && styles.messageMetaSystem]}>
                            {message.entry.slot ? `${message.entry.slot} · ` : ''}
                            {formatTimeLabel(message.entry.timestamp)}
                          </Text>
                        </GlassSurface>
                      </Pressable>
                    </View>
                  </AnimatedMessageCard>
                );
              })}
            </View>
          </Animated.ScrollView>

          {showScrollToLatest ? (
            <View
              pointerEvents="box-none"
              style={[styles.scrollLatestWrap, { bottom: composerDockHeight + 24 }]}>
              <Pressable
                accessibilityLabel="scroll to latest message"
                accessibilityRole="button"
                accessible
                onPress={() => scrollToLatest(true)}
                testID="editor-scroll-latest-button">
                {({ pressed }) => (
                  <GlassSurface
                    style={[
                      styles.scrollLatestButton,
                      {
                        backgroundColor: 'rgba(10,12,14,0.58)',
                        borderColor: palette.border,
                      },
                      pressed && styles.buttonPressed,
                    ]}>
                    <SymbolView
                      name={{ ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' }}
                      size={15}
                      tintColor={palette.strongText}
                      weight="semibold"
                    />
                    <Text style={[styles.scrollLatestText, { color: palette.strongText }]}>Latest</Text>
                  </GlassSurface>
                )}
              </Pressable>
            </View>
          ) : null}

          <View
            onLayout={handleComposerDockLayout}
            style={[
              styles.composerDock,
              {
                bottom: overlayBottomPadding,
                left: 18,
                right: 18,
              },
            ]}>
            <View style={styles.assistantRail}>
              <Pressable
                accessibilityLabel="choose assistant"
                accessibilityRole="button"
                accessible
                onPress={handleAssistantMenuOpen}
                testID="editor-assistant-select">
                {({ pressed }) => (
                  <GlassSurface
                    interactive
                    style={[
                      styles.assistantSelectButton,
                      {
                        backgroundColor: 'rgba(10,12,14,0.48)',
                        borderColor: palette.border,
                      },
                      pressed && styles.buttonPressed,
                    ]}>
                    <View style={styles.assistantSelectCopy}>
                      <Text style={[styles.assistantSelectEyebrow, { color: palette.mutedText }]}>Talking to</Text>
                      <Text style={[styles.assistantSelectLabel, { color: palette.strongText }]}>
                        {selectedAssistant.label}
                      </Text>
                    </View>
                    <SymbolView
                      name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
                      size={16}
                      tintColor={palette.strongText}
                      weight="semibold"
                    />
                  </GlassSurface>
                )}
              </Pressable>

              {assets.length ? (
                <ScrollView
                  contentContainerStyle={styles.assetPreviewRow}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.assetPreviewScroll}
                  testID="editor-asset-preview-row">
                  {assets.map(asset => (
                    <GlassSurface
                      key={asset.id}
                      style={[
                        styles.assetPreviewCard,
                        {
                          backgroundColor: 'rgba(10,12,14,0.54)',
                          borderColor: palette.border,
                        },
                      ]}
                      testID={`editor-asset-preview-${asset.id}`}>
                      {asset.thumbnail ? (
                        <Image
                          contentFit="cover"
                          source={{ uri: asset.thumbnail }}
                          style={styles.assetPreviewThumb}
                        />
                      ) : (
                        <View style={styles.assetPreviewFallback}>
                          <SymbolView
                            name={{ ios: 'cube.box.fill', android: 'deployed_code', web: 'deployed_code' }}
                            size={14}
                            tintColor="#d8f7e8"
                            weight="semibold"
                          />
                        </View>
                      )}
                      <View style={styles.assetPreviewCopy}>
                        <Text numberOfLines={1} style={styles.assetPreviewName}>
                          {formatAssetChipLabel(asset.name)}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityLabel={`remove ${asset.name}`}
                        accessibilityRole="button"
                        accessible
                        hitSlop={8}
                        onPress={() => removeAsset(asset.id)}
                        style={({ pressed }) => [styles.assetPreviewRemoveButton, pressed && styles.buttonPressed]}
                        testID={`editor-remove-asset-${asset.id}`}>
                        <SymbolView
                          name={{ ios: 'xmark', android: 'close', web: 'close' }}
                          size={11}
                          tintColor="rgba(255,248,244,0.82)"
                          weight="bold"
                        />
                      </Pressable>
                    </GlassSurface>
                  ))}
                </ScrollView>
              ) : null}
            </View>

            <GlassSurface
              style={[
                styles.composer,
                {
                  backgroundColor: 'rgba(7,10,12,0.88)',
                  borderColor: palette.border,
                },
              ]}>
              <Pressable
                accessibilityLabel="attach files"
                accessibilityRole="button"
                accessible
                onPress={() => {
                  void handleAssetImport();
                }}
                style={({ pressed }) => [
                  styles.leadingIconButton,
                  {
                    backgroundColor: palette.chip,
                    borderColor: palette.border,
                  },
                  pressed && styles.buttonPressed,
                ]}
                testID="editor-assets-button">
                <SymbolView
                  name={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }}
                  size={17}
                  tintColor="#fff7f1"
                  weight="semibold"
                />
              </Pressable>

              <Pressable
                accessibilityLabel="open advanced tools"
                accessibilityRole="button"
                accessible
                onPress={() => {
                  setToolsSheetVisible(true);
                  void runSelectionHaptics();
                }}
                style={({ pressed }) => [
                  styles.leadingIconButton,
                  {
                    backgroundColor: palette.chip,
                    borderColor: palette.border,
                  },
                  pressed && styles.buttonPressed,
                ]}
                testID="editor-tools-button">
                <SymbolView
                  name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
                  size={18}
                  tintColor="#fff7f1"
                  weight="bold"
                />
              </Pressable>

              <TextInput
                onContentSizeChange={handleInputContentSizeChange}
                multiline
                onChangeText={setDraft}
                placeholder="Direct the next beat, mood, asset workflow, or service call..."
                placeholderTextColor="rgba(255,244,235,0.42)"
                ref={inputRef}
                style={[styles.input, inputDynamicStyle, { height: composerInputHeight }]}
                testID="editor-prompt-input"
                value={draft}
              />

              <View style={styles.voiceActionArea}>
                {voiceGestureState !== 'idle' ? (
                  <View pointerEvents="none" style={styles.voiceGestureTrack}>
                    <View style={styles.voiceGestureTrackLine} />
                    <Animated.View style={[styles.voiceGestureArrow, voiceGestureArrowStyle]}>
                      <SymbolView
                        name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
                        size={14}
                        tintColor="#d8f7e8"
                        weight="bold"
                      />
                    </Animated.View>
                    <Animated.View style={[styles.voiceGestureGhost, voiceGestureGhostStyle]}>
                      <SymbolView
                        name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
                        size={11}
                        tintColor="#d8f7e8"
                        weight="semibold"
                      />
                    </Animated.View>
                  </View>
                ) : null}

                <Animated.View style={voiceOrbStyle}>
                  <Animated.View style={composerActionMorphStyle}>
                    <Pressable
                      accessibilityLabel={hasDraft ? 'send prompt' : 'record voice cue'}
                      accessibilityRole="button"
                      accessible
                      disabled={status === 'processing'}
                      pressRetentionOffset={{
                        bottom: 40,
                        left: 40,
                        right: 40,
                        top: 320,
                      }}
                      onPress={
                        hasDraft
                          ? handleSend
                          : Platform.OS === 'web' || status === 'recording'
                            ? () => void handleRecord()
                            : undefined
                      }
                      onPressIn={event => handleVoicePressIn(event.nativeEvent.pageY)}
                      onPressMove={event => {
                        handleVoiceTouchMove(event.nativeEvent.pageY);
                      }}
                      onPressOut={() => {
                        void endVoiceGesture(voiceGesturePrimedRef.current);
                      }}
                      onTouchCancel={() => {
                        void endVoiceGesture(false);
                      }}
                      style={({ pressed }) => [
                        styles.voiceOrb,
                        (status === 'recording' || composerActionMode === 'stop') && styles.voiceOrbActive,
                        hasDraft && styles.voiceOrbSend,
                        pressed && styles.buttonPressed,
                        status === 'processing' && styles.voiceOrbDisabled,
                        voiceGestureState === 'primed' && styles.voiceOrbPrimed,
                      ]}
                      testID={hasDraft ? 'editor-send-button' : 'editor-voice-button'}>
                      <SymbolView
                        name={{
                          ios:
                            composerActionMode === 'send'
                              ? 'arrow.up'
                              : composerActionMode === 'stop'
                                ? 'stop.fill'
                                : 'mic.fill',
                          android:
                            composerActionMode === 'send'
                              ? 'arrow_upward'
                              : composerActionMode === 'stop'
                                ? 'stop'
                                : 'mic',
                          web:
                            composerActionMode === 'send'
                              ? 'arrow_upward'
                              : composerActionMode === 'stop'
                                ? 'stop'
                              : 'mic',
                        }}
                        size={17}
                        tintColor="#08110d"
                        weight="semibold"
                      />
                    </Pressable>
                  </Animated.View>
                </Animated.View>
              </View>
            </GlassSurface>

            {composerHint ? <Text style={[styles.composerHint, { color: palette.mutedText }]}>{composerHint}</Text> : null}
          </View>
        </View>

        <Modal
          animationType="fade"
          onRequestClose={() => setToolsSheetVisible(false)}
          transparent
          visible={toolsSheetVisible}>
          <View
            style={[
              styles.modalRoot,
              {
                paddingBottom: Math.max(insets.bottom, 12),
                paddingTop: Math.max(insets.top, 10),
              },
            ]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setToolsSheetVisible(false)} />
            <View style={styles.toolsPanelWrap} testID="editor-tools-sheet">
              <GlassSurface style={styles.toolsPanel}>
                <View style={styles.toolsHeader}>
                  <View style={styles.toolsHeaderCopy}>
                    <Text style={styles.toolsModalTitle}>Tools</Text>
                  </View>
                  <Pressable onPress={() => setToolsSheetVisible(false)} style={styles.sheetCloseButton}>
                    <SymbolView
                      name={{ ios: 'xmark', android: 'close', web: 'close' }}
                      size={16}
                      tintColor="#fff7f1"
                      weight="bold"
                    />
                  </Pressable>
                </View>

                <ScrollView
                  contentContainerStyle={styles.toolsContent}
                  contentInsetAdjustmentBehavior="automatic"
                  showsVerticalScrollIndicator={false}>
                  <View style={styles.toolsSection}>
                    <Text style={styles.sectionLabel}>Capture workflows</Text>
                    {TOOL_ACTIONS.map(action => (
                      <Pressable
                        key={action.id}
                        onPress={() => injectDraft(action.prompt, 'tools')}
                        testID={`editor-tool-${action.id}`}>
                        {({ pressed }) => (
                          <GlassSurface
                            interactive
                            style={[styles.toolCard, pressed && styles.buttonPressed]}>
                            <View style={styles.toolIcon}>
                              <SymbolView
                                name={action.symbol}
                                size={18}
                                tintColor="#fff7f1"
                                weight="semibold"
                              />
                            </View>
                            <View style={styles.toolCopy}>
                              <Text style={styles.toolTitle}>{action.label}</Text>
                            </View>
                          </GlassSurface>
                        )}
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.toolsSection}>
                    <Text style={styles.sectionLabel}>Agent playbooks</Text>
                    {AGENT_PLAYBOOKS.map(playbook => (
                      <Pressable
                        key={playbook.id}
                        onPress={() => injectDraft(playbook.prompt, 'tools')}
                        testID={`editor-playbook-${playbook.id}`}>
                        {({ pressed }) => (
                          <GlassSurface
                            interactive
                            style={[styles.playbookRow, pressed && styles.buttonPressed]}>
                            <View style={styles.playbookBadge}>
                              <Text style={styles.playbookBadgeText}>md</Text>
                            </View>
                            <View style={styles.toolCopy}>
                              <Text style={styles.toolTitle}>{playbook.fileName}</Text>
                            </View>
                          </GlassSurface>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </GlassSurface>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </>
  );
}

export default function EditorScreen() {
  const params = useLocalSearchParams<{
    promptSessionId?: string | string[];
    title?: string | string[];
  }>();
  const promptSessionId = Array.isArray(params.promptSessionId)
    ? params.promptSessionId[0]
    : params.promptSessionId;
  const title = Array.isArray(params.title) ? params.title[0] : params.title;

  return (
    <SceneEditorProvider initialSessionId={promptSessionId ?? null} initialSessionTitle={title ?? 'Scene editor draft'}>
      <EditorScreenContent />
    </SceneEditorProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050608',
  },
  fallbackBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050608',
    overflow: 'hidden',
  },
  backdropGlowPrimary: {
    backgroundColor: 'rgba(216,247,232,0.12)',
    borderRadius: 220,
    height: 340,
    left: -40,
    position: 'absolute',
    top: 80,
    width: 340,
  },
  backdropGlowSecondary: {
    backgroundColor: 'rgba(255,154,112,0.14)',
    borderRadius: 240,
    bottom: -80,
    height: 380,
    position: 'absolute',
    right: -60,
    width: 380,
  },
  globalBlurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  globalBlurSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  globalBlurFill: {
    flex: 1,
  },
  sceneScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,6,8,0.12)',
  },
  topShade: {
    backgroundColor: 'rgba(5,6,8,0.04)',
    height: '12%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  bottomShade: {
    backgroundColor: 'rgba(5,6,8,0.28)',
    bottom: 0,
    height: '24%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  overlayLayer: {
    flex: 1,
    position: 'relative',
  },
  headerDock: {
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 3,
  },
  sceneHeaderMeta: {
    alignItems: 'center',
    marginTop: 2,
  },
  headerMetaScroll: {
    backgroundColor: 'transparent',
    flexGrow: 0,
    height: 44,
    marginTop: 12,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#fff7f1',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  headerHint: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 520,
  },
  headerMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingRight: 18,
  },
  headerPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  headerPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nativeHeaderLiveCount: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    flexDirection: 'row',
    gap: 7,
    height: 30,
    justifyContent: 'center',
    minWidth: 74,
    paddingHorizontal: 11,
  },
  nativeHeaderLiveDot: {
    backgroundColor: '#d8f7e8',
    borderRadius: 999,
    height: 7,
    opacity: 0.92,
    width: 7,
  },
  nativeHeaderLiveText: {
    color: '#fff7f1',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  nativeHeaderIconButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  chatViewport: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  chatContent: {
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 2,
  },
  systemBubble: {
    alignSelf: 'flex-start',
    borderRadius: 22,
    borderWidth: 1,
    gap: 4,
    maxWidth: '76%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  systemEyebrow: {
    color: 'rgba(216,247,232,0.92)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  systemText: {
    color: 'rgba(255,248,244,0.82)',
    fontSize: 14,
    lineHeight: 19,
  },
  assistantBubbleFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  assistantBubbleMeta: {
    color: 'rgba(255,244,235,0.56)',
    fontSize: 11,
    fontWeight: '600',
  },
  streamingStopButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streamingStopText: {
    color: '#fff7f1',
    fontSize: 11,
    fontWeight: '700',
  },
  threadList: {
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    borderWidth: 1,
    borderRadius: 24,
    gap: 6,
    maxWidth: '88%',
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  messageBubbleSystem: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  messageBubbleUser: {
    backgroundColor: 'rgba(63,84,74,0.76)',
    borderColor: 'rgba(216,247,232,0.18)',
  },
  messageType: {
    color: 'rgba(216,247,232,0.74)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  messageTypeSystem: {
    color: 'rgba(255,248,244,0.72)',
  },
  messageText: {
    color: '#fff7f1',
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextSystem: {
    color: '#fff7f1',
  },
  messageMeta: {
    color: 'rgba(255,244,235,0.62)',
    fontSize: 11,
    fontWeight: '600',
  },
  messageMetaSystem: {
    color: 'rgba(255,244,235,0.58)',
  },
  composerDock: {
    gap: 8,
    position: 'absolute',
    zIndex: 3,
  },
  assistantRail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  assistantSelectRow: {
    alignItems: 'flex-start',
  },
  assistantSelectButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexShrink: 0,
  },
  assistantSelectCopy: {
    gap: 2,
  },
  assistantSelectEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  assistantSelectLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  assetPreviewScroll: {
    flex: 1,
  },
  assetPreviewRow: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 2,
  },
  assetPreviewCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  assetPreviewThumb: {
    borderRadius: 12,
    height: 36,
    width: 36,
  },
  assetPreviewFallback: {
    alignItems: 'center',
    backgroundColor: 'rgba(216,247,232,0.08)',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  assetPreviewCopy: {
    justifyContent: 'center',
    maxWidth: 108,
    minWidth: 0,
  },
  assetPreviewName: {
    color: '#fff7f1',
    fontSize: 12,
    fontWeight: '600',
  },
  assetPreviewRemoveButton: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  composer: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 70,
    overflow: 'visible',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leadingIconButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  input: {
    alignSelf: 'center',
    color: '#fff8f4',
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    paddingHorizontal: 2,
  },
  sendButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#d8f7e8',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  voiceOrb: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#d8f7e8',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  voiceOrbSend: {
    backgroundColor: '#d8f7e8',
  },
  voiceOrbActive: {
    backgroundColor: '#ffd6c2',
  },
  voiceOrbPrimed: {
    backgroundColor: '#d8f7e8',
  },
  voiceOrbDisabled: {
    opacity: 0.54,
  },
  voiceActionArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    overflow: 'visible',
  },
  voiceGestureTrack: {
    alignItems: 'center',
    bottom: 50,
    height: 82,
    justifyContent: 'flex-end',
    position: 'absolute',
    width: 56,
  },
  voiceGestureTrackLine: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    bottom: 6,
    height: 58,
    position: 'absolute',
    width: 2,
  },
  voiceGestureArrow: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,11,13,0.82)',
    borderColor: 'rgba(216,247,232,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 0,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    width: 24,
  },
  voiceGestureGhost: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,11,13,0.92)',
    borderColor: 'rgba(216,247,232,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 0,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    width: 22,
  },
  composerHint: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 6,
  },
  scrollLatestWrap: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 2,
  },
  scrollLatestButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scrollLatestText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  toolsPanelWrap: {
    maxWidth: 420,
    width: '100%',
  },
  sheetPanel: {
    borderRadius: 30,
    maxHeight: '76%',
    paddingBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderRadius: 999,
    height: 5,
    marginBottom: 12,
    width: 42,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  sheetCopy: {
    flex: 1,
    gap: 4,
  },
  sheetEyebrow: {
    color: '#ffd5c3',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    color: '#fff7f1',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sheetHint: {
    color: 'rgba(255,244,235,0.74)',
    fontSize: 13,
    lineHeight: 18,
  },
  sheetCloseButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  sheetContent: {
    gap: 14,
    paddingBottom: 4,
  },
  workflowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workflowChip: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  workflowText: {
    color: '#fff8f4',
    fontSize: 12,
    fontWeight: '700',
  },
  toolsPanel: {
    borderRadius: 24,
    maxHeight: '58%',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toolsHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  toolsHeaderCopy: {
    flex: 1,
  },
  toolsModalTitle: {
    color: '#fff7f1',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  toolsContent: {
    gap: 14,
    paddingBottom: 2,
  },
  toolsSection: {
    gap: 8,
  },
  sectionLabel: {
    color: '#d9f8e8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  toolCard: {
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toolIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  toolCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  toolTitle: {
    color: '#fff7f1',
    fontSize: 14,
    fontWeight: '700',
  },
  toolSubtitle: {
    color: 'rgba(255,244,235,0.72)',
    fontSize: 13,
    lineHeight: 18,
  },
  playbookRow: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  playbookBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(216,247,232,0.18)',
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  playbookBadgeText: {
    color: '#d8f7e8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
