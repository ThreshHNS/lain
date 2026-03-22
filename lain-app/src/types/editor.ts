export type ActiveUser = {
  id: string;
  name: string;
  avatarUrl?: string;
  isOnline: boolean;
};

export type SlotHint = 'walk' | 'kill' | 'seed' | 'idle';

export type HistoryEntry = {
  id: string;
  actor: ActiveUser;
  timestamp: string;
  label: string;
  slot?: SlotHint;
  type: 'voice' | 'text' | 'photo' | 'asset';
};

export type AssetSourceType = 'google_drive' | 'poly_pizza' | 'sketchfab' | 'upload';

export type AssetReference = {
  id: string;
  name: string;
  source: AssetSourceType;
  license: string;
  url: string;
  thumbnail?: string;
  slot?: SlotHint;
  metadata?: Record<string, unknown>;
  updatedAt: string;
};
