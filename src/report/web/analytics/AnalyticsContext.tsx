import { type ReactNode, createContext, useContext } from 'react';
import { type Analytics, createNoopAnalytics } from '../../../Analytics.ts';

// Defaults to a noop so components (and the dev server / tests that render them without a
// provider) can call useAnalytics() unconditionally.
const Ctx = createContext<Analytics>(createNoopAnalytics());

export function AnalyticsProvider({ value, children }: { value: Analytics; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalytics(): Analytics {
  return useContext(Ctx);
}
