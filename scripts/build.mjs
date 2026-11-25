// Builds the extension for each browser from src/:
//   dist/firefox/  dist/chrome/                  unpacked (load these while developing)
//   dist/math-typing-firefox-<version>.zip       upload to addons.mozilla.org (also .xpi for Zen)
//   dist/math-typing-chrome-<version>.zip        upload to the Chrome Web Store
// The version comes from package.json. No dependencies: the zip writer is below.
//
// Usage: node scripts/build.mjs [firefox|chrome ...]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['firefox', 'chrome'];

// Files that are only sources for generated files, not part of the extension.
const SKIP = new Set(['icons/icon.svg']);

const manifestFor = (target) => {
  const m = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
  m.version = pkg.version;
  if (target === 'firefox') {
    // Firefox runs background scripts (with Worker support); it ignores service_worker.
    m.background = { scripts: ['background.js'] };
  } else {
    // Chrome runs a service worker and doesn't know Firefox's settings.
    m.background = { service_worker: 'background.js' };
    delete m.browser_specific_settings;
  }
  return m;
};

const listFiles = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return listFiles(full, base);
  return [path.relative(base, full).split(path.sep).join('/')];
});

// ---------------------------------------------------------------- zip (deflate, no dependencies)
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const writeZip = (file, entries) => {
  const parts = [];
  const central = [];
  let offset = 0;
  // A fixed date keeps builds byte-for-byte reproducible.
  const time = 0;
  const date = ((2024 - 1980) << 9) | (1 << 5) | 1;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, deflated);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(time, 12);
    cen.writeUInt16LE(date, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(deflated.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + deflated.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  fs.writeFileSync(file, Buffer.concat([...parts, cenBuf, end]));
};

// ---------------------------------------------------------------- build
fs.mkdirSync(DIST, { recursive: true });
for (const target of targets) {
  if (!['firefox', 'chrome'].includes(target)) throw new Error(`unknown target ${target}`);
  const out = path.join(DIST, target);
  fs.rmSync(out, { recursive: true, force: true });
  const entries = [];
  for (const rel of listFiles(SRC).sort()) {
    if (SKIP.has(rel)) continue;
    const data = rel === 'manifest.json'
      ? Buffer.from(`${JSON.stringify(manifestFor(target), null, 2)}\n`)
      : fs.readFileSync(path.join(SRC, rel));
    fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    fs.writeFileSync(path.join(out, rel), data);
    entries.push({ name: rel, data });
  }
  const zip = path.join(DIST, `math-typing-${target}-${pkg.version}.zip`);
  writeZip(zip, entries);
  if (target === 'firefox') fs.copyFileSync(zip, zip.replace(/\.zip$/, '.xpi'));
  const kb = Math.round(fs.statSync(zip).size / 1024);
  console.log(`${target}: dist/${target}/ and ${path.relative(ROOT, zip)} (${entries.length} files, ${kb} KB)`);
}
