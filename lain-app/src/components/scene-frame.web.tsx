import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import GlassSurface from './glass-surface';

type SceneFrameProps = {
  editorBackdropActive?: boolean;
  hideSceneChrome?: boolean;
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

const EDITOR_BACKDROP_FADE_DURATION = 220;
const SCENE_CHROME_STYLE_ID = 'lain-scene-chrome-style';

function buildSceneChromeCss(hideSceneChrome: boolean) {
  if (!hideSceneChrome) {
    return '';
  }

  return `
.mode-switcher,
.route-transition,
#mode-chip,
#hint,
#hud,
#score,
#touch-controls,
#dpad,
#attack-button,
#crosshair,
#weapon-overlay,
#legend,
#stolenBanner {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
}
`;
}

export default function SceneFrame({
  editorBackdropActive = false,
  hideSceneChrome = false,
  interactive = true,
  muted = false,
  uri,
  testID,
  onFrameError,
  onFrameLoadEnd,
  onFrameLoadStart,
  onRetry,
  retryTestID,
  statusTestID,
}: SceneFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const backdropOpacity = useRef(new Animated.Value(editorBackdropActive ? 1 : 0)).current;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const frameState = failed ? 'error' : loading ? 'loading' : 'ready';
  const shellChromeHidden = hideSceneChrome || editorBackdropActive;
  const iframeStyle = StyleSheet.flatten([
    styles.iframe,
    !interactive && styles.iframeStatic,
  ]) as CSSProperties;
  const applySceneChrome = useCallback(() => {
    try {
      const documentNode = iframeRef.current?.contentWindow?.document;
      if (!documentNode) {
        return;
      }

      let styleNode = documentNode.getElementById(SCENE_CHROME_STYLE_ID) as HTMLStyleElement | null;
      if (!styleNode) {
        styleNode = documentNode.createElement('style');
        styleNode.id = SCENE_CHROME_STYLE_ID;
        (documentNode.head || documentNode.documentElement)?.appendChild(styleNode);
      }

      styleNode.textContent = buildSceneChromeCss(shellChromeHidden);
      documentNode.body?.setAttribute('data-shell-chrome-hidden', String(shellChromeHidden));
      documentNode.body?.setAttribute('data-editor-backdrop-active', String(editorBackdropActive));
    } catch {
      // Cross-origin iframes cannot be controlled on web. Native uses WebView injection.
    }
  }, [editorBackdropActive, shellChromeHidden]);
  const applyMutedState = useCallback(() => {
    try {
      const documentNode = iframeRef.current?.contentWindow?.document;
      if (!documentNode) {
        return;
      }

      documentNode.querySelectorAll('audio, video').forEach(mediaNode => {
        const mediaElement = mediaNode as HTMLMediaElement;
        mediaElement.defaultMuted = muted;
        mediaElement.muted = muted;
      });
      documentNode.body?.setAttribute('data-shell-muted', String(muted));
    } catch {
      // Cross-origin iframes cannot be controlled on web. Native uses WebView injection.
    }
  }, [muted]);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    onFrameLoadStart?.();
  }, [onFrameLoadStart, uri]);

  useEffect(() => {
    applyMutedState();
  }, [applyMutedState]);

  useEffect(() => {
    applySceneChrome();
  }, [applySceneChrome]);

  useEffect(() => {
    Animated.timing(backdropOpacity, {
      duration: EDITOR_BACKDROP_FADE_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: editorBackdropActive ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [backdropOpacity, editorBackdropActive]);

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
      <iframe
        allow="autoplay; fullscreen"
        data-testid={testID}
        ref={iframeRef}
        onError={() => {
          setLoading(false);
          setFailed(true);
          onFrameError?.();
        }}
        onLoad={() => {
          setLoading(false);
          setFailed(false);
          applySceneChrome();
          applyMutedState();
          onFrameLoadEnd?.();
        }}
        src={uri}
        style={iframeStyle}
        title="lain-scene"
      />
      <Animated.View pointerEvents="none" style={[styles.editorBackdropMask, { opacity: backdropOpacity }]} />
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
  iframe: {
    borderWidth: 0,
    flex: 1,
    height: '100%',
    width: '100%',
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
  iframeStatic: {
    pointerEvents: 'none',
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
