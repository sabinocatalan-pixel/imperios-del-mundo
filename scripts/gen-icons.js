"use strict";
/* scripts/gen-icons.js — genera src/icons/icon-192.png e icon-512.png
   (corona dorada sobre fondo #0B1D26) sin dependencias npm: solo
   Node core (zlib para el deflate que exige el formato PNG, fs para
   escribir el archivo). Volver a ejecutar con:
     node scripts/gen-icons.js
   regenera los íconos si se cambia el diseño de este script. */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BG = [0x0b, 0x1d, 0x26, 0xff]; // #0B1D26
const GOLD = [0xd9, 0xa4, 0x41, 0xff]; // #D9A441

function crc32(buf) {
  if (!crc32.table) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // profundidad de bits
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const ihdr = chunk("IHDR", ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro "none" por fila
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = chunk("IDAT", zlib.deflateSync(raw, { level: 9 }));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Corona simple: banda dorada + 3 puntas triangulares (la central más alta).
function drawCrown(size) {
  const px = new Uint8Array(size * size * 4);
  const setPx = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) setPx(x, y, BG);

  const bandTop = size * 0.60, bandBottom = size * 0.72;
  const bandLeft = size * 0.18, bandRight = size * 0.82;
  for (let y = Math.round(bandTop); y < Math.round(bandBottom); y++)
    for (let x = Math.round(bandLeft); x < Math.round(bandRight); x++) setPx(x, y, GOLD);

  const segW = (bandRight - bandLeft) / 3;
  const gap = size * 0.015;
  const points = [
    { i: 0, apexY: size * 0.42 },
    { i: 1, apexY: size * 0.28 }, // punta central, más alta
    { i: 2, apexY: size * 0.42 }
  ];
  for (const p of points) {
    const baseLeft = bandLeft + p.i * segW + gap;
    const baseRight = bandLeft + (p.i + 1) * segW - gap;
    const apexX = (baseLeft + baseRight) / 2;
    for (let y = Math.round(p.apexY); y < Math.round(bandTop); y++) {
      const t = (y - p.apexY) / (bandTop - p.apexY);
      const left = apexX + t * (baseLeft - apexX);
      const right = apexX + t * (baseRight - apexX);
      for (let x = Math.round(left); x < Math.round(right); x++) setPx(x, y, GOLD);
    }
  }
  return Buffer.from(px);
}

const outDir = path.join(__dirname, "..", "src", "icons");
fs.mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePNG(size, size, drawCrown(size));
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`Generado src/icons/icon-${size}.png (${png.length} bytes)`);
}
