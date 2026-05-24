import { type ReactNode, createContext, useContext } from 'react';
import type { EmbeddedReportData } from '../types.ts';

const Ctx = createContext<EmbeddedReportData | null>(null);

export function EmbeddedDataProvider({ value, children }: { value: EmbeddedReportData; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEmbeddedData(): EmbeddedReportData {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useEmbeddedData called outside EmbeddedDataProvider');
  }
  return v;
}
