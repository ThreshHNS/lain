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
