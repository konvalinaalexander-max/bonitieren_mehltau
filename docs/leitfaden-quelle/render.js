// Usage: node render.js input.html output.pdf
const { chromium } = require('playwright');
(async () => {
  const [inp, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + require('path').resolve(inp), { waitUntil: 'networkidle', timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
