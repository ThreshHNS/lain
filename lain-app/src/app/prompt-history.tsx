import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import GlassSurface from '@/components/glass-surface';
import {
  fetchPromptMessages,
  type PromptMessageRecord,
  PromptSessionApiError,
} from '@/lib/api/prompt-session';
import { getEditorPalette } from '@/lib/editor/editor-palette';
import { getSceneOption, resolveMode } from '@/lib/scene-config';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function toSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatHistoryTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractErrorMessage(error: unknown) {
  if (error instanceof PromptSessionApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Prompt history is unavailable right now.';
}

function formatRoleLabel(role: PromptMessageRecord['role']) {
  if (role === 'assistant') {
    return 'Assistant';
  }
  if (role === 'tool') {
    return 'Tool';
  }

  return 'You';
}

function formatSourceLabel(source: PromptMessageRecord['source']) {
  if (source === 'codex') {
    return 'codex';
  }
  if (source === 'transcript') {
    return 'transcript';
  }

  return source;
}

function buildMessageMeta(message: PromptMessageRecord) {
  const parts = [formatRoleLabel(message.role), formatSourceLabel(message.source)];
  if (message.slot) {
    parts.push(message.slot);
  }

  return parts.join(' · ');
}

export default function PromptHistoryScreen() {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    promptSessionId?: string | string[];
    sceneDraftId?: string | string[];
    title?: string | string[];
  }>();
  const mode = resolveMode(toSingleParam(params.mode));
  const promptSessionId = toSingleParam(params.promptSessionId);
  const sceneDraftId = toSingleParam(params.sceneDraftId);
  const draftTitle = toSingleParam(params.title);
  const scene = getSceneOption(mode);
  const colorScheme = useColorScheme();
  const palette = getEditorPalette(colorScheme);
  const displayTitle = draftTitle?.trim() ? draftTitle : scene.label;
  const [messages, setMessages] = useState<PromptMessageRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>(promptSessionId ? 'loading' : 'idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!promptSessionId) {
      setMessages([]);
      setLoadError(null);
      setLoadState('idle');
      return () => {
        isCancelled = true;
      };
    }

    setLoadState('loading');
    setLoadError(null);

    void fetchPromptMessages(promptSessionId)
      .then(response => {
        if (isCancelled) {
          return;
        }

        setMessages(
          [...response].sort(
            (left, right) =>
              new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
          ),
        );
        setLoadState('ready');
      })
      .catch(error => {
        if (isCancelled) {
          return;
        }

        setMessages([]);
        setLoadError(extractErrorMessage(error));
        setLoadState('error');
      });

    return () => {
      isCancelled = true;
    };
  }, [promptSessionId]);

  const metrics = useMemo(() => {
    const total = messages.length;
    const user = messages.filter(message => message.role === 'user').length;
    const assistant = messages.filter(message => message.role === 'assistant').length;

    return {
      assistant,
      total,
      user,
    };
  }, [messages]);

  const heroSubtitle = useMemo(() => {
    if (!promptSessionId) {
      return 'This draft has not linked a backend prompt session yet. Prompt history stays local until the editor opens a real session.';
    }
    if (loadState === 'error') {
      return `${loadError ?? 'Prompt history is unavailable right now.'} Real token usage and service traces are still unavailable because the backend does not emit them yet.`;
    }
    if (loadState === 'loading') {
      return 'Loading real prompt messages for the linked session. Token usage and service traces are not available yet.';
    }

    return 'Showing real prompt messages from the linked backend session. Token usage and service traces are not available yet because the backend does not emit them.';
  }, [loadError, loadState, promptSessionId]);

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
            {heroSubtitle}
          </Text>

          <View style={styles.metricRow}>
            <View style={[styles.metricCard, { backgroundColor: palette.chip }]}>
              <Text style={[styles.metricLabel, { color: palette.mutedText }]}>Messages</Text>
              <Text selectable style={[styles.metricValue, { color: palette.strongText }]}>
                {metrics.total}
              </Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: palette.chip }]}>
              <Text style={[styles.metricLabel, { color: palette.mutedText }]}>User</Text>
              <Text selectable style={[styles.metricValue, { color: palette.strongText }]}>
                {metrics.user}
              </Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: palette.accentMuted }]}>
              <Text style={[styles.metricLabel, { color: palette.mutedText }]}>Assistant</Text>
              <Text selectable style={[styles.metricValue, { color: palette.strongText }]}>
                {metrics.assistant}
              </Text>
            </View>
          </View>

          <View style={styles.sessionMetaRow}>
            <Text selectable style={[styles.sessionMeta, { color: palette.mutedText }]}>
              Session {promptSessionId ?? 'not linked'}
            </Text>
            <Text selectable style={[styles.sessionMeta, { color: palette.mutedText }]}>
              Draft {sceneDraftId ?? 'standalone'}
            </Text>
          </View>
        </GlassSurface>

        {!promptSessionId ? (
          <GlassSurface style={[styles.noticeCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.noticeTitle, { color: palette.strongText }]}>Local draft only</Text>
            <Text style={[styles.noticeBody, { color: palette.mutedText }]}>
              Open the editor with a reachable backend and send a prompt to start a persistent prompt session for this draft.
            </Text>
          </GlassSurface>
        ) : null}

        {loadState === 'loading' ? (
          <GlassSurface style={[styles.noticeCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.noticeTitle, { color: palette.strongText }]}>Loading prompt messages</Text>
            <Text style={[styles.noticeBody, { color: palette.mutedText }]}>
              Fetching the linked session history from the backend.
            </Text>
          </GlassSurface>
        ) : null}

        {loadState === 'error' ? (
          <GlassSurface style={[styles.noticeCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.noticeTitle, { color: palette.strongText }]}>Prompt history unavailable</Text>
            <Text style={[styles.noticeBody, { color: palette.mutedText }]}>{loadError}</Text>
          </GlassSurface>
        ) : null}

        {loadState === 'ready' && messages.length === 0 ? (
          <GlassSurface style={[styles.noticeCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.noticeTitle, { color: palette.strongText }]}>No prompt messages yet</Text>
            <Text style={[styles.noticeBody, { color: palette.mutedText }]}>
              The session is linked, but no messages have been recorded yet.
            </Text>
          </GlassSurface>
        ) : null}

        {loadState === 'ready' && messages.length > 0 ? (
          <View style={styles.list}>
            {messages.map(message => (
              <GlassSurface
                key={message.id}
                style={[styles.messageCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={styles.messageHeader}>
                  <View style={styles.messageCopy}>
                    <Text selectable style={[styles.messageTitle, { color: palette.strongText }]}>
                      {formatRoleLabel(message.role)}
                    </Text>
                    <Text selectable style={[styles.messageMeta, { color: palette.mutedText }]}>
                      {buildMessageMeta(message)}
                    </Text>
                  </View>
                  <Text selectable style={[styles.messageTime, { color: palette.mutedText }]}>
                    {formatHistoryTime(message.createdAt)}
                  </Text>
                </View>

                <Text selectable style={[styles.messageBody, { color: palette.strongText }]}>
                  {message.text}
                </Text>
              </GlassSurface>
            ))}
          </View>
        ) : null}
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
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 96,
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
  sessionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sessionMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  noticeCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  noticeTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    gap: 10,
  },
  messageCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  messageCopy: {
    flex: 1,
    gap: 4,
  },
  messageTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  messageMeta: {
    fontSize: 12,
  },
  messageTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageBody: {
    fontSize: 15,
    lineHeight: 20,
  },
});
