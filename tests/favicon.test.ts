import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const ROOT = resolve(__dirname, '..');

const FAMILY_LIME = [0xc8, 0xff, 0x36] as const;
const FAMILY_DARK = [0x12, 0x13, 0x10] as const;
const FLATTENED_WHITE = [0xff, 0xff, 0xff] as const;

function load(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function isPng(buf: Buffer): boolean {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24) return false;
  if (!buf.subarray(0, 8).equals(sig)) return false;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return w === 32 || w === 180 ? h === w : false;
}

interface Decoded {
  width: number;
  height: number;
  channels: number;
  pixel(x: number, y: number): number[];
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// A real decode, not a header read: the point of these tests is that the pixels
// on disk carry the family palette, so a claim about a corner has to be measured
// from the raster itself.
function decodePng(buf: Buffer): Decoded {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data.readUInt8(8) !== 8) throw new Error('only 8-bit PNGs are expected');
      colorType = data.readUInt8(9);
      if (data.readUInt8(12) !== 0) throw new Error('interlaced PNGs are not expected');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (channels === 0) throw new Error(`unsupported PNG colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  const at = (buf: Buffer, index: number): number => {
    const value = buf[index];
    if (value === undefined) throw new Error(`byte ${index} is out of range`);
    return value;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = at(raw, y * (stride + 1));
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? at(out, y * stride + i - channels) : 0;
      const up = y > 0 ? at(out, (y - 1) * stride + i) : 0;
      const upLeft = y > 0 && i >= channels ? at(out, (y - 1) * stride + i - channels) : 0;
      let value = at(line, i);
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
      out[y * stride + i] = value & 0xff;
    }
  }
  return {
    width,
    height,
    channels,
    pixel: (x, y) =>
      Array.from(
        { length: channels },
        (_, c) => at(out, y * stride + x * channels + c),
      ),
  };
}

describe('favicon family', () => {
  it('SVG: family frame, family lime accent and the measured-scene mark', () => {
    const svg = load('public/favicon.svg');
    expect(svg).toContain('viewBox="0 0 320 320"');
    // The ground and the disc are the family frame, the same as every sibling.
    expect(svg).toMatch(/<rect[^>]*width="320"[^>]*height="320"[^>]*rx="64"[^>]*fill="#121310"/);
    expect(svg).toMatch(/<circle[^>]*cx="160"[^>]*cy="142"[^>]*r="108"[^>]*fill="#c8ff36"/);
    expect(svg).toMatch(
      /<g[^>]*fill="none"[^>]*stroke="#0c0d0a"[^>]*stroke-width="10"[^>]*stroke-linecap="round"[^>]*stroke-linejoin="round"/,
    );
    // Near and far ridge
    expect(svg).toContain('M36 129L100 53L164 129');
    expect(svg).toContain('M58 129L100 79L142 129');
    // The known answer sits at the summit
    expect(svg).toMatch(
      /<circle[^>]*cx="100"[^>]*cy="53"[^>]*r="16"[^>]*fill="#0c0d0a"[^>]*stroke="none"/,
    );
    expect(svg).toMatch(/<text[^>]*x="160"[^>]*y="296"[^>]*text-anchor="middle"[^>]*fill="#c8ff36"/);
    expect(svg).toContain('>VIS</text>');
    expect(svg).toContain('aria-label="VIS — Vision Knowledge Bank"');
  });

  it('index.html declares svg, 32px png and apple-touch icons', () => {
    const html = load('index.html');
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/);
    expect(html).toMatch(
      /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png" \/>/,
    );
    expect(html).toMatch(
      /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon.png" \/>/,
    );
  });

  it('PNG 32 + apple-touch 180 are valid PNGs with correct dimensions', () => {
    const p32 = readFileSync(resolve(ROOT, 'public/favicon-32.png'));
    const p180 = readFileSync(resolve(ROOT, 'public/apple-touch-icon.png'));
    expect(isPng(p32)).toBe(true);
    expect(isPng(p180)).toBe(true);
    expect(p32.readUInt32BE(16)).toBe(32);
    expect(p32.readUInt32BE(20)).toBe(32);
    expect(p180.readUInt32BE(16)).toBe(180);
    expect(p180.readUInt32BE(20)).toBe(180);
  });

  // The rasters are RGB with the rounded corners flattened onto white, so a
  // light tab bar shows the same corner the rest of the family shows. An alpha
  // channel here would let the tab background through instead.
  it('rasters carry the family pixels: white corners, lime disc, dark ground, no alpha', () => {
    for (const file of ['public/favicon-32.png', 'public/apple-touch-icon.png']) {
      const png = decodePng(readFileSync(resolve(ROOT, file)));
      expect(png.channels, `${file} must be RGB, not RGBA`).toBe(3);
      expect(png.pixel(0, 0), `${file} top-left corner`).toEqual([...FLATTENED_WHITE]);
      const w = png.width;
      const h = png.height;
      // Inside the disc, off the mark: the family lime.
      expect(png.pixel(Math.round(w * 0.25), Math.round(h * 0.25)), `${file} disc`).toEqual([
        ...FAMILY_LIME,
      ]);
      // Left of the disc, inside the rounded ground: the family dark.
      expect(png.pixel(Math.round(w * 0.0625), Math.round(h * 0.5)), `${file} ground`).toEqual([
        ...FAMILY_DARK,
      ]);
    }
  });

  it('rejects the legacy framed icon, a foreign label and the retired accent', () => {
    const validator = (svg: string): boolean => {
      if (!svg.includes('viewBox="0 0 320 320"')) return false;
      if (!/rx="64"[^>]*fill="#121310"/.test(svg)) return false;
      if (!/cx="160"[^>]*cy="142"[^>]*r="108"/.test(svg)) return false;
      if (!/fill="#c8ff36"/.test(svg)) return false;
      if (!/stroke="#0c0d0a"/.test(svg)) return false;
      if (!/>VIS</.test(svg)) return false;
      if (!/aria-label="VIS —/.test(svg)) return false;
      return true;
    };
    // Legacy 64x64 icon: own navy ground, bordered frame, white glyph, no label.
    // It keeps its own retired blue because nothing about it is current.
    expect(
      validator(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-label="VIS — Vision Knowledge Bank"><rect width="64" height="64" rx="14" fill="#0b0f14"/><rect x="6" y="6" width="52" height="52" rx="10" fill="none" stroke="#1f6feb" stroke-width="2"/><path d="M14 46L32 18L50 46" fill="none" stroke="#e6edf3" stroke-width="2.5"/><text x="32" y="58" text-anchor="middle" fill="#1f6feb">VIS</text></svg>',
      ),
    ).toBe(false);
    // Family frame and lime, but a foreign label
    expect(
      validator(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" aria-label="AOS — Agent Operating System"><rect width="320" height="320" rx="64" fill="#121310"/><circle cx="160" cy="142" r="108" fill="#c8ff36"/><g stroke="#0c0d0a"><path d="M1 1"/></g><text x="160" y="296" text-anchor="middle" fill="#c8ff36">VIS</text></svg>',
      ),
    ).toBe(false);
    // Family frame, but the accent reverted to VIS's retired private blue
    expect(
      validator(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" aria-label="VIS — Vision Knowledge Bank"><rect width="320" height="320" rx="64" fill="#121310"/><circle cx="160" cy="142" r="108" fill="#1f6feb"/><g stroke="#0c0d0a"><path d="M1 1"/></g><text x="160" y="296" text-anchor="middle" fill="#1f6feb">VIS</text></svg>',
      ),
    ).toBe(false);
    expect(validator(load('public/favicon.svg'))).toBe(true);
  });
});
