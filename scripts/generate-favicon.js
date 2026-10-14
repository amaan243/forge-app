const fs = require('fs');
const path = require('path');

function createIconBuffer(size) {
  // RGBA buffer (size x size)
  const pixels = new Uint8ClampedArray(size * size * 4);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    // Alpha blending with background
    const prevA = pixels[idx + 3] / 255;
    const curA = a / 255;
    const outA = curA + prevA * (1 - curA);
    if (outA > 0) {
      pixels[idx] = Math.round((r * curA + pixels[idx] * prevA * (1 - curA)) / outA);
      pixels[idx + 1] = Math.round((g * curA + pixels[idx + 1] * prevA * (1 - curA)) / outA);
      pixels[idx + 2] = Math.round((b * curA + pixels[idx + 2] * prevA * (1 - curA)) / outA);
      pixels[idx + 3] = Math.round(outA * 255);
    }
  }

  function drawDisk(cx, cy, radius, r, g, b, a = 255) {
    const minX = Math.floor(cx - radius - 1);
    const maxX = Math.ceil(cx + radius + 1);
    const minY = Math.floor(cy - radius - 1);
    const maxY = Math.ceil(cy + radius + 1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= radius) {
          setPixel(x, y, r, g, b, a);
        } else if (dist < radius + 1) {
          const alpha = (1 - (dist - radius)) * a;
          setPixel(x, y, r, g, b, alpha);
        }
      }
    }
  }

  function drawLine(x0, y0, x1, y1, width, r, g, b) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const steps = Math.ceil(len * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      drawDisk(px, py, width / 2, r, g, b);
    }
  }

  // 1. Dark Rounded Base Plate (#070B14)
  const cornerRadius = size >= 32 ? (size >= 48 ? 8 : 5) : 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      // Check rounded corners
      const corners = [
        { cx: cornerRadius, cy: cornerRadius },
        { cx: size - 1 - cornerRadius, cy: cornerRadius },
        { cx: cornerRadius, cy: size - 1 - cornerRadius },
        { cx: size - 1 - cornerRadius, cy: size - 1 - cornerRadius },
      ];
      for (const c of corners) {
        if ((x < c.cx && y < c.cy) || (x > c.cx && y < c.cy) || (x < c.cx && y > c.cy) || (x > c.cx && y > c.cy)) {
          if (Math.hypot(x - c.cx, y - c.cy) > cornerRadius) {
            inside = false;
          }
        }
      }
      if (inside) {
        setPixel(x, y, 7, 11, 20, 255);
      }
    }
  }

  // Coordinates scale factors
  const s = size / 32;

  // 2. Structural Arch Pylons (Letter "A")
  // Left leg: (16, 5) to (8, 26)
  drawLine(16 * s, 6 * s, 8.5 * s, 26 * s, 2.5 * s, 0, 240, 255); // #00F0FF (Cyan)
  // Right leg: (16, 5) to (24, 26)
  drawLine(16 * s, 6 * s, 23.5 * s, 26 * s, 2.5 * s, 2, 132, 199); // #0284C7 (Ocean Blue)

  // 3. Horizontal Truss Crossbar at y=19
  drawLine(10.5 * s, 19.5 * s, 21.5 * s, 19.5 * s, 2.0 * s, 56, 189, 248); // #38BDF8 (Sky Blue)

  // 4. Engineering Topology Nodes
  // Apex Node (Requirements)
  drawDisk(16 * s, 6.5 * s, 2.8 * s, 0, 240, 255); // #00F0FF
  drawDisk(16 * s, 6.5 * s, 1.2 * s, 255, 255, 255);

  // Left Base Node (Repository AST)
  drawDisk(8.5 * s, 25.5 * s, 2.5 * s, 56, 189, 248); // #38BDF8
  drawDisk(8.5 * s, 25.5 * s, 1.0 * s, 255, 255, 255);

  // Right Base Node (Quality Gates)
  drawDisk(23.5 * s, 25.5 * s, 2.5 * s, 16, 185, 129); // #10B981 (Emerald)
  drawDisk(23.5 * s, 25.5 * s, 1.0 * s, 255, 255, 255);

  // Center Synthesis Reactor (The Forge Nucleus)
  drawDisk(16 * s, 15 * s, 2.0 * s, 255, 255, 255);
  drawDisk(16 * s, 15 * s, 3.2 * s, 0, 240, 255, 120);

  return pixels;
}

function buildIcoBuffer(frames) {
  // frames = array of { size, pixels: Uint8ClampedArray }
  const count = frames.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const headerAndDirsSize = headerSize + count * dirEntrySize;

  let currentOffset = headerAndDirsSize;
  const images = [];

  for (const frame of frames) {
    const W = frame.size;
    const H = frame.size;
    const dibHeaderSize = 40;
    const pixelBytesCount = W * H * 4;
    // AND mask: 1 bit per pixel, row rounded up to 32 bits (4 bytes)
    const rowMaskBytes = Math.ceil(W / 32) * 4;
    const andMaskSize = rowMaskBytes * H;
    const imageSize = dibHeaderSize + pixelBytesCount + andMaskSize;

    const imgBuf = Buffer.alloc(imageSize);

    // BITMAPINFOHEADER (40 bytes)
    imgBuf.writeUInt32LE(40, 0); // biSize
    imgBuf.writeInt32LE(W, 4); // biWidth
    imgBuf.writeInt32LE(H * 2, 8); // biHeight (doubled for ICO)
    imgBuf.writeUInt16LE(1, 12); // biPlanes
    imgBuf.writeUInt16LE(32, 14); // biBitCount
    imgBuf.writeUInt32LE(0, 16); // biCompression = BI_RGB
    imgBuf.writeUInt32LE(pixelBytesCount + andMaskSize, 20); // biSizeImage
    imgBuf.writeInt32LE(0, 24); // biXPelsPerMeter
    imgBuf.writeInt32LE(0, 28); // biYPelsPerMeter
    imgBuf.writeUInt32LE(0, 32); // biClrUsed
    imgBuf.writeUInt32LE(0, 36); // biClrImportant

    // Write pixels (Bottom to Top in BMP format)
    let pOffset = dibHeaderSize;
    for (let y = H - 1; y >= 0; y--) {
      for (let x = 0; x < W; x++) {
        const srcIdx = (y * W + x) * 4;
        const r = frame.pixels[srcIdx];
        const g = frame.pixels[srcIdx + 1];
        const b = frame.pixels[srcIdx + 2];
        const a = frame.pixels[srcIdx + 3];

        // BMP 32-bit format: BGRA
        imgBuf[pOffset++] = b;
        imgBuf[pOffset++] = g;
        imgBuf[pOffset++] = r;
        imgBuf[pOffset++] = a;
      }
    }

    // Write AND mask (1 bit per pixel, 0 = visible, 1 = transparent)
    let maskOffset = dibHeaderSize + pixelBytesCount;
    for (let y = H - 1; y >= 0; y--) {
      let rowByte = 0;
      let bitIdx = 0;
      let byteCount = 0;
      for (let x = 0; x < W; x++) {
        const srcIdx = (y * W + x) * 4;
        const a = frame.pixels[srcIdx + 3];
        if (a === 0) {
          rowByte |= 1 << (7 - bitIdx);
        }
        bitIdx++;
        if (bitIdx === 8) {
          imgBuf[maskOffset + byteCount] = rowByte;
          byteCount++;
          bitIdx = 0;
          rowByte = 0;
        }
      }
      if (bitIdx > 0) {
        imgBuf[maskOffset + byteCount] = rowByte;
        byteCount++;
      }
      while (byteCount < rowMaskBytes) {
        imgBuf[maskOffset + byteCount] = 0;
        byteCount++;
      }
      maskOffset += rowMaskBytes;
    }

    images.push({
      width: W >= 256 ? 0 : W,
      height: H >= 256 ? 0 : H,
      size: imageSize,
      offset: currentOffset,
      data: imgBuf,
    });

    currentOffset += imageSize;
  }

  // Create total ICO file buffer
  const icoBuf = Buffer.alloc(currentOffset);

  // ICO Header
  icoBuf.writeUInt16LE(0, 0); // reserved
  icoBuf.writeUInt16LE(1, 2); // type 1 = icon
  icoBuf.writeUInt16LE(count, 4); // count

  // Directory entries
  for (let i = 0; i < count; i++) {
    const entryOffset = headerSize + i * dirEntrySize;
    const img = images[i];

    icoBuf.writeUInt8(img.width, entryOffset); // width
    icoBuf.writeUInt8(img.height, entryOffset + 1); // height
    icoBuf.writeUInt8(0, entryOffset + 2); // color count
    icoBuf.writeUInt8(0, entryOffset + 3); // reserved
    icoBuf.writeUInt16LE(1, entryOffset + 4); // color planes
    icoBuf.writeUInt16LE(32, entryOffset + 6); // bits per pixel
    icoBuf.writeUInt32LE(img.size, entryOffset + 8); // image size
    icoBuf.writeUInt32LE(img.offset, entryOffset + 12); // image offset
  }

  // Write image buffers
  for (const img of images) {
    img.data.copy(icoBuf, img.offset);
  }

  return icoBuf;
}

const frames = [
  { size: 16, pixels: createIconBuffer(16) },
  { size: 32, pixels: createIconBuffer(32) },
  { size: 48, pixels: createIconBuffer(48) },
];

const icoBuffer = buildIcoBuffer(frames);
const outPath = path.resolve('client', 'public', 'favicon.ico');
fs.writeFileSync(outPath, icoBuffer);
console.log('Genuine multi-resolution ICO file generated at:', outPath, 'Bytes:', icoBuffer.length);
