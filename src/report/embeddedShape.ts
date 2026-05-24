import type { ReportBundle, ReportMeta } from './aggregate.ts';

export interface EmbeddedReportData extends Omit<ReportBundle, 'meta'> {
  meta: Omit<ReportMeta, 'generatedAt'> & { generatedAt: string };
}

// The web report consumes the bundle with `generatedAt` serialized to a string.
// This module is intentionally free of runtime imports (types only) so it is safe
// to pull into the browser bundle without dragging in html.ts's embedded template.
export function toEmbeddedShape(bundle: ReportBundle): EmbeddedReportData {
  return {
    ...bundle,
    meta: { ...bundle.meta, generatedAt: bundle.meta.generatedAt.toString() },
  };
}
