import { type ReactNode, createContext, useContext, useMemo, useRef } from 'react';

export interface FootnoteRegistration {
  id: string;
  title: string;
  body: ReactNode;
}

export interface RegisteredFootnote extends FootnoteRegistration {
  number: number;
}

interface FootnoteContextValue {
  register: (footnote: FootnoteRegistration) => number;
  list: () => RegisteredFootnote[];
}

const FootnoteContext = createContext<FootnoteContextValue | null>(null);

export function FootnoteProvider({ children }: { children: ReactNode }) {
  const footnotes = useRef(new Map<string, RegisteredFootnote>());
  const value = useMemo<FootnoteContextValue>(
    () => ({
      register: (footnote) => {
        const existing = footnotes.current.get(footnote.id);
        if (existing !== undefined) return existing.number;
        const registered = { ...footnote, number: footnotes.current.size + 1 };
        footnotes.current.set(footnote.id, registered);
        return registered.number;
      },
      list: () => [...footnotes.current.values()].sort((a, b) => a.number - b.number),
    }),
    [],
  );

  return <FootnoteContext.Provider value={value}>{children}</FootnoteContext.Provider>;
}

export function useFootnote(footnote: FootnoteRegistration): number {
  const registry = useContext(FootnoteContext);
  if (registry === null) {
    throw new Error('useFootnote must be used within FootnoteProvider');
  }
  return registry.register(footnote);
}

export function useRegisteredFootnotes(): RegisteredFootnote[] {
  const registry = useContext(FootnoteContext);
  if (registry === null) {
    throw new Error('useRegisteredFootnotes must be used within FootnoteProvider');
  }
  return registry.list();
}
