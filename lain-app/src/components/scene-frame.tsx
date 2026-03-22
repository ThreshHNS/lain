import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

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
  onFrameMessage,
}: SceneFrameProps) {
  const [loading, setLoading] = useState(true);

  return (
    <View
      pointerEvents={interactive ? 'auto' : 'none'}
      style={styles.frame}
      testID="scene-frame-root">
      <WebView
        allowsInlineMediaPlayback
        bounces={false}
        mediaPlaybackRequiresUserAction={false}
        onError={() => {
          setLoading(false);
          onFrameError?.();
        }}
        onLoadEnd={() => {
          setLoading(false);
          onFrameLoadEnd?.();
        }}
        onLoadStart={() => {
          setLoading(true);
          onFrameLoadStart?.();
        }}
        onMessage={event => onFrameMessage?.(event.nativeEvent.data)}
        originWhitelist={['*']}
        pointerEvents={interactive ? 'auto' : 'none'}
        source={{ uri }}
        style={styles.webview}
        testID={testID}
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
});
