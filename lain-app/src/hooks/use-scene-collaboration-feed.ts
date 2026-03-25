import { useEffect, useMemo, useState } from 'react';

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
    latencyMs: number;
    stateLabel: string;
  };
};

type CollaborationProfile = {
  currentAction: string;
  roleLabel: string;
  status: SceneCollaboratorStatus;
};

const COLLABORATOR_PROFILES: Record<string, CollaborationProfile> = {
  'local-creator': {
    currentAction: 'Composing the next prompt',
    roleLabel: 'You',
    status: 'editing',
  },
  u2: {
    currentAction: 'Reviewing atmosphere refs',
    roleLabel: 'Asset Librarian',
    status: 'reviewing',
  },
  u3: {
    currentAction: 'Routing the current scene prompt',
    roleLabel: 'Codex',
    status: 'watching',
  },
};

const SCENE_EVENTS: Record<Mode, SceneCollaborationEvent[]> = {
  awp: [
    {
      actorId: 'u3',
      id: 'awp-event-1',
      label: 'Codex updated the target timing draft',
      relativeTimeLabel: 'just now',
    },
    {
      actorId: 'u2',
      id: 'awp-event-2',
      label: 'Ava renamed two muzzle flash refs',
      relativeTimeLabel: '20s ago',
    },
  ],
  slasher: [
    {
      actorId: 'u3',
      id: 'slasher-event-1',
      label: 'Codex synced a new pursuit beat over websocket',
      relativeTimeLabel: 'just now',
    },
    {
      actorId: 'u2',
      id: 'slasher-event-2',
      label: 'Ava updated genre tags for the latest horror refs',
      relativeTimeLabel: '34s ago',
    },
    {
      actorId: 'u3',
      id: 'slasher-event-3',
      label: 'Codex re-routed image2sprite after a phone upload',
      relativeTimeLabel: '1m ago',
    },
  ],
  'tomato-guard': [
    {
      actorId: 'u2',
      id: 'guard-event-1',
      label: 'Ava refreshed lane-defense prop names',
      relativeTimeLabel: 'just now',
    },
    {
      actorId: 'u3',
      id: 'guard-event-2',
      label: 'Codex staged a hit-feedback sprite pass',
      relativeTimeLabel: '46s ago',
    },
  ],
  'tomato-grid': [
    {
      actorId: 'u3',
      id: 'grid-event-1',
      label: 'Codex synced a new timing note from the prompt queue',
      relativeTimeLabel: 'just now',
    },
    {
      actorId: 'u2',
      id: 'grid-event-2',
      label: 'Ava regrouped tile refs by readability',
      relativeTimeLabel: '52s ago',
    },
  ],
};

export function useSceneCollaborationFeed(mode: Mode, collaborators: ActiveUser[]) {
  const [eventIndex, setEventIndex] = useState(0);
  const events = SCENE_EVENTS[mode];

  useEffect(() => {
    setEventIndex(0);
  }, [mode]);

  useEffect(() => {
    if (events.length <= 1) {
      return;
    }

    const intervalId = setInterval(() => {
      setEventIndex(currentIndex => (currentIndex + 1) % events.length);
    }, 4200);

    return () => clearInterval(intervalId);
  }, [events]);

  return useMemo<SceneCollaborationFeed>(() => {
    const latestEvent = events[eventIndex] ?? events[0];
    const activeCollaborators = collaborators.map(collaborator => {
      const profile = COLLABORATOR_PROFILES[collaborator.id] ?? COLLABORATOR_PROFILES.u3;
      const isActor = collaborator.id === latestEvent.actorId;

      return {
        ...collaborator,
        currentAction: isActor ? latestEvent.label : profile.currentAction,
        isOnline: collaborator.id === 'local-creator' ? true : collaborator.id !== 'u2' || isActor,
        roleLabel: profile.roleLabel,
        status: isActor ? 'editing' : profile.status,
      };
    });

    return {
      activeCollaborators: activeCollaborators.filter(collaborator => collaborator.isOnline),
      latestEvent,
      socket: {
        channel: `scene.${mode}.presence`,
        latencyMs: 28 + eventIndex * 4,
        stateLabel: 'websocket live',
      },
    };
  }, [collaborators, eventIndex, events, mode]);
}
