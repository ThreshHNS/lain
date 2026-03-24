export type SceneInputModel = 'drag' | 'hold' | 'mixed' | 'remote' | 'tap';

export type SceneDraftStatus = 'draft' | 'ready';

export type SceneDraft = {
  brief: string;
  createdAt: string;
  creatorId: string;
  id: string;
  inputModel: SceneInputModel;
  promptSessionId: string;
  slug: string;
  status: SceneDraftStatus;
  title: string;
  updatedAt: string;
};

export type CreateSceneDraftInput = {
  brief: string;
  creatorId: string;
  initialPrompt?: string;
  inputModel: SceneInputModel;
  title: string;
};
