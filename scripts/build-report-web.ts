import tailwindPlugin from 'bun-plugin-tailwind';

const result = await Bun.build({
  entrypoints: ['./src/report/web/index.html'],
  compile: true,
  target: 'browser',
  outdir: './dist/report-web',
  minify: true,
  define: {
    'process.env.NODE_ENV': '"production"',
    // Same build-time telemetry injection as the CLI binary (see .goreleaser.yaml). The CLI
    // compile gets these via `--define`; the web bundle is a separate build, so it reads the same
    // env vars here. Absent (local/dev) they fall back to '', which disables report analytics.
    __PW_POSTHOG_KEY__: JSON.stringify(process.env['__PW_POSTHOG_KEY__'] ?? ''),
    __PW_POSTHOG_HOST__: JSON.stringify(process.env['__PW_POSTHOG_HOST__'] ?? ''),
  },
  plugins: [tailwindPlugin],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const out = result.outputs[0]?.path ?? 'dist/report-web/index.html';
const html = await Bun.file('./dist/report-web/index.html').text();
for (const placeholder of ['__PATCHWAVE_DATA__', '__PATCHWAVE_ANALYTICS__']) {
  if (!html.includes(placeholder)) {
    console.error(`dist/report-web/index.html is missing ${placeholder}`);
    process.exit(1);
  }
}
if (html.includes('jsxDEV')) {
  console.error('dist/report-web/index.html contains React development markers');
  process.exit(1);
}
console.log(`built ${out}`);
