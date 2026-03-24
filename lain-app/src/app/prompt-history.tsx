import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';

import GlassSurface from '@/components/glass-surface';
import { getEditorPalette } from '@/lib/editor/editor-palette';
import { formatTokenCount, getPromptTelemetryMock } from '@/lib/editor/prompt-telemetry';
import { getSceneOption, resolveMode } from '@/lib/scene-config';

function formatHistoryTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PromptHistoryScreen() {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    title?: string | string[];
  }>();
  const mode = resolveMode(Array.isArray(params.mode) ? params.mode[0] : params.mode);
  const draftTitle = Array.isArray(params.title) ? params.title[0] : params.title;
  const telemetry = getPromptTelemetryMock(mode);
  const scene = getSceneOption(mode);
  const colorScheme = useColorScheme();
  const palette = getEditorPalette(colorScheme);
  const displayTitle = draftTitle?.trim() ? draftTitle : scene.label;

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: palette.screen }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        testID="prompt-history-screen">
        <GlassSurface style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text selectable style={[styles.eyebrow, { color: palette.mutedText }]}>
            Prompt session
          </Text>
          <Text selectable style={[styles.title, { color: palette.strongText }]}>
            {displayTitle}
          </Text>
          <Text selectable style={[styles.subtitle, { color: palette.mutedText }]}>
            Mock prompt telemetry for the ongoing scene editor. Replace this layer with real run
            events when the backend starts emitting token usage and service traces.
          </Text>

          <View style={styles.metricRow}>
            <View style={[styles.metricCard, { backgroundColor: palette.chip }]}>
              <Text style={[styles.metricLabel, { color: palette.mutedText }]}>Session total</Text>
              <Text selectable style={[styles.metricValue, { color: palette.strongText }]}>
                {formatTokenCount(telemetry.sessionUsage.total)}
              </Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: palette.chip }]}>
              <Text style={[styles.metricLabel, { color: palette.mutedText }]}>Cached</Text>
              <Text selectable style={[styles.metricValue, { color: palette.strongText }]}>
                {formatTokenCount(telemetry.sessionUsage.cached)}
              </Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: palette.accentMuted }]}>
              <Text style={[styles.metricLabel, { color: palette.mutedText }]}>Queue</Text>
              <Text selectable style={[styles.metricValue, { color: palette.strongText }]}>
                {telemetry.queueDepth}
              </Text>
            </View>
          </View>
        </GlassSurface>

        <View style={styles.list}>
          {[telemetry.activeRun, ...telemetry.recentRuns].map(run => (
            <GlassSurface
              key={run.id}
              style={[styles.runCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.runHeader}>
                <View style={styles.runCopy}>
                  <Text selectable style={[styles.runTitle, { color: palette.strongText }]}>
                    {run.title}
                  </Text>
                  <Text selectable style={[styles.runMeta, { color: palette.mutedText }]}>
                    {run.agent} · {run.slot} · {run.status}
                  </Text>
                </View>
                <Text selectable style={[styles.runTime, { color: palette.mutedText }]}>
                  {formatHistoryTime(run.createdAt)}
                </Text>
              </View>

              <Text selectable style={[styles.promptBody, { color: palette.strongText }]}>
                {run.prompt}
              </Text>
              <Text selectable style={[styles.responseBody, { color: palette.mutedText }]}>
                {run.responsePreview}
              </Text>

              <View style={styles.footerRow}>
                <View style={styles.serviceRow}>
                  {run.serviceLabels.map(label => (
                    <View key={label} style={[styles.serviceChip, { backgroundColor: palette.chip }]}>
                      <Text selectable style={[styles.serviceText, { color: palette.strongText }]}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>

                <Text selectable style={[styles.usageLabel, { color: palette.mutedText }]}>
                  in {formatTokenCount(run.usage.input)} · out {formatTokenCount(run.usage.output)} · total{' '}
                  {formatTokenCount(run.usage.total)}
                </Text>
              </View>
            </GlassSurface>
          ))}
        </View>
      </ScrollView>

      <Stack.Screen
        options={{
          headerShadowVisible: false,
          headerTransparent: true,
          title: 'Prompt history',
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    minHeight: '100%',
    paddingHorizontal: 18,
    paddingTop: 96,
    paddingBottom: 24,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
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
    paddingVertical: 12,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  list: {
    gap: 10,
  },
  runCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  runHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  runCopy: {
    flex: 1,
    gap: 4,
  },
  runTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  runMeta: {
    fontSize: 12,
  },
  runTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  promptBody: {
    fontSize: 15,
    lineHeight: 20,
  },
  responseBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  footerRow: {
    gap: 8,
  },
  serviceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  serviceChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  serviceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  usageLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
