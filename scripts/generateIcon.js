/**
 * scripts/generateIcon.js
 *
 * Generates public/snow-icon.png — a 192×192 dark-blue PNG.
 * Uses only Node.js built-ins (no external dependencies).
 *
 * Run once: node scripts/generateIcon.js
 *
 * Output: public/snow-icon.png (required by browser Notification API,
 * SPEC.md section 6 / Agent 6 Deliverable 4).
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'public', 'snow-icon.png');

// ── PNG helpers ───────────────────────────────────────────────────────────────

/** Write a big-endian uint32 into a 4-byte Buffer. */
function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

/** CRC-32 (ISO 3309) used by PNG chunks. */
function crc32(buf) {
  // Build table on first call (simple inline version)
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Wrap raw bytes in a PNG chunk (length + type + data + CRC). */
function makeChunk(typeStr, data) {
  const type = Buffer.from(typeStr, 'ascii');
  const crcInput = Buffer.concat([type, data]);
  return Buffer.concat([uint32BE(data.length), type, data, uint32BE(crc32(crcInput))]);
}

// ── Build the PNG ─────────────────────────────────────────────────────────────

const WIDTH = 192;
const HEIGHT = 192;

// Dark blue background: #0F172A = R15, G23, B42
const R = 15, G = 23, B = 42;

// IHDR chunk
const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(WIDTH, 0);
ihdrData.writeUInt32BE(HEIGHT, 4);
ihdrData[8] = 8;   // bit depth
ihdrData[9] = 2;   // color type: RGB (truecolor)
ihdrData[10] = 0;  // compression: deflate
ihdrData[11] = 0;  // filter: adaptive
ihdrData[12] = 0;  // interlace: none

// Raw scanlines: each row is [filter_byte, R, G, B, R, G, B, ...]
const scanlineLen = 1 + WIDTH * 3;
const rawData = Buffer.alloc(HEIGHT * scanlineLen, 0);
for (let y = 0; y < HEIGHT; y++) {
  const rowOffset = y * scanlineLen;
  rawData[rowOffset] = 0; // filter type None
  for (let x = 0; x < WIDTH; x++) {
    const px = rowOffset + 1 + x * 3;
    rawData[px]     = R;
    rawData[px + 1] = G;
    rawData[px + 2] = B;
  }
}

// Compress with zlib deflate (PNG IDAT must be zlib-wrapped)
const compressed = zlib.deflateSync(rawData, { level: 9 });

// Assemble PNG
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
  makeChunk('IHDR', ihdrData),
  makeChunk('IDAT', compressed),
  makeChunk('IEND', Buffer.alloc(0)),
]);

// Ensure public/ directory exists
const publicDir = path.dirname(OUT_PATH);
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(OUT_PATH, png);
console.log(`✅  Created ${OUT_PATH} (${WIDTH}×${HEIGHT} dark-blue PNG, ${png.length} bytes)`);
