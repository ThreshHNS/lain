import {
  canAgentExecuteBehavior,
  getDelegationTargets,
  getPromptInputLimit,
  getSceneBehaviorPack,
  getPlatformAgent,
} from '@/lib/runtime/scene-runtime-contract';

describe('scene runtime contract', () => {
  it('keeps tv prompt entry shorter than ios', () => {
    expect(getPromptInputLimit('tv-shell')).toBe(80);
    expect(getPromptInputLimit('ios-shell')).toBe(240);
  });

  it('prevents tv from executing image2sprite locally', () => {
    expect(canAgentExecuteBehavior('tv-shell', 'image2sprite')).toBe(false);
    expect(getDelegationTargets('tv-shell', 'image2sprite')).toEqual([
      'backend-worker',
      'ios-shell',
      'web-shell',
    ]);
  });

  it('allows backend worker to serve as a delegated asset and rag executor', () => {
    expect(canAgentExecuteBehavior('backend-worker', 'image2sprite')).toBe(true);
    expect(canAgentExecuteBehavior('backend-worker', 'rag-query')).toBe(true);
  });

  it('keeps gameplay packs bound to their runtime constraints', () => {
    expect(canAgentExecuteBehavior('tv-shell', 'awp-core-loop')).toBe(false);
    expect(canAgentExecuteBehavior('ios-shell', 'awp-core-loop')).toBe(true);
    expect(getSceneBehaviorPack('slasher-hold-chase').scenes).toEqual(['slasher']);
  });

  it('exposes agent and behavior manifests for future consumers like history and telemetry', () => {
    expect(getPlatformAgent('ios-shell').supportsLinkPreview).toBe(true);
    expect(getSceneBehaviorPack('service-orchestrator').domain).toBe('orchestration');
  });
});
