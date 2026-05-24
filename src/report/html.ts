// The `with { type: 'text' }` attribute tells Bun to load the HTML file as a plain
// string, but the global *.html module declaration types it as HTMLBundle. Cast at
// the boundary so the rest of this module sees a string.
import { type Result, err, ok } from 'neverthrow';
import reportTemplateRaw from '../../dist/report-web/index.html' with { type: 'text' };
import type { ReportBundle } from './aggregate.ts';
import { type EmbeddedReportData, toEmbeddedShape } from './embeddedShape.ts';

export { type EmbeddedReportData, toEmbeddedShape };

const reportTemplate = reportTemplateRaw as unknown as string;

const DATA_PLACEHOLDER = '__PATCHWAVE_DATA__';

const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

export type RenderError = { kind: 'missing-placeholder'; message: string };

export function renderHtml(bundle: ReportBundle): Result<string, RenderError> {
  return renderHtmlFrom(reportTemplate, bundle);
}

export function renderHtmlFrom(template: string, bundle: ReportBundle): Result<string, RenderError> {
  if (!template.includes(DATA_PLACEHOLDER)) {
    return err({
      kind: 'missing-placeholder',
      message: `report template missing ${DATA_PLACEHOLDER} - rebuild dist/report-web/index.html`,
    });
  }
  const json = escapeForJsonScriptTag(JSON.stringify(toEmbeddedShape(bundle)));
  return ok(template.replace(DATA_PLACEHOLDER, json));
}

function escapeForJsonScriptTag(json: string): string {
  return json
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\!--')
    .split(LINE_SEP)
    .join('\\u2028')
    .split(PARA_SEP)
    .join('\\u2029');
}
