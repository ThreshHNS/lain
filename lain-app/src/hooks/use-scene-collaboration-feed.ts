import { useMemo } from 'react';

import type { Mode } from '@/lib/scene-config';
import type { ActiveUser } from '@/types/editor';

export type SceneCollaboratorStatus = 'editing' | 'reviewing' | 'watching';

export type SceneCollaboratorPresence = ActiveUser & {
  currentAction: string;
  roleLabel: string;
  status: SceneCollaboratorStatus;
};

export type SceneCollaborationEvent = {
  actorId: string;
  id: string;
  label: string;
  relativeTimeLabel: string;
};

export type SceneCollaborationFeed = {
  activeCollaborators: SceneCollaboratorPresence[];
  latestEvent: SceneCollaborationEvent;
  socket: {
    channel: string;
    latencyMs: number | null;
    stateLabel: string;
  };
};

type SceneCollaborationFeedOptions = {
  latestActivityAt?: string | null;
  latestActivityLabel?: string | null;
  pendingHistoryCount?: number;
  runtimeSummary?: string | null;
  sessionStatus?: 'offline' | 'ready' | 'syncing';
};

function formatRelativeTime(timestamp?: string | null) {
  if (!timestamp) {
    return 'just now';
  }

  const elapsedMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 15_000) {
    return 'just now';
  }

  const elapsedMinutes = Math.round(elapsedMs / 60_000);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.round(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function getSyncStateLabel(sessionStatus: SceneCollaborationFeedOptions['sessionStatus']) {
  if (sessionStatus === 'ready') {
    return 'prompt backend linked';
  }
  if (sessionStatus === 'syncing') {
    return 'prompt session syncing';
  }

  return 'local session only';
}

function getSyncDetail(mode: Mode, sessionStatus: SceneCollaborationFeedOptions['sessionStatus']) {
  if (sessionStatus === 'ready') {
    return `Scene ${mode} is linked to the prompt backend. Activity status remains local-only because no collaboration transport is connected.`;
  }
  if (sessionStatus === 'syncing') {
    return `Scene ${mode} is preparing the prompt session. Activity status is still local-only.`;
  }

  return `Scene ${mode} is running in local-only mode. No collaboration transport is connected.`;
}

function buildLatestEvent(
  mode: Mode,
  {
    latestActivityAt,
    latestActivityLabel,
    pendingHistoryCount = 0,
    runtimeSummary,
    sessionStatus = 'offline',
  }: SceneCollaborationFeedOptions,
): SceneCollaborationEvent {
  if (latestActivityLabel?.trim()) {
    return {
      actorId: 'local-creator',
      id: `${mode}-latest-activity`,
      label:
        pendingHistoryCount > 0
          ? `Queued local note: ${latestActivityLabel}`
          : `Latest editor note: ${latestActivityLabel}`,
      relativeTimeLabel: formatRelativeTime(latestActivityAt),
    };
  }

  if (runtimeSummary?.trim()) {
    return {
      actorId: 'local-creator',
      id: `${mode}-runtime-activity`,
      label: `Latest scene runtime: ${runtimeSummary}`,
      relativeTimeLabel: formatRelativeTime(latestActivityAt),
    };
  }

  return {
    actorId: 'local-creator',
    id: `${mode}-local-status`,
    label:
      sessionStatus === 'ready'
        ? 'Prompt backend linked. No local editor activity has been recorded yet.'
        : 'No local editor activity recorded yet.',
    relativeTimeLabel: 'just now',
  };
}

export function useSceneCollaborationFeed(
  mode: Mode,
  collaborators: ActiveUser[],
  options: SceneCollaborationFeedOptions = {},
) {
  return useMemo<SceneCollaborationFeed>(() => {
    const localUser =
      collaborators.find(collaborator => collaborator.id === 'local-creator') ?? {
        id: 'local-creator',
        isOnline: true,
        name: 'You',
      };
    const latestEvent = buildLatestEvent(mode, options);
    const activeCollaborators: SceneCollaboratorPresence[] = [
      {
        ...localUser,
        currentAction: latestEvent.label,
        isOnline: true,
        roleLabel: 'You',
        status: options.pendingHistoryCount && options.pendingHistoryCount > 0 ? 'editing' : 'watching',
      },
    ];

    return {
      activeCollaborators,
      latestEvent,
      socket: {
        channel: getSyncDetail(mode, options.sessionStatus),
        latencyMs: null,
        stateLabel: getSyncStateLabel(options.sessionStatus),
      },
    };
  }, [collaborators, mode, options]);
}
