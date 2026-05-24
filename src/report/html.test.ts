import { describe, expect, test } from 'bun:test';
import { renderHtmlFrom, toEmbeddedShape } from './html.ts';
import { reportBundle, reportMeta } from './testFactories.ts';

const STUB_TEMPLATE =
  '<!doctype html><html><body><script type="application/json" id="patchwave-data">__PATCHWAVE_DATA__</script></body></html>';

const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

describe('toEmbeddedShape', () => {
  test('converts Instant generatedAt to an ISO string', () => {
    const bundle = reportBundle.build();
    const shape = toEmbeddedShape(bundle);
    expect(typeof shape.meta.generatedAt).toBe('string');
    expect(shape.meta.generatedAt).toBe(bundle.meta.generatedAt.toString());
  });

  test('preserves all other slices verbatim', () => {
    const bundle = reportBundle.build();
    const shape = toEmbeddedShape(bundle);
    expect(shape.orgOverview).toEqual(bundle.orgOverview);
    expect(shape.dependabotCoverage).toEqual(bundle.dependabotCoverage);
    expect(shape.prBacklog).toEqual(bundle.prBacklog);
    expect(shape.stalledSignals).toEqual(bundle.stalledSignals);
    expect(shape.people).toEqual(bundle.people);
    expect(shape.costEstimate).toEqual(bundle.costEstimate);
    expect(shape.cve).toEqual(bundle.cve);
  });
});

describe('renderHtmlFrom', () => {
  test('substitutes the placeholder and embeds parseable JSON', () => {
    const bundle = reportBundle.build();
    const result = renderHtmlFrom(STUB_TEMPLATE, bundle);
    expect(result.isOk()).toBe(true);
    const rendered = result.unwrapOr('');

    expect(rendered).not.toContain('__PATCHWAVE_DATA__');
    expect(rendered).toContain('<script type="application/json" id="patchwave-data">');

    const match = /<script type="application\/json" id="patchwave-data">([\s\S]*?)<\/script>/.exec(rendered);
    expect(match).not.toBeNull();
    const json = match?.[1] ?? '';
    const parsed = JSON.parse(json) as { meta: { org: string } };
    expect(parsed.meta.org).toBe(bundle.meta.org);
  });

  test('returns a missing-placeholder err when the placeholder is absent', () => {
    const bundle = reportBundle.build();
    const result = renderHtmlFrom('<html><body>no placeholder</body></html>', bundle);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toMatchObject({ kind: 'missing-placeholder' });
  });

  test('escapes </script> sequences inside the embedded JSON', () => {
    const bundle = reportBundle.build({
      meta: reportMeta.build({ org: 'malicious</script><script>alert(1)</script>' }),
    });
    const result = renderHtmlFrom(STUB_TEMPLATE, bundle);
    expect(result.isOk()).toBe(true);
    const rendered = result.unwrapOr('');
    const scriptCloses = rendered.match(/<\/script>/gi) ?? [];
    expect(scriptCloses).toHaveLength(1);
    expect(rendered).toContain('<\\/script>');
  });

  test('escapes <!-- sequences and U+2028 / U+2029 line separators', () => {
    const bundle = reportBundle.build({
      meta: reportMeta.build({ org: `a<!--b${LINE_SEP}c${PARA_SEP}d` }),
    });
    const result = renderHtmlFrom(STUB_TEMPLATE, bundle);
    expect(result.isOk()).toBe(true);
    const rendered = result.unwrapOr('');
    expect(rendered).toContain('<\\!--');
    expect(rendered).not.toContain(LINE_SEP);
    expect(rendered).not.toContain(PARA_SEP);
  });
});
