import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

export type MethodologyTab = 'calculation' | 'data';

// The cost assumptions panel lives in the methodology appendix, behind a collapsed
// <details>. Footnote links use normal hash anchors; this context only opens the
// disclosure and selects the tab containing the target.
interface ContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeTab: MethodologyTab;
  setActiveTab: (tab: MethodologyTab) => void;
  reveal: (tab?: MethodologyTab) => void;
}

const Ctx = createContext<ContextValue | null>(null);

export function AssumptionsDisclosureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MethodologyTab>('calculation');

  const reveal = useCallback((tab: MethodologyTab = 'calculation') => {
    setActiveTab(tab);
    setOpen(true);
  }, []);

  useEffect(() => {
    const revealHashTarget = () => {
      if (window.location.hash.length <= 1) return;
      const target = decodeURIComponent(window.location.hash.slice(1));
      if (target === 'appendix-assumptions') {
        reveal('calculation');
      }
      if (target === 'appendix-sources' || target.startsWith('footnote-')) {
        setOpen(true);
      }
    };
    revealHashTarget();
    window.addEventListener('hashchange', revealHashTarget);
    return () => window.removeEventListener('hashchange', revealHashTarget);
  }, []);

  return <Ctx.Provider value={{ open, setOpen, activeTab, setActiveTab, reveal }}>{children}</Ctx.Provider>;
}

export function useAssumptionsDisclosure(): ContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useAssumptionsDisclosure called outside AssumptionsDisclosureProvider');
  }
  return v;
}
