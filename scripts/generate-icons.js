import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(len + 12);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, len + 8));
  chunk.writeUInt32BE(crc, len + 8);
  return chunk;
}

function createPNG(size) {
  const width = size;
  const height = size;

  // Raw pixel data: each scanline starts with filter byte 0x00
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  const radius = size * 0.45;
  const center = size / 2;

  for (let y = 0; y < height; y++) {
    const offset = y * scanlineLength;
    rawData[offset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded rectangle / squircle background: FlashX deep indigo/violet
      const cornerR = size * 0.22;
      const inBoxX = Math.abs(dx) <= (center - cornerR);
      const inBoxY = Math.abs(dy) <= (center - cornerR);
      const cornerDx = Math.abs(dx) - (center - cornerR);
      const cornerDy = Math.abs(dy) - (center - cornerR);
      const inCorner = cornerDx > 0 && cornerDy > 0 && Math.sqrt(cornerDx * cornerDx + cornerDy * cornerDy) <= cornerR;
      const isInside = inBoxX || inBoxY || inCorner;

      if (isInside) {
        // Gradient from #6366f1 (Indigo) to #a855f7 (Purple) to #3b82f6 (Blue)
        const t = (x + y) / (width + height);
        const r = Math.round(79 * (1 - t) + 99 * t);
        const g = Math.round(70 * (1 - t) + 102 * t);
        const b = Math.round(229 * (1 - t) + 241 * t);

        // Flash symbol (lightning bolt)
        // Normalized coordinates in [-0.5, 0.5]
        const nx = dx / size;
        const ny = dy / size;

        // Lightning bolt polygon check
        let isBolt = false;
        if (
          (nx >= -0.15 && nx <= 0.18 && ny >= -0.32 && ny <= 0.32)
        ) {
          // Dynamic lightning shape
          const topSeg = ny <= 0.02 && nx >= (0.12 * (ny + 0.32) / 0.34 - 0.12) && nx <= (0.12 * (ny + 0.32) / 0.34 + 0.14);
          const botSeg = ny >= -0.05 && nx >= (-0.20 + 0.22 * (ny + 0.05) / 0.37) && nx <= (-0.05 + 0.22 * (ny + 0.05) / 0.37);
          if (topSeg || botSeg) {
            isBolt = true;
          }
        }

        if (isBolt) {
          // Electric Amber/Gold lightning
          rawData[pxOffset] = 254;     // R
          rawData[pxOffset + 1] = 240; // G
          rawData[pxOffset + 2] = 138; // B
          rawData[pxOffset + 3] = 255; // A
        } else {
          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve(__dirname, '../public/icons');
fs.mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const png = createPNG(size);
  const filePath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated ${filePath} (${png.length} bytes)`);
}
