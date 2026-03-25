import type { Mode } from '@/lib/scene-config';

export type PlatformAgentId = 'ios-shell' | 'web-shell' | 'tv-shell' | 'backend-worker';

export type AgentSurface = 'background-job' | 'native-shell' | 'webview-scene';

export type AgentInput =
  | 'keyboard'
  | 'remote'
  | 'short-text'
  | 'touch'
  | 'voice';

export type AgentConnector =
  | 'google_drive'
  | 'internal_rag'
  | 'photo_library'
  | 'room_scan'
  | 'web_search';

export type BehaviorDomain =
  | 'asset-pipeline'
  | 'knowledge'
  | 'orchestration'
  | 'scene-authoring'
  | 'scene-play';

export type BehaviorRunStrategy = 'background-only' | 'delegate-if-needed' | 'local-first';

export type BehaviorPromptShape = 'full-brief' | 'none' | 'short-command';

export type BehaviorArtifact =
  | 'asset-bundle'
  | 'knowledge-result'
  | 'room-layout'
  | 'scene-state'
  | 'service-plan'
  | 'sprite-pack';

export type BehaviorPackId =
  | 'asset-librarian'
  | 'awp-core-loop'
  | 'image2sprite'
  | 'rag-query'
  | 'room-scan-import'
  | 'scene-director'
  | 'service-orchestrator'
  | 'slasher-hold-chase'
  | 'tomato-guard-lane-defense'
  | 'tomato-grid-tile-timing';

export type SceneTarget = Mode | 'shared';

export type BehaviorPackSource = {
  author: string;
  packId: string;
  scope: 'builtin' | 'marketplace';
  version: string;
};

export type PlatformAgentManifest = {
  connectors: AgentConnector[];
  id: PlatformAgentId;
  inputs: AgentInput[];
  label: string;
  promptInputLimit: number;
  supportsBackgroundRuns: boolean;
  supportsLinkPreview: boolean;
  surfaces: AgentSurface[];
};

export type SceneBehaviorPackManifest = {
  domain: BehaviorDomain;
  id: BehaviorPackId;
  label: string;
  outputArtifacts: BehaviorArtifact[];
  preferredAgents: PlatformAgentId[];
  promptShape: BehaviorPromptShape;
  requiredConnectors: AgentConnector[];
  requiredInputs: AgentInput[];
  runStrategy: BehaviorRunStrategy;
  scenes: SceneTarget[];
  source: BehaviorPackSource;
};

export type PromptThreadRecord = {
  createdAt: string;
  currentRunId: string | null;
  id: string;
  sceneId: Mode;
  title: string;
};

export type PromptMessageRecord = {
  actorAgentId: PlatformAgentId;
  createdAt: string;
  id: string;
  role: 'assistant' | 'system' | 'tool' | 'user';
  sourceBehaviorId: BehaviorPackId | null;
  text: string;
  threadId: string;
};

export type TokenUsageRecord = {
  cached: number;
  input: number;
  output: number;
  total: number;
};

export type BehaviorRunRecord = {
  behaviorId: BehaviorPackId;
  createdAt: string;
  errorMessage?: string;
  executedByAgentId: PlatformAgentId;
  id: string;
  requestedByAgentId: PlatformAgentId;
  sceneId: Mode;
  sourceMessageId: string | null;
  status: 'failed' | 'queued' | 'running' | 'settled';
  threadId: string;
  tokenUsage: TokenUsageRecord | null;
};

export type BehaviorArtifactRecord = {
  kind: BehaviorArtifact;
  metadata: Record<string, unknown>;
  runId: string;
  uri?: string;
};

export type BehaviorDelegationRecord = {
  createdAt: string;
  fromAgentId: PlatformAgentId;
  id: string;
  reason:
    | 'background-preferred'
    | 'connector-mismatch'
    | 'input-mismatch'
    | 'platform-mismatch';
  runId: string;
  status: 'accepted' | 'completed' | 'requested';
  toAgentId: PlatformAgentId;
};

export const PLATFORM_AGENTS: readonly PlatformAgentManifest[] = [
  {
    connectors: ['google_drive', 'internal_rag', 'photo_library', 'room_scan', 'web_search'],
    id: 'ios-shell',
    inputs: ['touch', 'voice', 'keyboard', 'short-text'],
    label: 'iOS shell',
    promptInputLimit: 240,
    supportsBackgroundRuns: true,
    supportsLinkPreview: true,
    surfaces: ['native-shell', 'webview-scene'],
  },
  {
    connectors: ['google_drive', 'internal_rag', 'web_search'],
    id: 'web-shell',
    inputs: ['touch', 'keyboard', 'short-text'],
    label: 'Web shell',
    promptInputLimit: 240,
    supportsBackgroundRuns: true,
    supportsLinkPreview: false,
    surfaces: ['native-shell', 'webview-scene'],
  },
  {
    connectors: ['internal_rag'],
    id: 'tv-shell',
    inputs: ['remote', 'short-text', 'keyboard'],
    label: 'TV shell',
    promptInputLimit: 80,
    supportsBackgroundRuns: false,
    supportsLinkPreview: false,
    surfaces: ['native-shell', 'webview-scene'],
  },
  {
    connectors: ['google_drive', 'internal_rag', 'room_scan', 'web_search'],
    id: 'backend-worker',
    inputs: [],
    label: 'Backend worker',
    promptInputLimit: 0,
    supportsBackgroundRuns: true,
    supportsLinkPreview: false,
    surfaces: ['background-job'],
  },
] as const;

export const SCENE_BEHAVIOR_PACKS: readonly SceneBehaviorPackManifest[] = [
  {
    domain: 'scene-authoring',
    id: 'scene-director',
    label: 'Scene Director',
    outputArtifacts: ['scene-state'],
    preferredAgents: ['ios-shell', 'web-shell', 'backend-worker'],
    promptShape: 'full-brief',
    requiredConnectors: ['internal_rag'],
    requiredInputs: ['short-text'],
    runStrategy: 'local-first',
    scenes: ['shared'],
    source: {
      author: 'lain',
      packId: 'scene-director',
      scope: 'builtin',
      version: '1.0.0',
    },
  },
  {
    domain: 'asset-pipeline',
    id: 'asset-librarian',
    label: 'Asset Librarian',
    outputArtifacts: ['asset-bundle', 'knowledge-result'],
    preferredAgents: ['ios-shell', 'web-shell', 'backend-worker'],
    promptShape: 'full-brief',
    requiredConnectors: ['internal_rag'],
    requiredInputs: ['short-text'],
    runStrategy: 'local-first',
    scenes: ['shared'],
    source: {
      author: 'lain',
      packId: 'asset-librarian',
      scope: 'builtin',
      version: '1.0.0',
    },
  },
  {
    domain: 'asset-pipeline',
    id: 'image2sprite',
    label: 'Image2sprite',
    outputArtifacts: ['sprite-pack'],
    preferredAgents: ['backend-worker', 'ios-shell', 'web-shell'],
    promptShape: 'full-brief',
    requiredConnectors: ['google_drive', 'web_search'],
    requiredInputs: ['short-text'],
    runStrategy: 'delegate-if-needed',
    scenes: ['shared'],
    source: {
      author: 'lain',
      packId: 'image2sprite',
      scope: 'marketplace',
      version: '1.0.0',
    },
  },
  {
    domain: 'knowledge',
    id: 'rag-query',
    label: 'RAG Query',
    outputArtifacts: ['knowledge-result'],
    preferredAgents: ['backend-worker', 'ios-shell', 'web-shell', 'tv-shell'],
    promptShape: 'short-command',
    requiredConnectors: ['internal_rag'],
    requiredInputs: ['short-text'],
    runStrategy: 'delegate-if-needed',
    scenes: ['shared'],
    source: {
      author: 'lain',
      packId: 'rag-query',
      scope: 'builtin',
      version: '1.0.0',
    },
  },
  {
    domain: 'orchestration',
    id: 'service-orchestrator',
    label: 'Service Orchestrator',
    outputArtifacts: ['service-plan'],
    preferredAgents: ['backend-worker', 'ios-shell', 'web-shell'],
    promptShape: 'full-brief',
    requiredConnectors: ['internal_rag'],
    requiredInputs: ['short-text'],
    runStrategy: 'delegate-if-needed',
    scenes: ['shared'],
    source: {
      author: 'lain',
      packId: 'service-orchestrator',
      scope: 'builtin',
      version: '1.0.0',
    },
  },
  {
    domain: 'asset-pipeline',
    id: 'room-scan-import',
    label: 'Room Scan Import',
    outputArtifacts: ['room-layout', 'scene-state'],
    preferredAgents: ['ios-shell', 'backend-worker'],
    promptShape: 'short-command',
    requiredConnectors: ['room_scan'],
    requiredInputs: ['short-text'],
    runStrategy: 'delegate-if-needed',
    scenes: ['shared'],
    source: {
      author: 'lain',
      packId: 'room-scan-import',
      scope: 'marketplace',
      version: '1.0.0',
    },
  },
  {
    domain: 'scene-play',
    id: 'awp-core-loop',
    label: 'AWP Core Loop',
    outputArtifacts: ['scene-state'],
    preferredAgents: ['ios-shell', 'web-shell', 'tv-shell'],
    promptShape: 'none',
    requiredConnectors: [],
    requiredInputs: ['touch'],
    runStrategy: 'local-first',
    scenes: ['awp'],
    source: {
      author: 'lain',
      packId: 'awp-core-loop',
      scope: 'builtin',
      version: '1.0.0',
    },
  },
  {
    domain: 'scene-play',
    id: 'slasher-hold-chase',
    label: 'Slasher Hold Chase',
    outputArtifacts: ['scene-state'],
    preferredAgents: ['ios-shell', 'web-shell'],
    promptShape: 'none',
    requiredConnectors: [],
    requiredInputs: ['touch'],
    runStrategy: 'local-first',
    scenes: ['slasher'],
    source: {
      author: 'lain',
      packId: 'slasher-hold-chase',
      scope: 'builtin',
      version: '1.0.0',
    },
  },
  {
    domain: 'scene-play',
    id: 'tomato-guard-lane-defense',
    label: 'Tomato Guard Lane Defense',
    outputArtifacts: ['scene-state'],
    preferredAgents: ['ios-shell', 'web-shell'],
    promptShape: 'none',
    requiredConnectors: [],
    requiredInputs: ['touch'],
    runStrategy: 'local-first',
    scenes: ['tomato-guard'],
    source: {
      author: 'lain',
      packId: 'tomato-guard-lane-defense',
      scope: 'builtin',
      version: '1.0.0',
    },
  },
  {
    domain: 'scene-play',
    id: 'tomato-grid-tile-timing',
    label: 'Tomato Grid Tile Timing',
    outputArtifacts: ['scene-state'],
    preferredAgents: ['ios-shell', 'web-shell', 'tv-shell'],
    promptShape: 'none',
    requiredConnectors: [],
    requiredInputs: ['touch'],
    runStrategy: 'local-first',
    scenes: ['tomato-grid'],
    source: {
      author: 'lain',
      packId: 'tomato-grid-tile-timing',
      scope: 'builtin',
      version: '1.0.0',
    },
  },
] as const;

export function getPlatformAgent(agentId: PlatformAgentId) {
  const manifest = PLATFORM_AGENTS.find(agent => agent.id === agentId);
  if (!manifest) {
    throw new Error(`Unknown platform agent: ${agentId}`);
  }
  return manifest;
}

export function getSceneBehaviorPack(behaviorId: BehaviorPackId) {
  const manifest = SCENE_BEHAVIOR_PACKS.find(behavior => behavior.id === behaviorId);
  if (!manifest) {
    throw new Error(`Unknown behavior pack: ${behaviorId}`);
  }
  return manifest;
}

function hasInputs(agent: PlatformAgentManifest, behavior: SceneBehaviorPackManifest) {
  return behavior.requiredInputs.every(input => agent.inputs.includes(input));
}

function hasConnectors(agent: PlatformAgentManifest, behavior: SceneBehaviorPackManifest) {
  return behavior.requiredConnectors.every(connector => agent.connectors.includes(connector));
}

function isWorkerExecution(agent: PlatformAgentManifest) {
  return agent.surfaces.includes('background-job');
}

export function canAgentExecuteBehavior(agentId: PlatformAgentId, behaviorId: BehaviorPackId) {
  const agent = getPlatformAgent(agentId);
  const behavior = getSceneBehaviorPack(behaviorId);

  if (behavior.runStrategy === 'background-only') {
    return agent.surfaces.includes('background-job') && hasConnectors(agent, behavior);
  }

  if (isWorkerExecution(agent)) {
    return hasConnectors(agent, behavior);
  }

  return hasInputs(agent, behavior) && hasConnectors(agent, behavior);
}

export function getDelegationTargets(agentId: PlatformAgentId, behaviorId: BehaviorPackId) {
  return getSceneBehaviorPack(behaviorId).preferredAgents.filter(
    targetAgentId => targetAgentId !== agentId && canAgentExecuteBehavior(targetAgentId, behaviorId),
  );
}

export function getPromptInputLimit(agentId: PlatformAgentId) {
  return getPlatformAgent(agentId).promptInputLimit;
}
