import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const DISMISSED_KEY = 'lain_install_banner_dismissed';

function isIOSSafari(): boolean {
  if (Platform.OS !== 'web') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function isStandalone(): boolean {
  if (Platform.OS !== 'web') return false;
  return (
    ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export default function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOSSafari() || isStandalone()) return;
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return;
    } catch {}
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {}
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.banner}>
        <View style={styles.content}>
          <Text style={styles.title}>Install lain</Text>
          <Text style={styles.text}>
            Tap{' '}
            <Text style={styles.icon}>
              {/* Share icon approximation */}
              ↑
            </Text>{' '}
            then <Text style={styles.bold}>"Add to Home Screen"</Text>
          </Text>
        </View>
        <Pressable onPress={dismiss} style={styles.close} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 16, 19, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    maxWidth: 400,
    width: '100%',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#fff6ef',
    fontSize: 15,
    fontWeight: '600',
  },
  text: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  icon: {
    color: '#4a9eff',
    fontSize: 15,
    fontWeight: '600',
  },
  bold: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
  },
  close: {
    marginLeft: 12,
    padding: 4,
  },
  closeText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 16,
  },
});
