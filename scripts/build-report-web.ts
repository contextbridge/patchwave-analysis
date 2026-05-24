import tailwindPlugin from 'bun-plugin-tailwind';

const result = await Bun.build({
  entrypoints: ['./src/report/web/index.html'],
  compile: true,
  target: 'browser',
  outdir: './dist/report-web',
  minify: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  plugins: [tailwindPlugin],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const out = result.outputs[0]?.path ?? 'dist/report-web/index.html';
const html = await Bun.file('./dist/report-web/index.html').text();
if (!html.includes('__PATCHWAVE_DATA__')) {
  console.error('dist/report-web/index.html is missing __PATCHWAVE_DATA__');
  process.exit(1);
}
if (html.includes('jsxDEV')) {
  console.error('dist/report-web/index.html contains React development markers');
  process.exit(1);
}
console.log(`built ${out}`);
