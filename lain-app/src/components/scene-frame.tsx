import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import GlassSurface from './glass-surface';

type SceneFrameProps = {
  interactive?: boolean;
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

export default function SceneFrame({
  interactive = true,
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
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const frameState = failed ? 'error' : loading ? 'loading' : 'ready';

  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [uri]);

  return (
    <View style={styles.frame} testID="scene-frame-root">
      {statusTestID ? (
        <View pointerEvents="none" style={styles.statusBadge}>
          <Text style={styles.statusLabel} testID={`${statusTestID}-${frameState}`}>
            {frameState}
          </Text>
        </View>
      ) : null}
      <WebView
        allowsInlineMediaPlayback
        bounces={false}
        mediaPlaybackRequiresUserAction={false}
        onError={() => {
          setLoading(false);
          setFailed(true);
          onFrameError?.();
        }}
        onLoadEnd={() => {
          setLoading(false);
          setFailed(false);
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
      {failed ? (
        <View pointerEvents="box-none" style={styles.failureOverlay}>
          <GlassSurface style={styles.failureCard}>
            <Text style={styles.failureTitle}>Scene unavailable</Text>
            <Text style={styles.failureBody}>Reload scene host and retry preview.</Text>
            {onRetry ? (
              <Pressable onPress={onRetry} testID={retryTestID}>
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
