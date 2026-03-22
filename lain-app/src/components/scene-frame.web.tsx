import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type SceneFrameProps = {
  interactive?: boolean;
  uri: string;
  testID?: string;
  onFrameError?: () => void;
  onFrameLoadEnd?: () => void;
  onFrameLoadStart?: () => void;
  onFrameMessage?: (message: string) => void;
};

export default function SceneFrame({
  interactive = true,
  uri,
  testID,
  onFrameError,
  onFrameLoadEnd,
  onFrameLoadStart,
}: SceneFrameProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    onFrameLoadStart?.();
  }, [onFrameLoadStart, uri]);

  return (
    <View
      pointerEvents={interactive ? 'auto' : 'none'}
      style={styles.frame}
      testID="scene-frame-root">
      <iframe
        allow="autoplay; fullscreen"
        data-testid={testID}
        onError={() => {
          setLoading(false);
          onFrameError?.();
        }}
        onLoad={() => {
          setLoading(false);
          onFrameLoadEnd?.();
        }}
        src={uri}
        style={[styles.iframe, !interactive && styles.iframeStatic] as never}
        title="lain-scene"
      />
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
  iframe: {
    borderWidth: 0,
    flex: 1,
    height: '100%',
    width: '100%',
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
});
