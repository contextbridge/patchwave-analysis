import { type ReactNode, createContext, useContext, useState } from 'react';

export type DisplayUnit = 'usd' | 'hours';

interface ContextValue {
  unit: DisplayUnit;
  setUnit: (unit: DisplayUnit) => void;
}

const Ctx = createContext<ContextValue | null>(null);

export function DisplayUnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnit] = useState<DisplayUnit>('hours');
  return <Ctx.Provider value={{ unit, setUnit }}>{children}</Ctx.Provider>;
}

export function useDisplayUnit(): ContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useDisplayUnit called outside DisplayUnitProvider');
  }
  return v;
}
