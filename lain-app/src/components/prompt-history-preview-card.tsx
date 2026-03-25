import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import GlassSurface from '@/components/glass-surface';
import { getEditorPalette } from '@/lib/editor/editor-palette';
import { formatTokenCount, getPromptTelemetryMock } from '@/lib/editor/prompt-telemetry';
import type { Mode } from '@/lib/scene-config';
import { getSceneOption } from '@/lib/scene-config';

type PromptHistoryPreviewCardProps = {
  mode: Mode;
};

export default function PromptHistoryPreviewCard({ mode }: PromptHistoryPreviewCardProps) {
  const colorScheme = useColorScheme();
  const palette = getEditorPalette(colorScheme);
  const telemetry = getPromptTelemetryMock(mode);
  const scene = getSceneOption(mode);

  return (
    <View style={[styles.root, { backgroundColor: palette.screen }]}>
      <GlassSurface style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text selectable style={[styles.eyebrow, { color: palette.mutedText }]}>
          Prompt history
        </Text>
        <Text selectable style={[styles.title, { color: palette.strongText }]}>
          {scene.label}
        </Text>
        <Text selectable style={[styles.summary, { color: palette.mutedText }]}>
          {telemetry.recentRuns.length + 1} runs tracked. Active agent: {telemetry.activeRun.agent}.
        </Text>

        <View style={styles.metricRow}>
          <View style={[styles.metricCard, { backgroundColor: palette.chip }]}>
            <Text style={[styles.metricLabel, { color: palette.mutedText }]}>Input</Text>
            <Text selectable style={[styles.metricValue, { color: palette.strongText }]}>
              {formatTokenCount(telemetry.activeRun.usage.input)}
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: palette.chip }]}>
            <Text style={[styles.metricLabel, { color: palette.mutedText }]}>Output</Text>
            <Text selectable style={[styles.metricValue, { color: palette.strongText }]}>
              {formatTokenCount(telemetry.activeRun.usage.output)}
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: palette.accentMuted }]}>
            <Text style={[styles.metricLabel, { color: palette.mutedText }]}>Session</Text>
            <Text selectable style={[styles.metricValue, { color: palette.strongText }]}>
              {formatTokenCount(telemetry.sessionUsage.total)}
            </Text>
          </View>
        </View>

        <Text numberOfLines={3} selectable style={[styles.previewCopy, { color: palette.strongText }]}>
          {telemetry.activeRun.prompt}
        </Text>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 220,
    padding: 14,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    flex: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    borderRadius: 18,
    flex: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  previewCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
});
