import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

import type { Mode } from '@/lib/scene-config';

type HomeFeedContextValue = {
  activeMode: Mode;
  setActiveMode: (mode: Mode) => void;
};

const HomeFeedContext = createContext<HomeFeedContextValue>({
  activeMode: 'awp',
  setActiveMode: () => undefined,
});

export function HomeFeedProvider({ children }: PropsWithChildren) {
  const [activeMode, setActiveMode] = useState<Mode>('awp');
  const value = useMemo(() => ({ activeMode, setActiveMode }), [activeMode]);

  return <HomeFeedContext.Provider value={value}>{children}</HomeFeedContext.Provider>;
}

export function useHomeFeedMode() {
  return useContext(HomeFeedContext);
}
