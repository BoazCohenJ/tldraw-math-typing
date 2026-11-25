// End-to-end tests in Zen (or Firefox) with the built Firefox package, on tldraw.com.
// Run: npm run e2e:zen
//   ZEN_PATH     the browser (default: C:\Program Files\Zen Browser\zen.exe; Firefox works too)
//   GECKODRIVER  geckodriver.exe (default: "geckodriver" on PATH)
//   HEADED=1     show the browser window
//   ONLY=typing  run one suite
// Each suite installs the add-on temporarily in a fresh profile and prints "N/M ok".
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const xpi = path.join(root, 'dist', `math-typing-firefox-${pkg.version}.xpi`);
const gd = process.env.GECKODRIVER || 'geckodriver';
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-zen-'));
const SUITES = ['suite', 'typing', 'editing', 'plots', 'worker', 'open-tab', 'worksheet'];

let failed = 0;
for (const name of SUITES.filter((s) => !process.env.ONLY || s === process.env.ONLY)) {
  console.log(`\n== ${name}`);
  const env = { ...process.env, ...(name === 'open-tab' ? { LATE: '1' } : {}) };
  const r = spawnSync(process.execPath, [path.join(__dirname, 'zen', `${name}.cjs`), xpi, gd, out], { env, encoding: 'utf8' });
  const lines = `${r.stdout}${r.stderr}`.split('\n').filter((l) => /^(ok|FAIL)|\d+\/\d+ ok|Error|shapes:/.test(l));
  console.log(lines.join('\n'));
  if (r.status !== 0 || lines.some((l) => l.startsWith('FAIL'))) failed++;
}
console.log(`\nscreenshots: ${out}`);
process.exitCode = failed ? 1 : 0;
