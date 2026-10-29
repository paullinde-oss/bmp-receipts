// Syntax-check the inline module script in index.html before deploying.
// Usage: npm run check
const acorn = require('acorn');
const fs = require('fs');

const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const m = [...html.matchAll(/<script[^>]*>/g)];
if (!m.length) { console.error('ERR no <script> tag found'); process.exit(1); }
const s = m[0].index + m[0][0].length;
const js = html.slice(s, html.indexOf('</script>', s));
try {
  acorn.parse(js, { ecmaVersion: 2022, sourceType: 'module' });
  console.log('OK');
} catch (e) {
  const pos = e.pos ?? 0;
  console.error('ERR', e.message);
  console.error('context:', js.slice(Math.max(0, pos - 120), pos + 120));
  process.exit(1);
}
