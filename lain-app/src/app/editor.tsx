import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import Markdown from "@ronradtke/react-native-markdown-display";
import { Image } from "expo-image";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassSurface from "@/components/glass-surface";
import PromptHistoryPreviewCard from "@/components/prompt-history-preview-card";
import SceneFrame from "@/components/scene-frame";
import { useEditorPreferences } from "@/context/editor-preferences-context";
import {
  SceneEditorProvider,
  useSceneEditor,
} from "@/context/scene-editor-context";
import { useSceneRuntime } from "@/context/scene-runtime-context";
import { useSceneCollaborationFeed } from "@/hooks/use-scene-collaboration-feed";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useWebKeyboardControls } from "@/hooks/use-web-keyboard-controls";
import {
  PromptSessionApiError,
  respondToPrompt,
  transcribeVoiceRecording,
} from "@/lib/api/prompt-session";
import { getEditorPalette } from "@/lib/editor/editor-palette";
import {
  buildSceneUrl,
  DEFAULT_SCENE_BASE_URL,
  getSceneOption,
  resolveMode,
} from "@/lib/scene-config";
import {
  formatSceneBridgeSummary,
  parseSceneBridgeMessage,
} from "@/lib/runtime/scene-bridge";
import type {
  AssetReference,
  AssistantId,
  HistoryEntry,
  SlotHint,
} from "@/types/editor";

const SLOT_HINTS: SlotHint[] = ["walk", "kill", "seed", "idle"];
const VOICE_PROCESS_THRESHOLD = 52;
const COMPOSER_HEIGHT = 70;
const COMPOSER_STATUS_HEIGHT = 36;

type EditorPalette = ReturnType<typeof getEditorPalette>;
type ComposerStatusTone = "default" | "accent" | "warning";
type ComposerStatusAnimation = "none" | "pulse" | "spin";
type ComposerStatusDescriptor = {
  animation: ComposerStatusAnimation;
  icon: {
    ios: string;
    android: string;
    web: string;
  };
  key: string;
  message: string;
  tone: ComposerStatusTone;
};

type AssistantThreadEntry = {
  id: string;
  agent: string;
  fullText: string;
  label: string;
  source?: string;
  slot?: SlotHint;
  timestamp: string;
  type: "assistant";
  isStreaming: boolean;
};

type ThreadMessage =
  | {
      id: string;
      timestamp: string;
      type: "assistant";
      entry: AssistantThreadEntry;
    }
  | {
      id: string;
      timestamp: string;
      type: "history";
      entry: HistoryEntry;
    };

const TOOL_ACTIONS = [
  {
    id: "image2sprite",
    label: "Image2sprite",
    prompt:
      "Turn the latest multi-photo phone upload into sprite-ready cutouts with consistent framing, naming, and animation grouping.",
    subtitle: "Batch multiple phone photos into sprite packs.",
    symbol: {
      ios: "photo.stack",
      android: "collections",
      web: "collections",
    } as const,
  },
  {
    id: "space-scan",
    label: "3D space scan",
    prompt:
      "Use iPhone room scan data to block out the scene in correct scale, then suggest lighting anchors and collision-safe paths.",
    subtitle: "Capture and reuse a real room volume from iPhone.",
    symbol: {
      ios: "viewfinder.circle",
      android: "view_in_ar",
      web: "view_in_ar",
    } as const,
  },
];

const AGENT_PLAYBOOKS = [
  {
    id: "scene-director-md",
    fileName: "scene-director.md",
    prompt:
      "Load scene-director.md and plan the next beat with shot intent, pacing, lighting changes, and player focus cues.",
    subtitle: "Camera, pacing, blocking, and tone instructions.",
  },
  {
    id: "asset-librarian-md",
    fileName: "asset-librarian.md",
    prompt:
      "Load asset-librarian.md and organize attached references by genre, file type, naming, and delivery priority.",
    subtitle: "Asset organization, naming, tagging, and shelf hygiene.",
  },
  {
    id: "service-orchestrator-md",
    fileName: "service-orchestrator.md",
    prompt:
      "Load service-orchestrator.md and map the next prompt to the required service calls, background jobs, and agent handoffs.",
    subtitle: "Instruction bundles plus service-call routing.",
  },
];

const QUICK_TOOLS_MENU_ITEMS = [
  ...TOOL_ACTIONS.map((action) => ({
    id: action.id,
    label: action.label,
    prompt: action.prompt,
  })),
  ...AGENT_PLAYBOOKS.map((playbook) => ({
    id: playbook.id,
    label: playbook.fileName,
    prompt: playbook.prompt,
  })),
] as const;

const ASSISTANT_OPTIONS = [
  {
    id: "codex",
    label: "Codex",
    note: "tool-first scene edits",
  },
  {
    id: "claude",
    label: "Claude",
    note: "long-form direction",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    note: "balanced prompting",
  },
  {
    id: "gemini",
    label: "Gemini",
    note: "fast visual passes",
  },
] as const;

function formatTimeLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAssistantAgent(source: string | undefined, fallback: string) {
  if (source === "service-orchestrator") {
    return "Service Orchestrator";
  }

  return fallback;
}

function getAssistantDisplayText(entry: AssistantThreadEntry) {
  return entry.isStreaming ? entry.label : entry.fullText;
}

function isOrchestratorAssistant(entry: AssistantThreadEntry) {
  return entry.source === "service-orchestrator" || /orchestrator/i.test(entry.agent);
}

function describeEntry(entry: HistoryEntry) {
  if (entry.type === "asset") {
    return "asset workflow";
  }
  if (entry.type === "voice") {
    return "voice cue";
  }
  if (entry.type === "photo") {
    return "photo note";
  }
  return "prompt";
}

function buildUploadedAssetReference(
  asset: DocumentPicker.DocumentPickerAsset,
  slot: SlotHint,
): AssetReference {
  const uniqueKey = asset.uri || asset.name || `${Date.now()}`;
  const safeId = uniqueKey.replace(/[^a-zA-Z0-9-_:.]/g, "-");

  return {
    id: `upload-${safeId}`,
    license: "Private",
    metadata: {
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? null,
    },
    name: asset.name,
    source: "upload",
    slot,
    thumbnail: asset.mimeType?.startsWith("image/") ? asset.uri : undefined,
    updatedAt: new Date().toISOString(),
    url: asset.uri,
  };
}

function formatAssetChipLabel(name: string) {
  return name.length > 18 ? `${name.slice(0, 15)}...` : name;
}

function buildVoiceTranscriptionPrompt(slot: SlotHint) {
  return `Transcribe a short scene editor voice memo. Preserve scene-editing terminology and slot names like ${slot}.`;
}

function getPromptErrorMessage(error: unknown) {
  if (error instanceof PromptSessionApiError) {
    if (error.code === "MODEL_UNAVAILABLE") {
      return "Model backend is reachable, but no assistant provider is configured yet.";
    }
    if (error.code === "MODEL_NETWORK_ERROR") {
      return "Prompt backend is up, but the model provider is unreachable.";
    }
    if (error.code === "TRANSCRIPTION_NETWORK_ERROR") {
      return "Prompt backend is up, but the transcription provider is unreachable.";
    }
    if (error.code === "EMPTY_TRANSCRIPTION") {
      return "Voice cue was uploaded, but transcription returned empty text.";
    }
    return error.message;
  }

  return "Prompt reply failed. Your note stays in the local session.";
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

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function ComposerStatusGlyph({
  animation,
  color,
  icon,
}: {
  animation: ComposerStatusAnimation;
  color: string;
  icon: ComposerStatusDescriptor["icon"];
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.stopAnimation();

    if (animation === "spin") {
      progress.setValue(0);
      const loop = Animated.loop(
        Animated.timing(progress, {
          duration: 1100,
          easing: Easing.linear,
          toValue: 1,
          useNativeDriver: true,
        }),
      );
      loop.start();

      return () => {
        loop.stop();
        progress.stopAnimation();
      };
    }

    if (animation === "pulse") {
      progress.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            duration: 540,
            easing: Easing.inOut(Easing.ease),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(progress, {
            duration: 540,
            easing: Easing.inOut(Easing.ease),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();

      return () => {
        loop.stop();
        progress.stopAnimation();
      };
    }

    progress.setValue(0);

    return () => {
      progress.stopAnimation();
    };
  }, [animation, progress]);

  const animatedStyle = useMemo(() => {
    if (animation === "spin") {
      return {
        transform: [
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "360deg"],
            }),
          },
        ],
      };
    }

    if (animation === "pulse") {
      return {
        opacity: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.72, 1],
        }),
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.9, 1.08],
            }),
          },
        ],
      };
    }

    return undefined;
  }, [animation, progress]);

  return (
    <Animated.View style={[styles.composerStatusIconWrap, animatedStyle]}>
      <SymbolView name={icon} size={13} tintColor={color} weight="semibold" />
    </Animated.View>
  );
}

function ComposerStatusRow({
  palette,
  status,
}: {
  palette: EditorPalette;
  status: ComposerStatusDescriptor;
}) {
  const toneStyle = useMemo(() => {
    if (status.tone === "accent") {
      return {
        backgroundColor: palette.accentMuted,
        borderColor: palette.border,
        iconColor: palette.strongText,
        textColor: palette.strongText,
      };
    }

    if (status.tone === "warning") {
      return {
        backgroundColor: "rgba(255,214,194,0.16)",
        borderColor: "rgba(255,214,194,0.22)",
        iconColor: "#ffd6c2",
        textColor: "#fff1ea",
      };
    }

    return {
      backgroundColor: "rgba(255,255,255,0.06)",
      borderColor: palette.border,
      iconColor: palette.mutedText,
      textColor: palette.mutedText,
    };
  }, [palette, status.tone]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.composerStatusPill,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
      ]}
    >
      <ComposerStatusGlyph
        animation={status.animation}
        color={toneStyle.iconColor}
        icon={status.icon}
      />
      <Text
        numberOfLines={2}
        style={[styles.composerStatusText, { color: toneStyle.textColor }]}
      >
        {status.message}
      </Text>
    </View>
  );
}

function ComposerStatusBar({
  palette,
  status,
}: {
  palette: EditorPalette;
  status: ComposerStatusDescriptor | null;
}) {
  const currentOpacity = useRef(new Animated.Value(status ? 1 : 0)).current;
  const nextOpacity = useRef(new Animated.Value(0)).current;
  const [currentStatus, setCurrentStatus] = useState(status);
  const [nextStatus, setNextStatus] = useState<ComposerStatusDescriptor | null>(
    null,
  );

  useEffect(() => {
    const sameStatus =
      currentStatus?.key === status?.key &&
      currentStatus?.message === status?.message;
    const queuedSameStatus =
      nextStatus?.key === status?.key && nextStatus?.message === status?.message;
    if ((sameStatus && !nextStatus) || queuedSameStatus) {
      return;
    }

    currentOpacity.stopAnimation();
    nextOpacity.stopAnimation();

    if (!status) {
      setNextStatus(null);
      Animated.timing(currentOpacity, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setCurrentStatus(null);
        }
      });
      return;
    }

    if (!currentStatus) {
      setCurrentStatus(status);
      currentOpacity.setValue(0);
      nextOpacity.setValue(0);
      Animated.timing(currentOpacity, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }).start();
      return;
    }

    setNextStatus(status);
    nextOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(currentOpacity, {
        duration: 140,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(nextOpacity, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setCurrentStatus(status);
      setNextStatus(null);
      currentOpacity.setValue(1);
      nextOpacity.setValue(0);
    });
  }, [currentOpacity, currentStatus, nextOpacity, nextStatus, status]);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={styles.composerStatusBar}
      testID="editor-composer-status"
    >
      <View style={styles.composerStatusStack}>
        {currentStatus ? (
          <Animated.View
            style={[styles.composerStatusLayer, { opacity: currentOpacity }]}
          >
            <ComposerStatusRow palette={palette} status={currentStatus} />
          </Animated.View>
        ) : null}
        {nextStatus ? (
          <Animated.View
            style={[styles.composerStatusLayer, { opacity: nextOpacity }]}
          >
            <ComposerStatusRow palette={palette} status={nextStatus} />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function ProgressiveBlurOverlay({
  style,
  testID,
}: {
  style: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={[styles.progressiveBlurBase, style]}
      testID={testID}
    >
      <GlassSurface
        colorScheme="dark"
        glassEffectStyle="clear"
        style={styles.globalBlurSurface}
        tintColor="rgba(5,6,8,0.08)"
      />
      <GlassSurface
        colorScheme="dark"
        glassEffectStyle="regular"
        style={styles.progressiveBlurTopEdge}
        tintColor="rgba(5,6,8,0.14)"
      />
      <GlassSurface
        colorScheme="dark"
        glassEffectStyle="clear"
        style={styles.progressiveBlurTopMid}
        tintColor="rgba(5,6,8,0.08)"
      />
      <GlassSurface
        colorScheme="dark"
        glassEffectStyle="clear"
        style={styles.progressiveBlurCenter}
        tintColor="rgba(5,6,8,0.03)"
      />
      <GlassSurface
        colorScheme="dark"
        glassEffectStyle="clear"
        style={styles.progressiveBlurBottomMid}
        tintColor="rgba(5,6,8,0.1)"
      />
      <GlassSurface
        colorScheme="dark"
        glassEffectStyle="regular"
        style={styles.progressiveBlurBottomEdge}
        tintColor="rgba(5,6,8,0.18)"
      />
    </View>
  );
}

function MessageViewportShadow({
  edge,
  style,
  testID,
}: {
  edge: "top" | "bottom";
  style: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const isTop = edge === "top";

  return (
    <View
      pointerEvents="none"
      style={[styles.messageViewportShadow, style]}
      testID={testID}
    >
      <View
        style={[
          styles.messageViewportShadowFill,
          isTop
            ? styles.messageViewportShadowFillTop
            : styles.messageViewportShadowFillBottom,
        ]}
      />
      <View
        style={[
          styles.messageViewportShadowBand,
          isTop
            ? styles.messageViewportShadowBandTop
            : styles.messageViewportShadowBandBottom,
        ]}
      />
      <View
        style={[
          styles.messageViewportShadowEdge,
          isTop
            ? styles.messageViewportShadowEdgeTop
            : styles.messageViewportShadowEdgeBottom,
        ]}
      />
    </View>
  );
}

function EditorScreenContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    inputModel?: string | string[];
    mode?: string | string[];
    overlayScene?: string | string[];
    promptSessionId?: string | string[];
    sceneDraftId?: string | string[];
    title?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const palette = getEditorPalette(colorScheme);
  const orchestratorMarkdownStyles = {
    blockquote: {
      borderLeftColor: palette.accent,
      borderLeftWidth: 3,
      marginBottom: 12,
      marginLeft: 0,
      marginTop: 0,
      opacity: 0.9,
      paddingLeft: 12,
    },
    body: {
      color: palette.strongText,
      fontSize: 15,
      lineHeight: 22,
    },
    bullet_list: {
      marginBottom: 12,
      marginTop: 0,
    },
    bullet_list_content: {
      color: palette.strongText,
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
    },
    bullet_list_icon: {
      color: palette.accent,
      marginRight: 8,
    },
    code_block: {
      backgroundColor: palette.chip,
      borderRadius: 14,
      color: palette.strongText,
      marginBottom: 12,
      overflow: "hidden",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    code_inline: {
      backgroundColor: palette.chip,
      borderRadius: 8,
      color: palette.strongText,
      overflow: "hidden",
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    fence: {
      backgroundColor: palette.chip,
      borderRadius: 14,
      color: palette.strongText,
      marginBottom: 12,
      overflow: "hidden",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    heading1: {
      color: palette.strongText,
      fontSize: 23,
      fontWeight: "700",
      letterSpacing: -0.5,
      marginBottom: 12,
      marginTop: 0,
    },
    heading2: {
      color: palette.strongText,
      fontSize: 19,
      fontWeight: "700",
      letterSpacing: -0.3,
      marginBottom: 10,
      marginTop: 0,
    },
    heading3: {
      color: palette.strongText,
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 8,
      marginTop: 0,
    },
    hr: {
      backgroundColor: palette.border,
      height: 1,
      marginBottom: 12,
      marginTop: 4,
    },
    link: {
      color: palette.accent,
      textDecorationLine: "underline",
    },
    list_item: {
      marginBottom: 4,
    },
    ordered_list: {
      marginBottom: 12,
      marginTop: 0,
    },
    paragraph: {
      color: palette.strongText,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 12,
      marginTop: 0,
    },
    strong: {
      color: palette.strongText,
      fontWeight: "700",
    },
  };
  const {
    addAsset,
    addHistory,
    assets,
    collaborators,
    history,
    pendingHistoryCount,
    removeAsset,
    retrySession,
    sessionError,
    sessionId,
    sessionStatus,
    setSlotHint,
    slotHint,
  } = useSceneEditor();
  const { preferences, updatePreferences } = useEditorPreferences();
  const { reset, startRecording, status, stopRecording } = useVoiceRecorder();
  const [sceneVersion, setSceneVersion] = useState(() => Date.now());
  const [draft, setDraft] = useState("");
  const [selectedAssistantId, setSelectedAssistantId] = useState<AssistantId>(
    preferences.preferredAssistantId,
  );
  const [toolsSheetVisible, setToolsSheetVisible] = useState(false);
  const [assistantEntries, setAssistantEntries] = useState<
    AssistantThreadEntry[]
  >([]);
  const [assistantErrorMessage, setAssistantErrorMessage] = useState<
    string | null
  >(null);
  const [headerDockHeight, setHeaderDockHeight] = useState(168);
  const [composerDockHeight, setComposerDockHeight] = useState(168);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [voiceGestureState, setVoiceGestureState] = useState<
    "idle" | "holding" | "primed"
  >("idle");
  const toolsMenuReveal = useRef(new Animated.Value(0)).current;
  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const rawOverlayScene = Array.isArray(params.overlayScene)
    ? params.overlayScene[0]
    : params.overlayScene;
  const hasSceneMode = typeof rawMode === "string" && rawMode.trim().length > 0;
  const mode = resolveMode(rawMode);
  const { runtime, upsertSceneRuntime } = useSceneRuntime(mode);
  const shouldReusePresentedScene =
    Platform.OS !== "web" && rawOverlayScene === "1";
  const draftTitle = Array.isArray(params.title)
    ? params.title[0]
    : params.title;
  const sceneDraftId = Array.isArray(params.sceneDraftId)
    ? params.sceneDraftId[0]
    : params.sceneDraftId;
  const scene = getSceneOption(mode);
  const displayTitle = draftTitle?.trim() ? draftTitle : scene.label;
  const hasDraft = draft.trim().length > 0;
  const runCount = history.filter(
    (entry) => entry.type === "text" || entry.type === "voice",
  ).length;
  const selectedAssistant =
    ASSISTANT_OPTIONS.find((option) => option.id === selectedAssistantId) ??
    ASSISTANT_OPTIONS[0];
  const showPromptHistoryPreview = preferences.showPromptHistoryPreview;
  const showStatusPills = preferences.showStatusPills;
  const promptHistoryHref = useMemo(
    () => ({
      pathname: "/prompt-history" as const,
      params: {
        mode,
        promptSessionId: sessionId ?? undefined,
        sceneDraftId,
        title: displayTitle,
      },
    }),
    [displayTitle, mode, sceneDraftId, sessionId],
  );
  const liveContextMenuHref = useMemo(
    () => ({
      pathname: "/editor" as const,
      params: {
        mode,
        overlayScene: rawOverlayScene === "1" ? "1" : undefined,
        promptSessionId: sessionId ?? undefined,
        sceneDraftId,
        title: displayTitle,
      },
    }),
    [displayTitle, mode, rawOverlayScene, sceneDraftId, sessionId],
  );
  const editorSettingsHref = useMemo(
    () => ({
      pathname: "/editor-settings" as const,
      params: {
        assistantLabel: selectedAssistant.label,
        assistantNote: selectedAssistant.note,
        mode,
        overlayScene: rawOverlayScene === "1" ? "1" : undefined,
        pendingHistoryCount:
          pendingHistoryCount > 0 ? String(pendingHistoryCount) : undefined,
        promptSessionId: sessionId ?? undefined,
        sceneDraftId,
        sessionStatus,
        title: displayTitle,
      },
    }),
    [
      displayTitle,
      mode,
      pendingHistoryCount,
      rawOverlayScene,
      sceneDraftId,
      selectedAssistant.label,
      selectedAssistant.note,
      sessionId,
      sessionStatus,
    ],
  );
  const chatScrollRef = useRef<ScrollView | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const activeAssistantStreamRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const scrollViewportHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const editorSceneOverlayOpacity = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const actionMorphScale = useRef(new Animated.Value(1)).current;
  const threadEntries = useMemo(
    () =>
      [...history]
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        )
        .slice(-10),
    [history],
  );
  const chatMessages = useMemo<ThreadMessage[]>(
    () =>
      (
        [
          ...assistantEntries.map((entry) => ({
            entry,
            id: entry.id,
            timestamp: entry.timestamp,
            type: "assistant" as const,
          })),
          ...threadEntries.map((entry) => ({
            entry,
            id: entry.id,
            timestamp: entry.timestamp,
            type: "history" as const,
          })),
        ] as ThreadMessage[]
      ).sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
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
  const runtimeSummary = useMemo(
    () => formatSceneBridgeSummary(runtime.lastState),
    [runtime.lastState],
  );
  const runtimeStatusLabel = useMemo(() => {
    if (runtime.frameStatus === "error") {
      return "scene offline";
    }
    if (runtimeSummary) {
      return runtimeSummary;
    }
    if (runtime.frameStatus === "loading") {
      return "scene loading";
    }
    return shouldReusePresentedScene ? "scene linked" : "scene live";
  }, [runtime.frameStatus, runtimeSummary, shouldReusePresentedScene]);
  const latestHistoryEntry = useMemo(
    () =>
      [...history].sort(
        (left, right) =>
          new Date(right.timestamp).getTime() -
          new Date(left.timestamp).getTime(),
      )[0] ?? null,
    [history],
  );
  const collaborationFeed = useSceneCollaborationFeed(mode, collaborators, {
    latestActivityAt: latestHistoryEntry?.timestamp ?? runtime.lastUpdatedAt,
    latestActivityLabel: latestHistoryEntry?.label ?? null,
    pendingHistoryCount,
    runtimeSummary,
    sessionStatus,
  });

  const composerStatus = useMemo<ComposerStatusDescriptor | null>(() => {
    if (status === "recording") {
      return {
        animation: "pulse",
        icon: {
          ios: "mic.fill",
          android: "mic",
          web: "mic",
        },
        key: "recording",
        message: "Recording voice cue. Release when the take is ready.",
        tone: "accent",
      };
    }
    if (status === "processing" || status === "ready") {
      return {
        animation: "spin",
        icon: {
          ios: "waveform.circle.fill",
          android: "autorenew",
          web: "autorenew",
        },
        key: "processing",
        message: "Processing the latest voice cue for the next prompt pass.",
        tone: "accent",
      };
    }
    if (status === "error") {
      return {
        animation: "pulse",
        icon: {
          ios: "exclamationmark.triangle.fill",
          android: "warning",
          web: "warning",
        },
        key: "mic-error",
        message: "Mic capture failed. Retry or type the scene note instead.",
        tone: "warning",
      };
    }
    if (assistantErrorMessage && sessionStatus === "ready") {
      return {
        animation: "pulse",
        icon: {
          ios: "sparkles",
          android: "auto_awesome",
          web: "auto_awesome",
        },
        key: `assistant-error:${assistantErrorMessage}`,
        message: assistantErrorMessage,
        tone: "warning",
      };
    }
    if (sessionStatus === "syncing") {
      return {
        animation: "spin",
        icon: {
          ios: "arrow.triangle.2.circlepath",
          android: "sync",
          web: "sync",
        },
        key: "session-syncing",
        message:
          "Connecting to the prompt backend. You can still queue the next instruction.",
        tone: "default",
      };
    }
    if (sessionStatus === "offline") {
      return {
        animation: "pulse",
        icon: {
          ios: "wifi.exclamationmark",
          android: "wifi_off",
          web: "wifi_off",
        },
        key: `session-offline:${sessionError ?? "default"}`,
        message: sessionError?.trim()
          ? `${sessionError} Your notes stay local until retry.`
          : "Prompt backend offline. Your notes stay local until retry.",
        tone: "warning",
      };
    }
    return null;
  }, [assistantErrorMessage, sessionError, sessionStatus, status]);

  const keyboardBehavior = Platform.OS === "ios" ? "padding" : undefined;
  const liveCountLabel =
    collaborationFeed.activeCollaborators.length > 1
      ? `${collaborationFeed.activeCollaborators.length} active`
      : "local";
  const collaborationStatusSubtitle =
    collaborationFeed.socket.latencyMs == null
      ? collaborationFeed.socket.stateLabel
      : `${collaborationFeed.socket.stateLabel} · ${collaborationFeed.socket.latencyMs}ms`;
  const overlayTopPadding =
    Platform.OS === "ios"
      ? Math.max(insets.top + 40, 94)
      : Math.max(insets.top + 12, 24);
  const overlayBottomPadding = Math.max(insets.bottom, 14);
  const topMessageShadowHeight = 72;
  const bottomMessageShadowHeight = 120;

  const voiceGestureLift = useRef(new Animated.Value(0)).current;
  const voiceGestureScale = useRef(new Animated.Value(1)).current;
  const voiceGestureGlow = useRef(new Animated.Value(0)).current;
  const voiceGestureStartYRef = useRef<number | null>(null);
  const voiceGesturePrimedRef = useRef(false);
  const voiceStartPromiseRef = useRef<Promise<void> | null>(null);
  const statusRef = useRef(status);
  const composerActionMode = hasDraft
    ? "send"
    : status === "recording" || voiceGestureState !== "idle"
      ? "stop"
      : "mic";

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (selectedAssistantId !== preferences.preferredAssistantId) {
      setSelectedAssistantId(preferences.preferredAssistantId);
    }
  }, [preferences.preferredAssistantId, selectedAssistantId]);

  useEffect(() => {
    if (slotHint !== preferences.defaultSlotHint) {
      setSlotHint(preferences.defaultSlotHint);
    }
  }, [preferences.defaultSlotHint, setSlotHint, slotHint]);

  useEffect(() => {
    return () => {
      if (activeAssistantStreamRef.current) {
        clearInterval(activeAssistantStreamRef.current);
      }
    };
  }, []);

  useEffect(() => {
    editorSceneOverlayOpacity.setValue(0);
    Animated.timing(editorSceneOverlayOpacity, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [editorSceneOverlayOpacity]);

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
    return Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => null);
  }, []);

  const handleOpenPromptHistory = useCallback(() => {
    router.push(promptHistoryHref);
    void runSelectionHaptics();
  }, [promptHistoryHref, router, runSelectionHaptics]);

  const handleOpenSettings = useCallback(() => {
    router.push(editorSettingsHref as never);
    void runSelectionHaptics();
  }, [editorSettingsHref, router, runSelectionHaptics]);

  const selectAssistant = useCallback(
    (assistantId: (typeof ASSISTANT_OPTIONS)[number]["id"]) => {
      if (assistantId === selectedAssistantId) {
        return;
      }

      setSelectedAssistantId(assistantId);
      updatePreferences({ preferredAssistantId: assistantId });
      void runSelectionHaptics();
    },
    [runSelectionHaptics, selectedAssistantId, updatePreferences],
  );

  const handleCopySyncDetail = useCallback(async () => {
    await Clipboard.setStringAsync(collaborationFeed.socket.channel);
    void runSelectionHaptics();
  }, [collaborationFeed.socket.channel, runSelectionHaptics]);

  const handleCopyLatestActivity = useCallback(async () => {
    await Clipboard.setStringAsync(collaborationFeed.latestEvent.label);
    void runSelectionHaptics();
  }, [collaborationFeed.latestEvent.label, runSelectionHaptics]);

  const openLiveContextFallback = useCallback(() => {
    Alert.alert("Editor activity", collaborationFeed.latestEvent.label, [
      {
        onPress: handleOpenPromptHistory,
        text: "Prompt history",
      },
      {
        onPress: () => {
          void handleCopySyncDetail();
        },
        text: "Copy sync detail",
      },
      {
        onPress: () => {
          void handleCopyLatestActivity();
        },
        text: "Copy latest activity",
      },
      {
        style: "cancel" as const,
        text: "Cancel",
      },
    ]);
  }, [
    collaborationFeed.latestEvent.label,
    handleCopyLatestActivity,
    handleCopySyncDetail,
    handleOpenPromptHistory,
  ]);

  const openToolsMenu = useCallback(() => {
    setToolsSheetVisible(true);
    void runSelectionHaptics();
  }, [runSelectionHaptics]);

  const closeToolsMenu = useCallback(() => {
    setToolsSheetVisible(false);
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

    setAssistantEntries((prev) =>
      prev.map((entry) =>
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
  const removeAssistantEntry = useCallback((entryId: string) => {
    setAssistantEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    if (activeAssistantIdRef.current === entryId) {
      activeAssistantIdRef.current = null;
    }
  }, []);

  const startAssistantStream = useCallback(
    ({
      agent,
      fullText,
      id,
      source,
      slot,
      timestamp,
    }: Omit<AssistantThreadEntry, "label" | "type" | "isStreaming">) => {
      stopAssistantStream();

      const words = fullText.split(" ");
      let revealCount = Math.min(3, words.length);
      activeAssistantIdRef.current = id;
      setAssistantEntries((prev) => [
        ...prev.filter((entry) => entry.id !== id),
        {
          agent,
          fullText,
          id,
          isStreaming: true,
          label: words.slice(0, revealCount).join(" "),
          source,
          slot,
          timestamp,
          type: "assistant",
        },
      ]);

      activeAssistantStreamRef.current = setInterval(() => {
        revealCount = Math.min(words.length, revealCount + 2);
        setAssistantEntries((prev) =>
          prev.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  isStreaming: revealCount < words.length,
                  label: words.slice(0, revealCount).join(" "),
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
      setVoiceGestureState(primed ? "primed" : "holding");
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

  const handleRetrySession = useCallback(() => {
    setAssistantErrorMessage(null);
    void retrySession();
    void runSelectionHaptics();
  }, [retrySession, runSelectionHaptics]);

  const handleSceneFrameMessage = useCallback(
    (message: string) => {
      const nextState = parseSceneBridgeMessage(message);
      if (!nextState) {
        return;
      }

      upsertSceneRuntime(mode, {
        frameStatus: "ready",
        lastState: nextState,
        lastUpdatedAt: new Date().toISOString(),
      });
    },
    [mode, upsertSceneRuntime],
  );

  const handleSceneFrameError = useCallback(() => {
    upsertSceneRuntime(mode, {
      frameStatus: "error",
      lastUpdatedAt: new Date().toISOString(),
    });
  }, [mode, upsertSceneRuntime]);

  const handleSceneFrameLoadEnd = useCallback(() => {
    upsertSceneRuntime(mode, {
      frameStatus: "ready",
      lastUpdatedAt: new Date().toISOString(),
    });
  }, [mode, upsertSceneRuntime]);

  const handleSceneFrameLoadStart = useCallback(() => {
    upsertSceneRuntime(mode, {
      frameStatus: "loading",
      lastUpdatedAt: new Date().toISOString(),
    });
  }, [mode, upsertSceneRuntime]);

  const handleSceneRetry = useCallback(() => {
    setSceneVersion(Date.now());
    upsertSceneRuntime(mode, {
      frameStatus: "loading",
      lastUpdatedAt: new Date().toISOString(),
    });
    void runSelectionHaptics();
  }, [mode, runSelectionHaptics, upsertSceneRuntime]);

  const handleAssistantMenuOpen = useCallback(() => {
    const optionLabels = ASSISTANT_OPTIONS.map((option) => option.label);
    const selectedIndex = ASSISTANT_OPTIONS.findIndex(
      (option) => option.id === selectedAssistantId,
    );

    Alert.alert(
      "Choose assistant",
      undefined,
      [
        ...ASSISTANT_OPTIONS.map((option) => ({
          onPress: () => {
            selectAssistant(option.id);
          },
          style:
            option.id === ASSISTANT_OPTIONS[selectedIndex]?.id
              ? ("default" as const)
              : undefined,
          text: option.label,
        })),
        {
          style: "cancel" as const,
          text: "Cancel",
        },
      ],
      { cancelable: true },
    );
  }, [selectAssistant, selectedAssistantId]);

  const cycleSlot = useCallback(() => {
    const nextIndex = (SLOT_HINTS.indexOf(slotHint) + 1) % SLOT_HINTS.length;
    const nextSlotHint = SLOT_HINTS[nextIndex];
    setSlotHint(nextSlotHint);
    updatePreferences({ defaultSlotHint: nextSlotHint });
    void runSelectionHaptics();
  }, [runSelectionHaptics, setSlotHint, slotHint, updatePreferences]);

  const injectDraft = useCallback(
    (nextDraft: string, sheet?: "tools") => {
      setDraft(nextDraft);
      if (sheet === "tools") {
        setToolsSheetVisible(false);
      }
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      void runSelectionHaptics();
    },
    [runSelectionHaptics],
  );

  const openComposerToolsMenu = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: QUICK_TOOLS_MENU_ITEMS.length,
          message: "Capture workflows and agent playbooks",
          options: [
            ...QUICK_TOOLS_MENU_ITEMS.map((item) => item.label),
            "Cancel",
          ],
          title: "Quick tools",
        },
        (buttonIndex) => {
          if (
            buttonIndex == null ||
            buttonIndex === QUICK_TOOLS_MENU_ITEMS.length
          ) {
            return;
          }

          injectDraft(QUICK_TOOLS_MENU_ITEMS[buttonIndex].prompt);
        },
      );
      void runSelectionHaptics();
      return;
    }

    openToolsMenu();
  }, [injectDraft, openToolsMenu, runSelectionHaptics]);

  const handleAssetImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
        type: "*/*",
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      result.assets.forEach((asset) => {
        addAsset(buildUploadedAssetReference(asset, slotHint));
      });
      void runSuccessHaptics();
    } catch (error) {
      void error;
      Alert.alert("Upload failed", "Could not attach files right now.");
    }
  }, [addAsset, runSuccessHaptics, slotHint]);

  const requestAssistantReply = useCallback(
    async ({
      pendingAssistantId,
      promptText,
      sessionId,
      timestamp,
    }: {
      pendingAssistantId: string;
      promptText: string;
      sessionId: string;
      timestamp: string;
    }) => {
      setAssistantEntries((prev) => [
        ...prev.filter((entry) => entry.id !== pendingAssistantId),
        {
          agent: selectedAssistant.label,
          fullText: "Waiting for backend response...",
          id: pendingAssistantId,
          isStreaming: true,
          label: "Waiting for backend response...",
          slot: slotHint,
          timestamp,
          type: "assistant",
        },
      ]);

      try {
        const response = await respondToPrompt(sessionId, {
          assistantId: selectedAssistant.id,
          assistantLabel: selectedAssistant.label,
          sceneStateSummary: runtimeSummary,
          slot: slotHint,
          text: promptText,
        });
        removeAssistantEntry(pendingAssistantId);
        startAssistantStream({
          agent: formatAssistantAgent(
            response.message.source,
            selectedAssistant.label,
          ),
          fullText: response.message.text,
          id: response.message.id,
          source: response.message.source,
          slot:
            response.message.slot === "walk" ||
            response.message.slot === "kill" ||
            response.message.slot === "seed" ||
            response.message.slot === "idle"
              ? response.message.slot
              : undefined,
          timestamp: response.message.createdAt,
        });
      } catch (error) {
        removeAssistantEntry(pendingAssistantId);
        setAssistantErrorMessage(getPromptErrorMessage(error));
      }
    },
    [
      removeAssistantEntry,
      runtimeSummary,
      selectedAssistant.id,
      selectedAssistant.label,
      slotHint,
      startAssistantStream,
    ],
  );

  const submitCapturedVoice = useCallback(
    async (audioUri: string) => {
      const pendingAssistantId = `assistant-voice-pending-${Date.now()}`;
      const pendingTimestamp = new Date(Date.now() + 1).toISOString();

      setAssistantErrorMessage(null);
      setAssistantEntries((prev) => [
        ...prev.filter((entry) => entry.id !== pendingAssistantId),
        {
          agent: selectedAssistant.label,
          fullText: "Transcribing voice cue...",
          id: pendingAssistantId,
          isStreaming: true,
          label: "Transcribing voice cue...",
          slot: slotHint,
          timestamp: pendingTimestamp,
          type: "assistant",
        },
      ]);

      try {
        const transcription = await transcribeVoiceRecording(audioUri, {
          prompt: buildVoiceTranscriptionPrompt(slotHint),
        });
        const historyTimestamp = new Date().toISOString();
        const addResult = await addHistory({
          audioUri,
          label: transcription.text,
          slot: slotHint,
          timestamp: historyTimestamp,
          type: "voice",
        });

        void runSuccessHaptics();

        if (!addResult.persisted || !addResult.sessionId) {
          removeAssistantEntry(pendingAssistantId);
          return;
        }

        await requestAssistantReply({
          pendingAssistantId,
          promptText: transcription.text,
          sessionId: addResult.sessionId,
          timestamp: pendingTimestamp,
        });
      } catch (error) {
        removeAssistantEntry(pendingAssistantId);
        setAssistantErrorMessage(getPromptErrorMessage(error));
      } finally {
        reset();
      }
    },
    [
      addHistory,
      removeAssistantEntry,
      requestAssistantReply,
      reset,
      runSuccessHaptics,
      selectedAssistant.label,
      slotHint,
    ],
  );

  const queuePrompt = useCallback(
    async (promptText: string) => {
      const nextDraft = promptText.trim();
      if (!nextDraft) {
        return;
      }

      const timestamp = new Date().toISOString();
      const addResult = await addHistory({
        label: nextDraft,
        slot: slotHint,
        timestamp,
        type: "text",
      });

      setAssistantErrorMessage(null);
      void runSuccessHaptics();

      if (!addResult.persisted || !addResult.sessionId) {
        return;
      }
      await requestAssistantReply({
        pendingAssistantId: `assistant-pending-${Date.now()}`,
        promptText: nextDraft,
        sessionId: addResult.sessionId,
        timestamp: new Date(Date.now() + 1).toISOString(),
      });
    },
    [
      addHistory,
      requestAssistantReply,
      runSuccessHaptics,
      slotHint,
    ],
  );

  const handleSend = useCallback(() => {
    const nextDraft = draft.trim();
    if (!nextDraft) {
      return;
    }

    void queuePrompt(nextDraft);
    setDraft("");
  }, [draft, queuePrompt]);

  const finishVoiceCapture = useCallback(async () => {
    if (voiceStartPromiseRef.current) {
      await voiceStartPromiseRef.current.catch(() => null);
      voiceStartPromiseRef.current = null;
    }

    if (statusRef.current !== "recording") {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => null,
    );
    const audioUri = await stopRecording();
    if (!audioUri) {
      return;
    }

    await submitCapturedVoice(audioUri);
  }, [
    stopRecording,
    submitCapturedVoice,
  ]);

  const handleRecord = useCallback(async () => {
    if (status === "processing") {
      return;
    }

    if (status === "recording") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => null,
      );
      const audioUri = await stopRecording();
      if (!audioUri) {
        return;
      }

      await submitCapturedVoice(audioUri);
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => null,
    );
    await startRecording();
  }, [
    startRecording,
    status,
    stopRecording,
    submitCapturedVoice,
  ]);

  const scrollToLatest = useCallback((animated = true) => {
    chatScrollRef.current?.scrollToEnd({ animated });
  }, []);

  const updateScrollState = useCallback(
    (offsetY: number, viewportHeight: number, contentHeight: number) => {
      const distanceFromBottom = Math.max(
        0,
        contentHeight - (offsetY + viewportHeight),
      );
      const nextShowScrollToLatest = distanceFromBottom > 140;
      isNearBottomRef.current = !nextShowScrollToLatest;
      setShowScrollToLatest(nextShowScrollToLatest);
    },
    [],
  );

  const handleChatLayout = useCallback(
    (event: LayoutChangeEvent) => {
      scrollViewportHeightRef.current = event.nativeEvent.layout.height;
      updateScrollState(
        0,
        scrollViewportHeightRef.current,
        scrollContentHeightRef.current,
      );
    },
    [updateScrollState],
  );

  const handleHeaderDockLayout = useCallback((event: LayoutChangeEvent) => {
    setHeaderDockHeight(event.nativeEvent.layout.height);
  }, []);

  const handleComposerDockLayout = useCallback((event: LayoutChangeEvent) => {
    setComposerDockHeight(event.nativeEvent.layout.height);
  }, []);

  const handleChatScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      scrollViewportHeightRef.current = layoutMeasurement.height;
      scrollContentHeightRef.current = contentSize.height;
      updateScrollState(
        contentOffset.y,
        layoutMeasurement.height,
        contentSize.height,
      );
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

  const liveCountChip = (
    <Pressable
      accessibilityHint={
        Platform.OS === "ios"
          ? "Long press to open editor activity menu"
          : "Open editor activity actions"
      }
      accessibilityLabel={`${liveCountLabel}, ${collaborationFeed.socket.stateLabel}`}
      accessibilityRole="button"
      accessible
      delayLongPress={220}
      onLongPress={Platform.OS === "ios" ? undefined : openLiveContextFallback}
      onPress={Platform.OS === "ios" ? undefined : openLiveContextFallback}
      testID="editor-live-count"
    >
      {({ pressed }) => (
        <View
          style={[
            styles.nativeHeaderLiveCount,
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={styles.nativeHeaderLiveDot} />
          <Text style={styles.nativeHeaderLiveText}>{liveCountLabel}</Text>
        </View>
      )}
    </Pressable>
  );

  const liveCountTrigger =
    Platform.OS === "ios" ? (
      <Link
        href={liveContextMenuHref}
        onPress={(event) => {
          event.preventDefault();
        }}
      >
        <Link.Trigger>{liveCountChip}</Link.Trigger>
        <Link.Menu
          title="Editor activity"
          subtitle={collaborationFeed.socket.channel}
        >
          <Link.MenuAction
            disabled
            icon="wave.3.right.circle.fill"
            subtitle={collaborationStatusSubtitle}
          >
            {liveCountLabel}
          </Link.MenuAction>
          <Link.Menu icon="person.3.fill" title="Active now">
            {collaborationFeed.activeCollaborators.map((collaborator) => (
              <Link.MenuAction
                key={collaborator.id}
                disabled
                icon={
                  collaborator.id === "local-creator"
                    ? "person.crop.circle.fill.badge.checkmark"
                    : collaborator.status === "editing"
                      ? "pencil.circle.fill"
                      : collaborator.status === "reviewing"
                        ? "square.stack.3d.up.fill"
                        : "eye.circle.fill"
                }
                subtitle={collaborator.currentAction}
              >
                {collaborator.name} · {collaborator.roleLabel}
              </Link.MenuAction>
            ))}
          </Link.Menu>
          <Link.MenuAction icon="clock" onPress={handleOpenPromptHistory}>
            Prompt history
          </Link.MenuAction>
          <Link.MenuAction
            icon="dot.radiowaves.left.and.right"
            onPress={() => {
              void handleCopySyncDetail();
            }}
          >
            Copy sync detail
          </Link.MenuAction>
          <Link.MenuAction
            icon="doc.text"
            onPress={() => {
              void handleCopyLatestActivity();
            }}
          >
            Copy latest activity
          </Link.MenuAction>
        </Link.Menu>
      </Link>
    ) : (
      liveCountChip
    );

  const assistantSelectChip = (
    <Pressable
      accessibilityHint={
        Platform.OS === "ios"
          ? "Long press to open assistant menu"
          : "Choose assistant"
      }
      accessibilityLabel={`choose assistant, current ${selectedAssistant.label}`}
      accessibilityRole="button"
      accessible
      onPress={Platform.OS === "ios" ? undefined : handleAssistantMenuOpen}
      testID="editor-assistant-select"
    >
      {({ pressed }) => (
        <GlassSurface
          interactive
          style={[
            styles.assistantSelectButton,
            {
              backgroundColor: "rgba(10,12,14,0.48)",
              borderColor: palette.border,
            },
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={styles.assistantSelectCopy}>
            <Text
              style={[
                styles.assistantSelectEyebrow,
                { color: palette.mutedText },
              ]}
            >
              Talking to
            </Text>
            <Text
              style={[
                styles.assistantSelectLabel,
                { color: palette.strongText },
              ]}
            >
              {selectedAssistant.label}
            </Text>
          </View>
          <SymbolView
            name={{
              ios: "chevron.down",
              android: "expand_more",
              web: "expand_more",
            }}
            size={16}
            tintColor={palette.strongText}
            weight="semibold"
          />
        </GlassSurface>
      )}
    </Pressable>
  );

  const assistantSelectTrigger =
    Platform.OS === "ios" ? (
      <Link
        href={liveContextMenuHref}
        onPress={(event) => {
          event.preventDefault();
        }}
      >
        <Link.Trigger>{assistantSelectChip}</Link.Trigger>
        <Link.Menu title="Choose assistant" subtitle={selectedAssistant.note}>
          {ASSISTANT_OPTIONS.map((option) => (
            <Link.MenuAction
              discoverabilityLabel={option.note}
              icon={
                option.id === "codex"
                  ? "hammer.circle.fill"
                  : option.id === "claude"
                    ? "text.bubble.fill"
                    : option.id === "gpt-5"
                      ? "sparkles"
                      : "bolt.circle.fill"
              }
              isOn={option.id === selectedAssistantId}
              key={option.id}
              onPress={() => {
                selectAssistant(option.id);
              }}
              subtitle={option.note}
            >
              {option.label}
            </Link.MenuAction>
          ))}
        </Link.Menu>
      </Link>
    ) : (
      assistantSelectChip
    );

  useEffect(() => {
    if (toolsSheetVisible) {
      toolsMenuReveal.setValue(0);
      Animated.spring(toolsMenuReveal, {
        bounciness: 6,
        speed: 18,
        toValue: 1,
        useNativeDriver: true,
      }).start();
      return;
    }

    toolsMenuReveal.stopAnimation();
    toolsMenuReveal.setValue(0);
  }, [toolsMenuReveal, toolsSheetVisible]);

  const toolsPopoverAnimatedStyle = useMemo(
    () => ({
      opacity: toolsMenuReveal.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
      transform: [
        {
          translateY: toolsMenuReveal.interpolate({
            inputRange: [0, 1],
            outputRange: [18, 0],
          }),
        },
        {
          scale: toolsMenuReveal.interpolate({
            inputRange: [0, 1],
            outputRange: [0.96, 1],
          }),
        },
      ],
    }),
    [toolsMenuReveal],
  );

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
    async (message: ThreadMessage, action: "copy" | "edit" | "resend") => {
      const label = message.entry.label;

      if (action === "copy") {
        await Clipboard.setStringAsync(label);
        void runSelectionHaptics();
        return;
      }

      if (action === "edit") {
        setDraft(label);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
        void runSelectionHaptics();
        return;
      }

      void queuePrompt(label);
    },
    [queuePrompt, runSelectionHaptics],
  );

  const openMessageMenu = useCallback(
    (message: ThreadMessage) => {
      const actions = [
        {
          id: "copy" as const,
          label: "Copy",
        },
        {
          id: "edit" as const,
          label: "Edit",
        },
        {
          id: "resend" as const,
          label: "Resend",
        },
      ];

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            cancelButtonIndex: actions.length,
            options: [...actions.map((action) => action.label), "Cancel"],
            title: "Message actions",
          },
          (buttonIndex) => {
            if (buttonIndex == null || buttonIndex === actions.length) {
              return;
            }
            void handleMessageAction(message, actions[buttonIndex].id);
          },
        );
        return;
      }

      Alert.alert("Message actions", undefined, [
        ...actions.map((action) => ({
          onPress: () => {
            void handleMessageAction(message, action.id);
          },
          text: action.label,
        })),
        {
          style: "cancel" as const,
          text: "Cancel",
        },
      ]);
    },
    [handleMessageAction],
  );

  const handleVoicePressIn = useCallback(
    (pageY?: number) => {
      if (
        Platform.OS === "web" ||
        hasDraft ||
        statusRef.current === "processing" ||
        statusRef.current === "recording"
      ) {
        return;
      }

      voiceGestureStartYRef.current = pageY ?? null;
      voiceGesturePrimedRef.current = false;
      setVoiceGestureState("holding");
      armVoiceGestureVisuals();
      voiceStartPromiseRef.current = (async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => null,
        );
        await startRecording();
      })();
    },
    [armVoiceGestureVisuals, hasDraft, startRecording],
  );

  const handleVoiceTouchMove = useCallback(
    (pageY?: number) => {
      if (
        Platform.OS === "web" ||
        voiceGestureState === "idle" ||
        voiceGestureStartYRef.current == null ||
        pageY == null
      ) {
        return;
      }

      const nextLift = Math.max(
        0,
        Math.min(72, voiceGestureStartYRef.current - pageY),
      );
      voiceGestureLift.setValue(nextLift);
      setVoiceGesturePrimed(nextLift >= VOICE_PROCESS_THRESHOLD);
    },
    [setVoiceGesturePrimed, voiceGestureLift, voiceGestureState],
  );

  const endVoiceGesture = useCallback(
    async (shouldProcess: boolean) => {
      if (Platform.OS === "web" || voiceGestureState === "idle") {
        return;
      }

      voiceGestureStartYRef.current = null;
      voiceGesturePrimedRef.current = false;
      setVoiceGestureState("idle");
      resetVoiceGestureVisuals();

      if (shouldProcess) {
        await finishVoiceCapture();
        return;
      }

      if (voiceStartPromiseRef.current) {
        await voiceStartPromiseRef.current.catch(() => null);
        voiceStartPromiseRef.current = null;
      }

      if (statusRef.current === "recording") {
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
            extrapolate: "clamp",
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
        extrapolate: "clamp",
        inputRange: [0, 1],
        outputRange: [0, 0.92],
      }),
      transform: [
        {
          translateY: voiceGestureLift.interpolate({
            extrapolate: "clamp",
            inputRange: [0, 72],
            outputRange: [0, -44],
          }),
        },
        {
          scale: voiceGestureGlow.interpolate({
            extrapolate: "clamp",
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
        extrapolate: "clamp",
        inputRange: [0, 28, 92],
        outputRange: [1, 0.88, 0.24],
      }),
      transform: [
        {
          translateY: scrollY.interpolate({
            extrapolate: "clamp",
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

  const editorSceneOverlayAnimatedStyle = useMemo(
    () => ({
      opacity: editorSceneOverlayOpacity,
    }),
    [editorSceneOverlayOpacity],
  );

  useWebKeyboardControls([
    {
      handler: handleClose,
      keys: ["Escape"],
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
            backgroundColor: "transparent",
          },
          headerTintColor: "#fff7f1",
          headerTitleAlign: "center",
          headerTransparent: true,
          title: "",
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
            onPress={handleOpenSettings}
            testID="editor-settings-button"
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.nativeHeaderIconButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <SymbolView
                  name={{
                    ios: "gearshape.fill",
                    android: "settings",
                    web: "settings",
                  }}
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
            testID="editor-close-button"
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.nativeHeaderIconButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <SymbolView
                  name={{ ios: "xmark", android: "close", web: "close" }}
                  size={18}
                  tintColor="#fff7f1"
                  weight="bold"
                />
              </View>
            )}
          </Pressable>
        </Stack.Toolbar.View>
      </Stack.Toolbar>

      <KeyboardAvoidingView
        behavior={keyboardBehavior}
        style={[
          styles.screen,
          shouldReusePresentedScene && styles.transparentScreen,
        ]}
      >
        <StatusBar style="light" />

        {!shouldReusePresentedScene && sceneUri ? (
          <View style={StyleSheet.absoluteFill}>
            <SceneFrame
              editorBackdropActive
              hideSceneChrome={Platform.OS !== "web"}
              interactive
              onFrameError={handleSceneFrameError}
              onFrameLoadEnd={handleSceneFrameLoadEnd}
              onFrameLoadStart={handleSceneFrameLoadStart}
              onFrameMessage={handleSceneFrameMessage}
              onRetry={handleSceneRetry}
              retryTestID="editor-scene-retry-button"
              statusTestID="editor-scene-frame-status"
              testID="editor-scene-frame"
              uri={sceneUri}
            />
          </View>
        ) : !shouldReusePresentedScene ? (
          <View pointerEvents="none" style={styles.fallbackBackdrop}>
            <View style={styles.backdropGlowPrimary} />
            <View style={styles.backdropGlowSecondary} />
          </View>
        ) : null}

        <Animated.View
          pointerEvents="none"
          style={[
            styles.sceneOverlayTransitionLayer,
            editorSceneOverlayAnimatedStyle,
          ]}
          testID="editor-scene-overlay-transition"
        >
          <ProgressiveBlurOverlay
            style={styles.progressiveBlurFullscreen}
            testID="editor-scene-progressive-blur"
          />
        </Animated.View>

        <View
          collapsable={false}
          style={styles.overlayLayer}
          testID="editor-chat-shell"
        >
          <View
            onLayout={handleHeaderDockLayout}
            style={[
              styles.headerDock,
              {
                paddingTop: overlayTopPadding,
              },
            ]}
          >
            <View style={styles.sceneHeaderMeta}>{liveCountTrigger}</View>

            <Animated.View style={headerMetaAnimatedStyle}>
              <ScrollView
                contentContainerStyle={styles.headerMetaRow}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.headerMetaScroll}
                testID="editor-header-meta-scroll"
              >
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
                      ]}
                    >
                      <Text
                        style={[
                          styles.headerPillText,
                          { color: palette.strongText },
                        ]}
                      >
                        slot {slotHint}
                      </Text>
                    </View>
                  )}
                </Pressable>

                <View
                  style={[
                    styles.headerPill,
                    {
                      backgroundColor: palette.chip,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.headerPillText,
                      { color: palette.strongText },
                    ]}
                  >
                    {assets.length} refs
                  </Text>
                </View>

                {showStatusPills
                  ? sessionStatus === "ready"
                    ? (
                      <View
                        style={[
                          styles.headerPill,
                          {
                            backgroundColor: palette.chip,
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.headerPillText,
                            { color: palette.strongText },
                          ]}
                        >
                          backend ready
                        </Text>
                      </View>
                    )
                    : (
                      <Pressable
                        accessibilityLabel="retry prompt session backend"
                        accessibilityRole="button"
                        accessible
                        onPress={handleRetrySession}
                        testID="editor-session-retry-button"
                      >
                        {({ pressed }) => (
                          <View
                            style={[
                              styles.headerPill,
                              {
                                backgroundColor: palette.accentMuted,
                                borderColor: palette.border,
                              },
                              pressed && styles.buttonPressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.headerPillText,
                                { color: palette.strongText },
                              ]}
                            >
                              {sessionStatus === "syncing"
                                ? "backend syncing"
                                : "local only"}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    )
                  : null}

                {showStatusPills ? (
                  <View
                    style={[
                      styles.headerPill,
                      {
                        backgroundColor: palette.chip,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.headerPillText,
                        { color: palette.strongText },
                      ]}
                    >
                      {runtimeStatusLabel}
                    </Text>
                  </View>
                ) : null}

                <Link href={promptHistoryHref}>
                  <Link.Trigger>
                    <Pressable
                      accessibilityLabel="Open prompt history"
                      accessibilityRole="button"
                      accessible
                      collapsable={false}
                      importantForAccessibility="yes"
                      testID="editor-history-link"
                    >
                      {({ pressed }) => (
                        <View
                          style={[
                            styles.headerPill,
                            {
                              backgroundColor: palette.chip,
                              borderColor: palette.border,
                            },
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.headerPillText,
                              { color: palette.strongText },
                            ]}
                          >
                            {runCount} runs
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  </Link.Trigger>
                  {Platform.OS === "ios" && showPromptHistoryPreview ? (
                    <Link.Preview style={{ width: 320, height: 252 }}>
                      <PromptHistoryPreviewCard mode={mode} />
                    </Link.Preview>
                  ) : null}
                </Link>

                {showStatusPills && sceneDraftId ? (
                  <View
                    style={[
                      styles.headerPill,
                      {
                        backgroundColor: palette.chip,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.headerPillText,
                        { color: palette.strongText },
                      ]}
                    >
                      draft linked
                    </Text>
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
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              {
                listener: handleChatScroll,
                useNativeDriver: true,
              },
            )}
            ref={chatScrollRef}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={styles.chatViewport}
          >
            <View style={styles.threadList}>
              {chatMessages.map((message, index) => {
                if (message.type === "assistant") {
                  const orchestratorMessage = isOrchestratorAssistant(
                    message.entry,
                  );
                  const assistantDisplayText = getAssistantDisplayText(
                    message.entry,
                  );

                  return (
                    <AnimatedMessageCard
                      delay={Math.min(index * 28, 160)}
                      key={message.id}
                    >
                      <View style={[styles.messageRow, styles.messageRowLeft]}>
                        <Pressable
                          delayLongPress={220}
                          onLongPress={() => openMessageMenu(message)}
                          testID={
                            orchestratorMessage
                              ? "editor-orchestrator-message"
                              : undefined
                          }
                        >
                          {orchestratorMessage ? (
                            <View style={styles.orchestratorMessage}>
                              <Text
                                style={[
                                  styles.systemEyebrow,
                                  styles.orchestratorEyebrow,
                                  { color: palette.accent },
                                ]}
                              >
                                {message.entry.agent}
                              </Text>
                              <Markdown
                                style={orchestratorMarkdownStyles}
                                testID="editor-orchestrator-markdown"
                              >
                                {assistantDisplayText}
                              </Markdown>
                              <View
                                style={[
                                  styles.assistantBubbleFooter,
                                  styles.assistantMarkdownFooter,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.assistantBubbleMeta,
                                    { color: palette.mutedText },
                                  ]}
                                >
                                  {message.entry.slot
                                    ? `${message.entry.slot} · `
                                    : ""}
                                  {message.entry.isStreaming
                                    ? "streaming"
                                    : formatTimeLabel(message.entry.timestamp)}
                                </Text>
                                {message.entry.isStreaming ? (
                                  <Pressable
                                    accessibilityLabel="stop streaming response"
                                    accessibilityRole="button"
                                    accessible
                                    onPress={() =>
                                      stopAssistantStream(message.entry.id)
                                    }
                                    style={({ pressed }) => [
                                      styles.streamingStopButton,
                                      pressed && styles.buttonPressed,
                                    ]}
                                  >
                                    <Text style={styles.streamingStopText}>
                                      Stop
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            </View>
                          ) : (
                            <GlassSurface
                              style={[
                                styles.systemBubble,
                                {
                                  backgroundColor: "rgba(10,12,14,0.34)",
                                  borderColor: palette.border,
                                },
                              ]}
                            >
                              <Text style={styles.systemEyebrow}>
                                {message.entry.agent}
                              </Text>
                              <Text style={styles.systemText}>
                                {message.entry.label}
                              </Text>
                              <View style={styles.assistantBubbleFooter}>
                                <Text style={styles.assistantBubbleMeta}>
                                  {message.entry.slot
                                    ? `${message.entry.slot} · `
                                    : ""}
                                  {message.entry.isStreaming
                                    ? "streaming"
                                    : formatTimeLabel(message.entry.timestamp)}
                                </Text>
                                {message.entry.isStreaming ? (
                                  <Pressable
                                    accessibilityLabel="stop streaming response"
                                    accessibilityRole="button"
                                    accessible
                                    onPress={() =>
                                      stopAssistantStream(message.entry.id)
                                    }
                                    style={({ pressed }) => [
                                      styles.streamingStopButton,
                                      pressed && styles.buttonPressed,
                                    ]}
                                  >
                                    <Text style={styles.streamingStopText}>
                                      Stop
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            </GlassSurface>
                          )}
                        </Pressable>
                      </View>
                    </AnimatedMessageCard>
                  );
                }

                const systemEntry = message.entry.type === "asset";

                return (
                  <AnimatedMessageCard
                    delay={Math.min(index * 28, 160)}
                    key={message.id}
                  >
                    <View
                      style={[
                        styles.messageRow,
                        systemEntry
                          ? styles.messageRowLeft
                          : styles.messageRowRight,
                      ]}
                    >
                      <Pressable
                        delayLongPress={220}
                        onLongPress={() => openMessageMenu(message)}
                      >
                        <GlassSurface
                          style={[
                            styles.messageBubble,
                            systemEntry
                              ? styles.messageBubbleSystem
                              : styles.messageBubbleUser,
                          ]}
                        >
                          <Text
                            style={[
                              styles.messageType,
                              systemEntry && styles.messageTypeSystem,
                            ]}
                          >
                            {describeEntry(message.entry)}
                          </Text>
                          <Text
                            style={[
                              styles.messageText,
                              systemEntry && styles.messageTextSystem,
                            ]}
                          >
                            {message.entry.label}
                          </Text>
                          <Text
                            style={[
                              styles.messageMeta,
                              systemEntry && styles.messageMetaSystem,
                            ]}
                          >
                            {message.entry.slot
                              ? `${message.entry.slot} · `
                              : ""}
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

          <MessageViewportShadow
            edge="top"
            style={[
              styles.messageViewportShadowOverlay,
              {
                height: topMessageShadowHeight,
                top: headerDockHeight + 6,
              },
            ]}
            testID="editor-chat-top-shadow"
          />

          <MessageViewportShadow
            edge="bottom"
            style={[
              styles.messageViewportShadowOverlay,
              {
                bottom: composerDockHeight + overlayBottomPadding + 8,
                height: bottomMessageShadowHeight,
              },
            ]}
            testID="editor-composer-progressive-blur"
          />

          {showScrollToLatest ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.scrollLatestWrap,
                { bottom: composerDockHeight + 24 },
              ]}
            >
              <Pressable
                accessibilityLabel="scroll to latest message"
                accessibilityRole="button"
                accessible
                onPress={() => scrollToLatest(true)}
                testID="editor-scroll-latest-button"
              >
                {({ pressed }) => (
                  <GlassSurface
                    style={[
                      styles.scrollLatestButton,
                      {
                        backgroundColor: "rgba(10,12,14,0.58)",
                        borderColor: palette.border,
                      },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <SymbolView
                      name={{
                        ios: "arrow.down",
                        android: "arrow_downward",
                        web: "arrow_downward",
                      }}
                      size={15}
                      tintColor={palette.strongText}
                      weight="semibold"
                    />
                    <Text
                      style={[
                        styles.scrollLatestText,
                        { color: palette.strongText },
                      ]}
                    >
                      Latest
                    </Text>
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
            ]}
          >
            <View style={styles.assistantRail}>
              {assistantSelectTrigger}

              {assets.length ? (
                <ScrollView
                  contentContainerStyle={styles.assetPreviewRow}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.assetPreviewScroll}
                  testID="editor-asset-preview-row"
                >
                  {assets.map((asset) => (
                    <GlassSurface
                      key={asset.id}
                      style={[
                        styles.assetPreviewCard,
                        {
                          backgroundColor: "rgba(10,12,14,0.54)",
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      {asset.thumbnail ? (
                        <Image
                          contentFit="cover"
                          source={{ uri: asset.thumbnail }}
                          style={styles.assetPreviewThumb}
                        />
                      ) : (
                        <View style={styles.assetPreviewFallback}>
                          <SymbolView
                            name={{
                              ios: "cube.box.fill",
                              android: "deployed_code",
                              web: "deployed_code",
                            }}
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
                        style={({ pressed }) => [
                          styles.assetPreviewRemoveButton,
                          pressed && styles.buttonPressed,
                        ]}
                        testID={`editor-remove-asset-${asset.id}`}
                      >
                        <SymbolView
                          name={{
                            ios: "xmark",
                            android: "close",
                            web: "close",
                          }}
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
                  backgroundColor: "rgba(7,10,12,0.88)",
                  borderColor: palette.border,
                },
              ]}
            >
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
                testID="editor-assets-button"
              >
                <SymbolView
                  name={{
                    ios: "paperclip",
                    android: "attach_file",
                    web: "attach_file",
                  }}
                  size={17}
                  tintColor="#fff7f1"
                  weight="semibold"
                />
              </Pressable>

              <Pressable
                accessibilityLabel="open advanced tools"
                accessibilityRole="button"
                accessible
                onPress={openComposerToolsMenu}
                style={({ pressed }) => [
                  styles.leadingIconButton,
                  {
                    backgroundColor: palette.chip,
                    borderColor: palette.border,
                  },
                  pressed && styles.buttonPressed,
                ]}
                testID="editor-tools-button"
              >
                <SymbolView
                  name={{
                    ios: "ellipsis",
                    android: "more_horiz",
                    web: "more_horiz",
                  }}
                  size={18}
                  tintColor="#fff7f1"
                  weight="bold"
                />
              </Pressable>

              <View style={styles.inputFrame}>
                <TextInput
                  multiline
                  onChangeText={setDraft}
                  placeholder="Direct the next beat, mood, asset workflow, or service call..."
                  placeholderTextColor="rgba(255,244,235,0.42)"
                  ref={inputRef}
                  scrollEnabled
                  style={styles.input}
                  testID="editor-prompt-input"
                  value={draft}
                />
              </View>

              <View style={styles.voiceActionArea}>
                {voiceGestureState !== "idle" ? (
                  <View pointerEvents="none" style={styles.voiceGestureTrack}>
                    <View style={styles.voiceGestureTrackLine} />
                    <Animated.View
                      style={[styles.voiceGestureArrow, voiceGestureArrowStyle]}
                    >
                      <SymbolView
                        name={{
                          ios: "arrow.up",
                          android: "arrow_upward",
                          web: "arrow_upward",
                        }}
                        size={14}
                        tintColor="#d8f7e8"
                        weight="bold"
                      />
                    </Animated.View>
                    <Animated.View
                      style={[styles.voiceGestureGhost, voiceGestureGhostStyle]}
                    >
                      <SymbolView
                        name={{ ios: "mic.fill", android: "mic", web: "mic" }}
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
                      accessibilityLabel={
                        hasDraft ? "send prompt" : "record voice cue"
                      }
                      accessibilityRole="button"
                      accessible
                      disabled={status === "processing"}
                      pressRetentionOffset={{
                        bottom: 40,
                        left: 40,
                        right: 40,
                        top: 320,
                      }}
                      onPress={
                        hasDraft
                          ? handleSend
                          : Platform.OS === "web" || status === "recording"
                            ? () => void handleRecord()
                            : undefined
                      }
                      onPressIn={(event) =>
                        handleVoicePressIn(event.nativeEvent.pageY)
                      }
                      onTouchMove={(event) => {
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
                        (status === "recording" ||
                          composerActionMode === "stop") &&
                          styles.voiceOrbActive,
                        hasDraft && styles.voiceOrbSend,
                        pressed && styles.buttonPressed,
                        status === "processing" && styles.voiceOrbDisabled,
                        voiceGestureState === "primed" && styles.voiceOrbPrimed,
                      ]}
                      testID={
                        hasDraft ? "editor-send-button" : "editor-voice-button"
                      }
                    >
                      <SymbolView
                        name={{
                          ios:
                            composerActionMode === "send"
                              ? "arrow.up"
                              : composerActionMode === "stop"
                                ? "stop.fill"
                                : "mic.fill",
                          android:
                            composerActionMode === "send"
                              ? "arrow_upward"
                              : composerActionMode === "stop"
                                ? "stop"
                                : "mic",
                          web:
                            composerActionMode === "send"
                              ? "arrow_upward"
                              : composerActionMode === "stop"
                                ? "stop"
                                : "mic",
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

            <ComposerStatusBar palette={palette} status={composerStatus} />
          </View>
        </View>

        {toolsSheetVisible ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <Pressable
              accessibilityLabel="close tools menu"
              onPress={closeToolsMenu}
              style={StyleSheet.absoluteFill}
              testID="editor-tools-backdrop"
            />
            <Animated.View
              style={[
                styles.toolsPopoverWrap,
                {
                  bottom: composerDockHeight + overlayBottomPadding + 12,
                },
                toolsPopoverAnimatedStyle,
              ]}
              testID="editor-tools-sheet"
            >
              <GlassSurface
                style={[
                  styles.toolsPopover,
                  {
                    backgroundColor: "rgba(8,10,12,0.94)",
                    borderColor: palette.border,
                  },
                ]}
              >
                <View pointerEvents="none" style={styles.toolsPopoverGradient}>
                  <View style={styles.toolsPopoverGlowPrimary} />
                  <View style={styles.toolsPopoverGlowSecondary} />
                </View>
                <View style={styles.toolsHeader}>
                  <View style={styles.toolsHeaderCopy}>
                    <Text style={styles.sectionLabel}>Quick tools</Text>
                    <Text style={styles.toolsModalTitle}>
                      Capture and prompt shortcuts
                    </Text>
                  </View>
                  <Pressable
                    onPress={closeToolsMenu}
                    style={styles.sheetCloseButton}
                  >
                    <SymbolView
                      name={{ ios: "xmark", android: "close", web: "close" }}
                      size={16}
                      tintColor="#fff7f1"
                      weight="bold"
                    />
                  </Pressable>
                </View>

                <ScrollView
                  contentContainerStyle={styles.toolsContent}
                  contentInsetAdjustmentBehavior="automatic"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.toolsSection}>
                    <Text style={styles.sectionLabel}>Capture workflows</Text>
                    {TOOL_ACTIONS.map((action) => (
                      <Pressable
                        key={action.id}
                        onPress={() => injectDraft(action.prompt, "tools")}
                        testID={`editor-tool-${action.id}`}
                      >
                        {({ pressed }) => (
                          <GlassSurface
                            interactive
                            style={[
                              styles.toolCard,
                              pressed && styles.buttonPressed,
                            ]}
                          >
                            <View style={styles.toolIcon}>
                              <SymbolView
                                name={action.symbol}
                                size={18}
                                tintColor="#fff7f1"
                                weight="semibold"
                              />
                            </View>
                            <View style={styles.toolCopy}>
                              <Text style={styles.toolTitle}>
                                {action.label}
                              </Text>
                              <Text
                                numberOfLines={2}
                                style={styles.toolSubtitle}
                              >
                                {action.subtitle}
                              </Text>
                            </View>
                          </GlassSurface>
                        )}
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.toolsSection}>
                    <Text style={styles.sectionLabel}>Agent playbooks</Text>
                    {AGENT_PLAYBOOKS.map((playbook) => (
                      <Pressable
                        key={playbook.id}
                        onPress={() => injectDraft(playbook.prompt, "tools")}
                        testID={`editor-playbook-${playbook.id}`}
                      >
                        {({ pressed }) => (
                          <GlassSurface
                            interactive
                            style={[
                              styles.playbookRow,
                              pressed && styles.buttonPressed,
                            ]}
                          >
                            <View style={styles.playbookBadge}>
                              <Text style={styles.playbookBadgeText}>md</Text>
                            </View>
                            <View style={styles.toolCopy}>
                              <Text style={styles.toolTitle}>
                                {playbook.fileName}
                              </Text>
                              <Text
                                numberOfLines={2}
                                style={styles.toolSubtitle}
                              >
                                {playbook.subtitle}
                              </Text>
                            </View>
                          </GlassSurface>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </GlassSurface>
            </Animated.View>
          </View>
        ) : null}
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
    <SceneEditorProvider
      initialSessionId={promptSessionId ?? null}
      initialSessionTitle={title ?? "Scene editor draft"}
    >
      <EditorScreenContent />
    </SceneEditorProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050608",
  },
  transparentScreen: {
    backgroundColor: "transparent",
  },
  fallbackBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050608",
    overflow: "hidden",
  },
  backdropGlowPrimary: {
    backgroundColor: "rgba(216,247,232,0.12)",
    borderRadius: 220,
    height: 340,
    left: -40,
    position: "absolute",
    top: 80,
    width: 340,
  },
  backdropGlowSecondary: {
    backgroundColor: "rgba(255,154,112,0.14)",
    borderRadius: 240,
    bottom: -80,
    height: 380,
    position: "absolute",
    right: -60,
    width: 380,
  },
  progressiveBlurBase: {
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
  },
  sceneOverlayTransitionLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  progressiveBlurFullscreen: {
    bottom: 0,
    top: 0,
  },
  messageViewportShadowOverlay: {
    zIndex: 2,
  },
  messageViewportShadow: {
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
  },
  messageViewportShadowFill: {
    ...StyleSheet.absoluteFillObject,
  },
  messageViewportShadowFillTop: {
    backgroundColor: "rgba(5,6,8,0.08)",
  },
  messageViewportShadowFillBottom: {
    backgroundColor: "rgba(5,6,8,0.12)",
  },
  messageViewportShadowBand: {
    left: 0,
    position: "absolute",
    right: 0,
  },
  messageViewportShadowBandTop: {
    backgroundColor: "rgba(5,6,8,0.12)",
    height: "52%",
    top: 0,
  },
  messageViewportShadowBandBottom: {
    backgroundColor: "rgba(5,6,8,0.14)",
    bottom: 0,
    height: "52%",
  },
  messageViewportShadowEdge: {
    left: 0,
    position: "absolute",
    right: 0,
  },
  messageViewportShadowEdgeTop: {
    backgroundColor: "rgba(5,6,8,0.22)",
    height: "28%",
    top: 0,
  },
  messageViewportShadowEdgeBottom: {
    backgroundColor: "rgba(5,6,8,0.24)",
    bottom: 0,
    height: "28%",
  },
  globalBlurSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  progressiveBlurTopEdge: {
    height: "22%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  progressiveBlurTopMid: {
    height: "22%",
    left: 0,
    position: "absolute",
    right: 0,
    top: "12%",
  },
  progressiveBlurCenter: {
    height: "34%",
    left: 0,
    position: "absolute",
    right: 0,
    top: "30%",
  },
  progressiveBlurBottomMid: {
    bottom: "12%",
    height: "24%",
    left: 0,
    position: "absolute",
    right: 0,
  },
  progressiveBlurBottomEdge: {
    bottom: 0,
    height: "28%",
    left: 0,
    position: "absolute",
    right: 0,
  },
  overlayLayer: {
    flex: 1,
    position: "relative",
  },
  headerDock: {
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 3,
  },
  sceneHeaderMeta: {
    alignItems: "center",
    marginTop: 2,
  },
  headerMetaScroll: {
    backgroundColor: "transparent",
    flexGrow: 0,
    height: 44,
    marginTop: 12,
  },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#fff7f1",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  headerHint: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 520,
  },
  headerMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
  },
  headerPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  headerPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  nativeHeaderLiveCount: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    flexDirection: "row",
    gap: 7,
    height: 30,
    justifyContent: "center",
    minWidth: 74,
    paddingHorizontal: 11,
  },
  nativeHeaderLiveDot: {
    backgroundColor: "#d8f7e8",
    borderRadius: 999,
    height: 7,
    opacity: 0.92,
    width: 7,
  },
  nativeHeaderLiveText: {
    color: "#fff7f1",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.15,
  },
  nativeHeaderIconButton: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    width: 30,
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
    alignSelf: "flex-start",
    borderRadius: 22,
    borderWidth: 1,
    gap: 4,
    maxWidth: "76%",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  systemEyebrow: {
    color: "rgba(216,247,232,0.92)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  systemText: {
    color: "rgba(255,248,244,0.82)",
    fontSize: 14,
    lineHeight: 19,
  },
  orchestratorMessage: {
    gap: 8,
    maxWidth: "82%",
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  orchestratorEyebrow: {
    marginBottom: 2,
  },
  assistantBubbleFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  assistantMarkdownFooter: {
    marginTop: 0,
  },
  assistantBubbleMeta: {
    color: "rgba(255,244,235,0.56)",
    fontSize: 11,
    fontWeight: "600",
  },
  streamingStopButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streamingStopText: {
    color: "#fff7f1",
    fontSize: 11,
    fontWeight: "700",
  },
  threadList: {
    gap: 10,
  },
  messageRow: {
    flexDirection: "row",
  },
  messageRowLeft: {
    justifyContent: "flex-start",
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    borderWidth: 1,
    borderRadius: 24,
    gap: 6,
    maxWidth: "88%",
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  messageBubbleSystem: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  messageBubbleUser: {
    backgroundColor: "rgba(63,84,74,0.76)",
    borderColor: "rgba(216,247,232,0.18)",
  },
  messageType: {
    color: "rgba(216,247,232,0.74)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  messageTypeSystem: {
    color: "rgba(255,248,244,0.72)",
  },
  messageText: {
    color: "#fff7f1",
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextSystem: {
    color: "#fff7f1",
  },
  messageMeta: {
    color: "rgba(255,244,235,0.62)",
    fontSize: 11,
    fontWeight: "600",
  },
  messageMetaSystem: {
    color: "rgba(255,244,235,0.58)",
  },
  composerDock: {
    gap: 8,
    position: "absolute",
    zIndex: 3,
  },
  assistantRail: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  assistantSelectRow: {
    alignItems: "flex-start",
  },
  assistantSelectButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
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
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  assistantSelectLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  assetPreviewScroll: {
    flex: 1,
  },
  assetPreviewRow: {
    alignItems: "center",
    gap: 8,
    paddingRight: 2,
  },
  assetPreviewCard: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
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
    alignItems: "center",
    backgroundColor: "rgba(216,247,232,0.08)",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  assetPreviewCopy: {
    justifyContent: "center",
    maxWidth: 108,
    minWidth: 0,
  },
  assetPreviewName: {
    color: "#fff7f1",
    fontSize: 12,
    fontWeight: "600",
  },
  assetPreviewRemoveButton: {
    alignItems: "center",
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  composer: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: COMPOSER_HEIGHT,
    overflow: "visible",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leadingIconButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  inputFrame: {
    alignSelf: "stretch",
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  input: {
    alignSelf: "stretch",
    color: "#fff8f4",
    fontSize: 14,
    height: "100%",
    lineHeight: 19,
    paddingHorizontal: 2,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  sendButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#d8f7e8",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  voiceOrb: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#d8f7e8",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  voiceOrbSend: {
    backgroundColor: "#d8f7e8",
  },
  voiceOrbActive: {
    backgroundColor: "#ffd6c2",
  },
  voiceOrbPrimed: {
    backgroundColor: "#d8f7e8",
  },
  voiceOrbDisabled: {
    opacity: 0.54,
  },
  voiceActionArea: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
    overflow: "visible",
  },
  voiceGestureTrack: {
    alignItems: "center",
    bottom: 50,
    height: 82,
    justifyContent: "flex-end",
    position: "absolute",
    width: 56,
  },
  voiceGestureTrackLine: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    bottom: 6,
    height: 58,
    position: "absolute",
    width: 2,
  },
  voiceGestureArrow: {
    alignItems: "center",
    backgroundColor: "rgba(8,11,13,0.82)",
    borderColor: "rgba(216,247,232,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    bottom: 0,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    width: 24,
  },
  voiceGestureGhost: {
    alignItems: "center",
    backgroundColor: "rgba(8,11,13,0.92)",
    borderColor: "rgba(216,247,232,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    bottom: 0,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    width: 22,
  },
  composerStatusBar: {
    height: COMPOSER_STATUS_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 4,
  },
  composerStatusStack: {
    flex: 1,
    justifyContent: "center",
    position: "relative",
  },
  composerStatusLayer: {
    left: 0,
    position: "absolute",
    right: 0,
  },
  composerStatusPill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  composerStatusIconWrap: {
    alignItems: "center",
    height: 14,
    justifyContent: "center",
    width: 14,
  },
  composerStatusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 15,
  },
  scrollLatestWrap: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 3,
  },
  scrollLatestButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scrollLatestText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  toolsPanelWrap: {
    maxWidth: 420,
    width: "100%",
  },
  sheetPanel: {
    borderRadius: 30,
    maxHeight: "76%",
    paddingBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.26)",
    borderRadius: 999,
    height: 5,
    marginBottom: 12,
    width: 42,
  },
  sheetHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  sheetCopy: {
    flex: 1,
    gap: 4,
  },
  sheetEyebrow: {
    color: "#ffd5c3",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sheetTitle: {
    color: "#fff7f1",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  sheetHint: {
    color: "rgba(255,244,235,0.74)",
    fontSize: 13,
    lineHeight: 18,
  },
  sheetCloseButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  sheetContent: {
    gap: 14,
    paddingBottom: 4,
  },
  workflowRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  workflowChip: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  workflowText: {
    color: "#fff8f4",
    fontSize: 12,
    fontWeight: "700",
  },
  toolsPanel: {
    borderRadius: 24,
    maxHeight: "58%",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toolsPopoverWrap: {
    left: 18,
    position: "absolute",
    right: 76,
    zIndex: 6,
  },
  toolsPopover: {
    borderRadius: 24,
    borderWidth: 1,
    maxHeight: 388,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toolsPopoverGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  toolsPopoverGlowPrimary: {
    backgroundColor: "rgba(216,247,232,0.14)",
    borderRadius: 180,
    height: 180,
    left: -52,
    position: "absolute",
    top: -72,
    width: 180,
  },
  toolsPopoverGlowSecondary: {
    backgroundColor: "rgba(255,151,112,0.12)",
    borderRadius: 140,
    bottom: -58,
    height: 140,
    position: "absolute",
    right: -42,
    width: 140,
  },
  toolsHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  toolsHeaderCopy: {
    flex: 1,
  },
  toolsModalTitle: {
    color: "#fff7f1",
    fontSize: 17,
    fontWeight: "700",
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
    color: "#d9f8e8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  toolCard: {
    borderRadius: 18,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toolIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  toolCopy: {
    flex: 1,
    justifyContent: "center",
  },
  toolTitle: {
    color: "#fff7f1",
    fontSize: 14,
    fontWeight: "700",
  },
  toolSubtitle: {
    color: "rgba(255,244,235,0.72)",
    fontSize: 13,
    lineHeight: 18,
  },
  playbookRow: {
    alignItems: "center",
    borderRadius: 18,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  playbookBadge: {
    alignItems: "center",
    backgroundColor: "rgba(216,247,232,0.18)",
    borderRadius: 12,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  playbookBadgeText: {
    color: "#d8f7e8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
