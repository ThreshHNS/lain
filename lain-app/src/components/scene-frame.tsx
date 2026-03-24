import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import GlassSurface from './glass-surface';

type SceneFrameProps = {
  editorBackdropActive?: boolean;
  interactive?: boolean;
  muted?: boolean;
  uri: string;
  testID?: string;
  onFrameError?: () => void;
  onFrameLoadEnd?: () => void;
  onFrameLoadStart?: () => void;
  onFrameMessage?: (message: string) => void;
  onRetry?: () => void;
  retryTestID?: string;
  statusTestID?: string;
};

const EDITOR_BACKDROP_STYLE_ID = 'lain-editor-backdrop-style';
const MEDIA_SYNC_OBSERVER_KEY = '__lainShellMutedObserver';

function buildEditorBackdropScript(editorBackdropActive: boolean) {
  const css = editorBackdropActive
    ? `
body[data-embedded="true"] #mode-chip {
  display: none !important;
}

body[data-embedded="true"][data-scene-mode="awp"] #hud {
  top: 72px !important;
}

body[data-embedded="true"][data-scene-mode="awp"] #hint,
body[data-embedded="true"][data-scene-mode="slasher"] #hint {
  top: 72px !important;
  max-width: min(72vw, 320px) !important;
}
`
    : '';

  return `(() => {
    const styleId = '${EDITOR_BACKDROP_STYLE_ID}';
    let styleNode = document.getElementById(styleId);

    if (!styleNode) {
      styleNode = document.createElement('style');
      styleNode.id = styleId;
      document.head.appendChild(styleNode);
    }

    styleNode.textContent = ${JSON.stringify(css)};
    document.body?.setAttribute('data-editor-backdrop-active', ${JSON.stringify(String(editorBackdropActive))});
  })(); true;`;
}

function buildMediaMuteScript(muted: boolean) {
  return `(() => {
    window.__lainShellMuted = ${JSON.stringify(muted)};

    const applyMutedState = () => {
      document.querySelectorAll('audio, video').forEach((mediaNode) => {
        mediaNode.defaultMuted = window.__lainShellMuted;
        mediaNode.muted = window.__lainShellMuted;
      });

      document.body?.setAttribute('data-shell-muted', String(window.__lainShellMuted));
    };

    applyMutedState();

    if (!window.${MEDIA_SYNC_OBSERVER_KEY}) {
      const observer = new MutationObserver(() => applyMutedState());
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      window.${MEDIA_SYNC_OBSERVER_KEY} = observer;
    }
  })(); true;`;
}

export default function SceneFrame({
  editorBackdropActive = false,
  interactive = true,
  muted = false,
  uri,
  testID,
  onFrameError,
  onFrameLoadEnd,
  onFrameLoadStart,
  onFrameMessage,
  onRetry,
  retryTestID,
  statusTestID,
}: SceneFrameProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const frameState = failed ? 'error' : loading ? 'loading' : 'ready';

  const applyEditorBackdrop = useCallback(() => {
    webViewRef.current?.injectJavaScript(buildEditorBackdropScript(editorBackdropActive));
  }, [editorBackdropActive]);
  const applyMutedState = useCallback(() => {
    webViewRef.current?.injectJavaScript(buildMediaMuteScript(muted));
  }, [muted]);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [uri]);

  useEffect(() => {
    applyEditorBackdrop();
  }, [applyEditorBackdrop]);

  useEffect(() => {
    applyMutedState();
  }, [applyMutedState]);

  return (
    <View style={styles.frame} testID="scene-frame-root">
      {statusTestID ? (
        <View pointerEvents="none" style={styles.statusBadge}>
          <Text
            accessibilityLabel={`${statusTestID}-${frameState}`}
            accessible
            style={styles.statusLabel}
            testID={`${statusTestID}-${frameState}`}>
            {frameState}
          </Text>
        </View>
      ) : null}
      <WebView
        allowsInlineMediaPlayback
        bounces={false}
        ref={webViewRef}
        mediaPlaybackRequiresUserAction={false}
        onError={() => {
          setLoading(false);
          setFailed(true);
          onFrameError?.();
        }}
        onLoadEnd={() => {
          setLoading(false);
          setFailed(false);
          applyEditorBackdrop();
          applyMutedState();
          onFrameLoadEnd?.();
        }}
        onLoadStart={() => {
          setLoading(true);
          setFailed(false);
          onFrameLoadStart?.();
        }}
        onMessage={event => onFrameMessage?.(event.nativeEvent.data)}
        originWhitelist={['*']}
        pointerEvents={interactive ? 'auto' : 'none'}
        source={{ uri }}
        style={styles.webview}
        testID={testID}
      />
      {editorBackdropActive ? <View pointerEvents="none" style={styles.editorBackdropMask} /> : null}
      {failed ? (
        <View pointerEvents="box-none" style={styles.failureOverlay}>
          <GlassSurface style={styles.failureCard}>
            <Text style={styles.failureTitle}>Scene unavailable</Text>
            <Text style={styles.failureBody}>Reload scene host and retry preview.</Text>
            {onRetry ? (
              <Pressable
                accessibilityLabel={retryTestID}
                accessibilityRole="button"
                accessible
                onPress={onRetry}
                testID={retryTestID}>
                {({ pressed }) => (
                  <GlassSurface interactive style={[styles.retryButton, pressed && styles.retryButtonPressed]}>
                    <Text style={styles.retryLabel}>Retry</Text>
                  </GlassSurface>
                )}
              </Pressable>
            ) : null}
          </GlassSurface>
        </View>
      ) : null}
      {loading ? (
        <View pointerEvents="none" style={styles.loadingOverlay} testID="scene-loading-overlay">
          <ActivityIndicator color="#ff915a" size="small" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: '#080607',
    overflow: 'hidden',
  },
  statusBadge: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 3,
  },
  statusLabel: {
    color: '#fff3ea',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  webview: {
    flex: 1,
    backgroundColor: '#080607',
  },
  editorBackdropMask: {
    backgroundColor: 'rgba(8, 6, 7, 0.18)',
    boxShadow: '0 24px 48px rgba(8, 6, 7, 0.26)',
    height: 168,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(8, 6, 7, 0.35)',
    justifyContent: 'center',
  },
  failureOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  failureCard: {
    borderRadius: 24,
    gap: 8,
    maxWidth: 280,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  failureTitle: {
    color: '#fff8f4',
    fontSize: 18,
    fontWeight: '800',
  },
  failureBody: {
    color: '#f1d8cb',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 6,
    minWidth: 104,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  retryButtonPressed: {
    opacity: 0.84,
  },
  retryLabel: {
    color: '#fff8f4',
    fontSize: 15,
    fontWeight: '700',
  },
});
