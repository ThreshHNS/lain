import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type WebShortcut = {
  handler: () => void;
  keys: string[];
};

function isEditableTarget(target: EventTarget | null) {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;

  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'SELECT' ||
    tagName === 'TEXTAREA'
  );
}

export function useWebKeyboardControls(shortcuts: WebShortcut[], enabled = true) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const shortcut = shortcutsRef.current.find(binding => binding.keys.includes(event.key));
      if (!shortcut) {
        return;
      }

      event.preventDefault();
      shortcut.handler();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}
