import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import GlassSurface from '@/components/glass-surface';
import { getEditorPalette } from '@/lib/editor/editor-palette';
import type { SceneCollaborationFeed } from '@/hooks/use-scene-collaboration-feed';

type EditorCollaborationMenuProps = {
  feed: SceneCollaborationFeed;
};

function PresencePulse({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 900,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 900,
          toValue: 0.55,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.pulse,
        {
          backgroundColor: color,
          opacity: pulse,
          transform: [{ scale: pulse }],
        },
      ]}
    />
  );
}

export default function EditorCollaborationMenu({ feed }: EditorCollaborationMenuProps) {
  const colorScheme = useColorScheme();
  const palette = getEditorPalette(colorScheme);
  const [open, setOpen] = useState(false);
  const eventOpacity = useRef(new Animated.Value(1)).current;
  const latestEventId = feed.latestEvent.id;

  useEffect(() => {
    eventOpacity.setValue(0.35);
    Animated.timing(eventOpacity, {
      duration: 260,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [eventOpacity, latestEventId]);

  return (
    <>
      <Pressable
        accessibilityLabel="open collaborators menu"
        accessibilityRole="button"
        accessible
        onPress={() => setOpen(true)}
        testID="editor-collaborators-button">
        {({ pressed }) => (
          <GlassSurface style={[styles.trigger, pressed && styles.pressed]}>
            <PresencePulse color={palette.accent} />
            <Text style={[styles.triggerLabel, { color: palette.strongText }]}>
              {feed.activeCollaborators.length} live
            </Text>
          </GlassSurface>
        )}
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}>
        <View pointerEvents="box-none" style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <GlassSurface style={[styles.panel, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.panelHeader}>
              <View style={styles.panelCopy}>
                <Text style={[styles.panelEyebrow, { color: palette.mutedText }]}>Collaboration</Text>
                <Text style={[styles.panelTitle, { color: palette.strongText }]}>Scene presence</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.closeButton}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={15}
                  tintColor={palette.strongText}
                  weight="bold"
                />
              </Pressable>
            </View>

            <View style={[styles.socketCard, { backgroundColor: palette.accentMuted }]}>
              <View style={styles.socketRow}>
                <PresencePulse color={palette.accent} />
                <Text selectable style={[styles.socketTitle, { color: palette.strongText }]}>
                  {feed.socket.stateLabel}
                </Text>
              </View>
              <Text selectable style={[styles.socketMeta, { color: palette.mutedText }]}>
                {feed.socket.channel} · {feed.socket.latencyMs}ms
              </Text>
            </View>

            <Animated.View style={{ opacity: eventOpacity }}>
              <GlassSurface style={[styles.eventCard, { backgroundColor: palette.chip }]}>
                <Text style={[styles.eventLabel, { color: palette.mutedText }]}>Latest live change</Text>
                <Text selectable style={[styles.eventText, { color: palette.strongText }]}>
                  {feed.latestEvent.label}
                </Text>
                <Text selectable style={[styles.eventMeta, { color: palette.mutedText }]}>
                  {feed.latestEvent.relativeTimeLabel}
                </Text>
              </GlassSurface>
            </Animated.View>

            <View style={styles.list}>
              {feed.activeCollaborators.map(collaborator => (
                <View key={collaborator.id} style={[styles.row, { borderBottomColor: palette.border }]}>
                  <View style={styles.rowCopy}>
                    <Text selectable style={[styles.rowTitle, { color: palette.strongText }]}>
                      {collaborator.name}
                    </Text>
                    <Text selectable style={[styles.rowMeta, { color: palette.mutedText }]}>
                      {collaborator.roleLabel} · {collaborator.status}
                    </Text>
                    <Text numberOfLines={2} selectable style={[styles.rowAction, { color: palette.strongText }]}>
                      {collaborator.currentAction}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: palette.accentMuted }]}>
                    <Text style={[styles.statusBadgeText, { color: palette.strongText }]}>live</Text>
                  </View>
                </View>
              ))}
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.82,
  },
  pulse: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  triggerLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: Platform.OS === 'ios' ? 'flex-start' : 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 74 : 20,
  },
  panel: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    maxWidth: 360,
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: '100%',
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  panelCopy: {
    flex: 1,
    gap: 4,
  },
  panelEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  socketCard: {
    borderRadius: 20,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  socketRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  socketTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  socketMeta: {
    fontSize: 12,
  },
  eventCard: {
    borderRadius: 20,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  eventLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  eventText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  eventMeta: {
    fontSize: 12,
  },
  list: {
    gap: 2,
  },
  row: {
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowMeta: {
    fontSize: 12,
  },
  rowAction: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
