import type { Mode } from '@/lib/scene-config';
import type { SlotHint } from '@/types/editor';

export type TokenUsage = {
  cached: number;
  input: number;
  output: number;
  total: number;
};

export type PromptRunStatus = 'queued' | 'settled' | 'streaming';

export type PromptRun = {
  id: string;
  agent: string;
  createdAt: string;
  prompt: string;
  responsePreview: string;
  serviceLabels: string[];
  slot: SlotHint;
  status: PromptRunStatus;
  title: string;
  usage: TokenUsage;
};

export type ScenePromptTelemetry = {
  activeRun: PromptRun;
  queueDepth: number;
  recentRuns: PromptRun[];
  sessionUsage: TokenUsage;
};

function usage(input: number, output: number, cached = 0): TokenUsage {
  return {
    cached,
    input,
    output,
    total: input + output + cached,
  };
}

const PROMPT_TELEMETRY: Partial<Record<Mode, ScenePromptTelemetry>> = {
  awp: {
    activeRun: {
      agent: 'Scene Director',
      createdAt: '2026-03-23T17:28:00.000Z',
      id: 'awp-run-active',
      prompt: 'Sharpen the sniper beat, push the foreground target, and keep one strong payoff frame.',
      responsePreview:
        'Streaming camera notes, target timing, and one asset handoff for the muzzle flash pass.',
      serviceLabels: ['prompt-router', 'scene-draft-export'],
      slot: 'kill',
      status: 'streaming',
      title: 'Hero shot pass',
      usage: usage(1180, 362, 420),
    },
    queueDepth: 1,
    recentRuns: [
      {
        agent: 'Codex Orchestrator',
        createdAt: '2026-03-23T17:18:00.000Z',
        id: 'awp-run-1',
        prompt: 'Reduce the HUD feel and keep the scene looking more like a cinematic beat.',
        responsePreview: 'Returned a compact overlay plan with two prop swaps and one timing change.',
        serviceLabels: ['prompt-router', 'asset-librarian'],
        slot: 'seed',
        status: 'settled',
        title: 'Overlay cleanup',
        usage: usage(954, 281, 160),
      },
      {
        agent: 'Asset Librarian',
        createdAt: '2026-03-23T16:54:00.000Z',
        id: 'awp-run-2',
        prompt: 'Group the latest references into prop, background, and FX buckets.',
        responsePreview: 'Sorted 14 files and suggested shorter names for sprite-ready exports.',
        serviceLabels: ['asset-librarian'],
        slot: 'seed',
        status: 'settled',
        title: 'Reference sort',
        usage: usage(622, 210, 84),
      },
    ],
    sessionUsage: usage(4820, 1328, 664),
  },
  slasher: {
    activeRun: {
      agent: 'Codex Orchestrator',
      createdAt: '2026-03-23T18:02:00.000Z',
      id: 'slasher-run-active',
      prompt:
        'Keep the scene colder, tighten the pursuit beat, and route new refs through genre tags before committing them.',
      responsePreview:
        'Streaming a short plan for pursuit timing, one atmosphere pass, and queued asset analysis.',
      serviceLabels: ['prompt-router', 'genre-analysis', 'scene-draft-export'],
      slot: 'walk',
      status: 'streaming',
      title: 'Pursuit tension pass',
      usage: usage(1460, 428, 510),
    },
    queueDepth: 2,
    recentRuns: [
      {
        agent: 'Scene Director',
        createdAt: '2026-03-23T17:34:00.000Z',
        id: 'slasher-run-1',
        prompt: 'Slow the movement cadence and pull the killer closer to center frame.',
        responsePreview: 'Returned camera and blocking notes plus one audio cue recommendation.',
        serviceLabels: ['scene-director', 'audio-pass'],
        slot: 'walk',
        status: 'settled',
        title: 'Blocking revision',
        usage: usage(1104, 316, 192),
      },
      {
        agent: 'Asset Librarian',
        createdAt: '2026-03-23T17:12:00.000Z',
        id: 'slasher-run-2',
        prompt: 'Analyze the attached images and tag them by horror subgenre and surface material.',
        responsePreview: 'Generated genre tags, texture hints, and two AI title options.',
        serviceLabels: ['asset-librarian', 'genre-analysis'],
        slot: 'seed',
        status: 'settled',
        title: 'Genre tagging',
        usage: usage(886, 244, 118),
      },
      {
        agent: 'Service Orchestrator',
        createdAt: '2026-03-23T16:43:00.000Z',
        id: 'slasher-run-3',
        prompt: 'Plan the next service chain for image2sprite and a later 3D room scan import.',
        responsePreview: 'Queued image2sprite first, deferred space scan until new capture arrives.',
        serviceLabels: ['service-orchestrator', 'image2sprite'],
        slot: 'idle',
        status: 'queued',
        title: 'Service routing',
        usage: usage(734, 190, 96),
      },
    ],
    sessionUsage: usage(6230, 1770, 916),
  },
  'tomato-guard': {
    activeRun: {
      agent: 'Scene Director',
      createdAt: '2026-03-23T18:08:00.000Z',
      id: 'guard-run-active',
      prompt: 'Make the lane defense feel clearer and add a stronger impact read on hit.',
      responsePreview: 'Streaming enemy timing notes and one proposal for a larger impact sprite.',
      serviceLabels: ['scene-director', 'image2sprite'],
      slot: 'kill',
      status: 'streaming',
      title: 'Impact clarity',
      usage: usage(1022, 301, 184),
    },
    queueDepth: 1,
    recentRuns: [
      {
        agent: 'Codex Orchestrator',
        createdAt: '2026-03-23T17:20:00.000Z',
        id: 'guard-run-1',
        prompt: 'Reduce clutter in the lane and keep pickups easier to read.',
        responsePreview: 'Suggested a cleaner prop split and brighter pickup treatment.',
        serviceLabels: ['prompt-router'],
        slot: 'seed',
        status: 'settled',
        title: 'Lane cleanup',
        usage: usage(772, 215, 112),
      },
    ],
    sessionUsage: usage(3440, 972, 404),
  },
  'tomato-grid': {
    activeRun: {
      agent: 'Service Orchestrator',
      createdAt: '2026-03-23T18:12:00.000Z',
      id: 'grid-run-active',
      prompt: 'Route timing changes and prepare a sprite sheet if new phone captures arrive.',
      responsePreview: 'Streaming a service plan for timing tuning and optional sprite conversion.',
      serviceLabels: ['service-orchestrator', 'image2sprite'],
      slot: 'idle',
      status: 'streaming',
      title: 'Timing workflow',
      usage: usage(894, 276, 104),
    },
    queueDepth: 1,
    recentRuns: [
      {
        agent: 'Asset Librarian',
        createdAt: '2026-03-23T17:04:00.000Z',
        id: 'grid-run-1',
        prompt: 'Tag the current grid references by palette and legibility.',
        responsePreview: 'Returned palette clusters and an order for visual cleanup.',
        serviceLabels: ['asset-librarian'],
        slot: 'seed',
        status: 'settled',
        title: 'Palette tagging',
        usage: usage(640, 188, 80),
      },
    ],
    sessionUsage: usage(2814, 836, 242),
  },
};

function createFallbackPromptTelemetry(mode: Mode): ScenePromptTelemetry {
  return {
    activeRun: {
      agent: 'Prompt Router',
      createdAt: '2026-03-23T18:30:00.000Z',
      id: `${mode}-run-fallback`,
      prompt: 'Prompt telemetry mock is not seeded for this scene yet.',
      responsePreview: 'Waiting for real prompt traces or a scene-specific mock payload.',
      serviceLabels: [],
      slot: 'idle',
      status: 'queued',
      title: 'No telemetry yet',
      usage: usage(0, 0),
    },
    queueDepth: 0,
    recentRuns: [],
    sessionUsage: usage(0, 0),
  };
}

export function getPromptTelemetryMock(mode: Mode) {
  return PROMPT_TELEMETRY[mode] ?? createFallbackPromptTelemetry(mode);
}

export function formatTokenCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }

  return String(value);
}
