import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

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

describe('favicon family', () => {
  it('SVG: family geometry, private blue accent and the measured-scene mark', () => {
    const svg = load('public/favicon.svg');
    expect(svg).toContain('viewBox="0 0 320 320"');
    // The ground normalises to the family dark; the disc keeps VIS's own blue.
    expect(svg).toMatch(/<rect[^>]*width="320"[^>]*height="320"[^>]*rx="64"[^>]*fill="#121310"/);
    expect(svg).toMatch(/<circle[^>]*cx="160"[^>]*cy="142"[^>]*r="108"[^>]*fill="#1f6feb"/);
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
    expect(svg).toMatch(/<text[^>]*x="160"[^>]*y="296"[^>]*text-anchor="middle"[^>]*fill="#1f6feb"/);
    expect(svg).toContain('>VIS</text>');
    expect(svg).toContain('aria-label="VIS — Vision Laboratory"');
  });

  it('index.html declares svg, 32px png and apple-touch icons', () => {
    const html = load('index.html');
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/);
    expect(html).toMatch(
      /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png" \/>/,
    );
    expect(html).toMatch(
      /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png" \/>/,
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

  it('rejects the legacy framed icon, a foreign label and a swapped accent', () => {
    const validator = (svg: string): boolean => {
      if (!svg.includes('viewBox="0 0 320 320"')) return false;
      if (!/rx="64"[^>]*fill="#121310"/.test(svg)) return false;
      if (!/cx="160"[^>]*cy="142"[^>]*r="108"/.test(svg)) return false;
      if (!/fill="#1f6feb"/.test(svg)) return false;
      if (!/stroke="#0c0d0a"/.test(svg)) return false;
      if (!/>VIS</.test(svg)) return false;
      if (!/aria-label="VIS —/.test(svg)) return false;
      return true;
    };
    // Legacy 64x64 icon: own navy ground, bordered frame, white glyph, no label
    expect(
      validator(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-label="VIS — Vision Laboratory"><rect width="64" height="64" rx="14" fill="#0b0f14"/><rect x="6" y="6" width="52" height="52" rx="10" fill="none" stroke="#1f6feb" stroke-width="2"/><path d="M14 46L32 18L50 46" fill="none" stroke="#e6edf3" stroke-width="2.5"/><text x="32" y="58" text-anchor="middle" fill="#1f6feb">VIS</text></svg>',
      ),
    ).toBe(false);
    // Family geometry but a foreign label
    expect(
      validator(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" aria-label="AOS — Agent Operating System"><rect width="320" height="320" rx="64" fill="#121310"/><circle cx="160" cy="142" r="108" fill="#1f6feb"/><g stroke="#0c0d0a"><path d="M1 1"/></g><text x="160" y="296" text-anchor="middle" fill="#1f6feb">VIS</text></svg>',
      ),
    ).toBe(false);
    // Family geometry but the accent swapped to the family lime
    expect(
      validator(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" aria-label="VIS — Vision Laboratory"><rect width="320" height="320" rx="64" fill="#121310"/><circle cx="160" cy="142" r="108" fill="#c8ff36"/><g stroke="#0c0d0a"><path d="M1 1"/></g><text x="160" y="296" text-anchor="middle" fill="#c8ff36">VIS</text></svg>',
      ),
    ).toBe(false);
    expect(validator(load('public/favicon.svg'))).toBe(true);
  });
});
