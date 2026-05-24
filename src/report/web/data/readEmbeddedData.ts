import type { EmbeddedReportData } from '../types.ts';

const ELEMENT_ID = 'patchwave-data';
const PLACEHOLDER_PREFIX = '__PATCHWAVE_';

export function readEmbeddedData(): EmbeddedReportData {
  const el = document.getElementById(ELEMENT_ID);
  if (!el) {
    throw new Error(`missing #${ELEMENT_ID} script element`);
  }
  const text = el.textContent ?? '';
  if (text.startsWith(PLACEHOLDER_PREFIX)) {
    throw new Error(
      'Embedded data placeholder is unresolved. This HTML was not produced by the patchwave-analysis CLI.',
    );
  }
  return JSON.parse(text) as EmbeddedReportData;
}
