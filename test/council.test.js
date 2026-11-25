// Run: node --test
// Regression tests for the issues found in the pre-release review.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console: { ...console, log() {}, error() {} }, Math }, { codeGeneration: { strings: false, wasm: false } });
ctx.window = ctx;
ctx.globalThis = ctx;
for (const f of ['vendor/nerdamer/nerdamer.core.js', 'vendor/nerdamer/Algebra.js', 'vendor/nerdamer/Calculus.js',
  'vendor/nerdamer/Solve.js', 'rules.js', 'mathtools.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const run = (line) => ctx.MathTools.runCommand(line);
const text = (line) => run(line).text;
const fails = (line, re) => assert.throws(() => run(line), re);

test('log is base 10 and stays log; ln stays ln', () => {
  assert.strictEqual(text('/calc log(100)'), 'log(100) = 2');
  assert.strictEqual(text('/diff log(x)'), 'd/dx (log(x)) = 1/(x·ln(10))');
  assert.strictEqual(text('/diff ln(x)'), 'd/dx (ln(x)) = 1/x');
  assert.strictEqual(run('/plot log(x), ln(x)').caption, 'y = log(x),  y = ln(x)');
});

test('powers of functions: sin²(x), sin^2(x), sin^-1(x)', () => {
  assert.strictEqual(text('/diff sin²(x)'), 'd/dx (sin(x)²) = 2·cos(x)·sin(x)');
  assert.strictEqual(text('/diff sin^2(x)'), 'd/dx (sin(x)²) = 2·cos(x)·sin(x)');
  assert.match(text('/calc sin^-1(0.5)'), /^arcsin\(0\.5\) = .*≈ 0\.5235987756$/);
});

test('numbers next to numbers are a typo; 3×4 is shown as typed', () => {
  assert.strictEqual(text('/calc 3×4'), '3×4 = 12');
  fails('/calc 3 4', /missing an operator between 3 and 4/);
  fails('/calc 1 000', /missing an operator/);
});

test('real powers of negative numbers', () => {
  assert.strictEqual(text('/calc (-8)^(2/3)'), '(−8)^(2/3) = 4');
  assert.match(text('/calc (-1)^0.4'), /= 1$/);
  assert.match(text('/calc (-2)^0.9'), /= undefined$/);
  assert.strictEqual(ctx.MathTools.evaluate(ctx.MathTools.parse('(-8)^(1/3)')), -2);
});

test('nothing freezes the tab', () => {
  const t0 = Date.now();
  assert.match(text('/calc 1000000000!'), /= ∞$/);
  fails('/expand (x+1)^200', /too big/);
  fails('/expand (x+y+z+1)^40', /too big/);
  assert.ok(Date.now() - t0 < 3000);
});

test('degrees', () => {
  assert.match(text('/calc sin(30°)'), /≈ 0\.5$|= 0\.5$/);
  assert.strictEqual(text('/calc sin(90deg)'), 'sin(90°) = 1');
});

test('wrong library answers are refused, not printed', () => {
  fails('/factor x^12-1', /reliably/);
  assert.strictEqual(text('/factor x^2-5x+6'), 'x² − 5x + 6 = (x − 2)·(x − 3)');
  fails('/integrate 1/x^2 from -1 to 1', /not finite at x = 0/);
  fails('/integrate e^(x^2)', /couldn't find a formula/);
  assert.strictEqual(text('/integrate x^2 from 0 to 3'), '∫₀³ x² dx = 9');
});

test('solve: one = sign, at most 6 roots', () => {
  fails('/solve x=2=3', /one = sign/);
  const t = text('/solve sin(x)=0.5');
  assert.strictEqual((t.match(/x = /g) || []).length, 6);
  assert.ok(t.endsWith(' or …'));
});

test('shapes and ranges are checked', () => {
  fails('/draw circle -3', /more than 0/);
  fails('/draw circle 0', /more than 0/);
  const b = run('/plot sin(x) from 5 to 1').figure.bounds;
  assert.ok(b.x0 === 1 && b.x1 === 5);
  fails('/plot sin(x) from 2 to 2', /two different numbers/);
});

test('the invisible zero-width space never blocks a command', () => {
  assert.strictEqual(text('​/calc 2+2'), '2 + 2 = 4');
  assert.ok(ctx.MathTools.asPlot('​y = x^2'));
});
