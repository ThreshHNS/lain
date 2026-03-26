import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import type { AssistantId, EditorPreferences, SlotHint } from '@/types/editor';

const STORAGE_KEY = 'lain.editor.preferences';
const STORAGE_FILENAME = 'editor-preferences.json';

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  defaultSlotHint: 'walk',
  preferredAssistantId: 'codex',
  showPromptHistoryPreview: true,
  showStatusPills: true,
};

type EditorPreferencesContextValue = {
  preferences: EditorPreferences;
  preferencesHydrated: boolean;
  resetPreferences: () => void;
  updatePreferences: (patch: Partial<EditorPreferences>) => void;
};

const VALID_ASSISTANTS = new Set<AssistantId>(['codex', 'claude', 'gpt-5', 'gemini']);
const VALID_SLOT_HINTS = new Set<SlotHint>(['walk', 'kill', 'seed', 'idle']);

let inMemoryPreferences = DEFAULT_EDITOR_PREFERENCES;

const EditorPreferencesContext = createContext<EditorPreferencesContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePreferences(value: unknown): EditorPreferences {
  if (!isRecord(value)) {
    return DEFAULT_EDITOR_PREFERENCES;
  }

  const preferredAssistantId = VALID_ASSISTANTS.has(value.preferredAssistantId as AssistantId)
    ? (value.preferredAssistantId as AssistantId)
    : DEFAULT_EDITOR_PREFERENCES.preferredAssistantId;
  const defaultSlotHint = VALID_SLOT_HINTS.has(value.defaultSlotHint as SlotHint)
    ? (value.defaultSlotHint as SlotHint)
    : DEFAULT_EDITOR_PREFERENCES.defaultSlotHint;

  return {
    defaultSlotHint,
    preferredAssistantId,
    showPromptHistoryPreview:
      typeof value.showPromptHistoryPreview === 'boolean'
        ? value.showPromptHistoryPreview
        : DEFAULT_EDITOR_PREFERENCES.showPromptHistoryPreview,
    showStatusPills:
      typeof value.showStatusPills === 'boolean'
        ? value.showStatusPills
        : DEFAULT_EDITOR_PREFERENCES.showStatusPills,
  };
}

async function loadStoredPreferences() {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) {
      return inMemoryPreferences;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return inMemoryPreferences;
      }

      const parsed = normalizePreferences(JSON.parse(stored));
      inMemoryPreferences = parsed;
      return parsed;
    } catch {
      return inMemoryPreferences;
    }
  }

  try {
    const FileSystem = await import('expo-file-system/legacy');
    if (!FileSystem.documentDirectory) {
      return inMemoryPreferences;
    }

    const contents = await FileSystem.readAsStringAsync(
      `${FileSystem.documentDirectory}${STORAGE_FILENAME}`,
    );
    const parsed = normalizePreferences(JSON.parse(contents));
    inMemoryPreferences = parsed;
    return parsed;
  } catch {
    return inMemoryPreferences;
  }
}

async function persistPreferences(nextPreferences: EditorPreferences) {
  inMemoryPreferences = nextPreferences;

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPreferences));
    } catch {
      return;
    }

    return;
  }

  try {
    const FileSystem = await import('expo-file-system/legacy');
    if (!FileSystem.documentDirectory) {
      return;
    }

    await FileSystem.writeAsStringAsync(
      `${FileSystem.documentDirectory}${STORAGE_FILENAME}`,
      JSON.stringify(nextPreferences),
    );
  } catch {
    return;
  }
}

export function EditorPreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<EditorPreferences>(DEFAULT_EDITOR_PREFERENCES);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void loadStoredPreferences().then((storedPreferences) => {
      if (!isMounted) {
        return;
      }

      setPreferences(storedPreferences);
      setPreferencesHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const updatePreferences = useCallback((patch: Partial<EditorPreferences>) => {
    setPreferences((currentPreferences) => {
      const nextPreferences = {
        ...currentPreferences,
        ...patch,
      };

      void persistPreferences(nextPreferences);
      return nextPreferences;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_EDITOR_PREFERENCES);
    void persistPreferences(DEFAULT_EDITOR_PREFERENCES);
  }, []);

  const value = useMemo<EditorPreferencesContextValue>(
    () => ({
      preferences,
      preferencesHydrated,
      resetPreferences,
      updatePreferences,
    }),
    [preferences, preferencesHydrated, resetPreferences, updatePreferences],
  );

  return (
    <EditorPreferencesContext.Provider value={value}>
      {children}
    </EditorPreferencesContext.Provider>
  );
}

export function useEditorPreferences() {
  const context = useContext(EditorPreferencesContext);
  if (!context) {
    throw new Error('useEditorPreferences must be used within EditorPreferencesProvider');
  }

  return context;
}
