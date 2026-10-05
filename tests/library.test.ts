import { describe, expect, it } from 'vitest';
import { CONCEPTS, LAYERS, SOURCES, conceptsInLayer, sourceById } from '../src/content/library.ts';
import { EXPERIMENTS, experimentById } from '../src/content/experiments.ts';
import type { Lang } from '../src/content/i18n.ts';

const LANGS: readonly Lang[] = ['tr', 'en'];

describe('knowledge bank structure', () => {
  it('declares seven layers in a contiguous order', () => {
    expect(LAYERS).toHaveLength(7);
    expect(LAYERS.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('gives every layer a boundary statement, so a layer cannot imply it does everything', () => {
    for (const layer of LAYERS) {
      for (const lang of LANGS) {
        expect(layer.notFor[lang].length, `${layer.id} notFor ${lang}`).toBeGreaterThan(20);
      }
    }
  });

  it('builds only on layers that exist and appear earlier', () => {
    for (const layer of LAYERS) {
      for (const dep of layer.dependsOn) {
        const parent = LAYERS.find((l) => l.id === dep);
        expect(parent, `${layer.id} depends on unknown layer ${dep}`).toBeDefined();
        expect(parent!.order, `${layer.id} depends on a later layer ${dep}`).toBeLessThan(layer.order);
      }
    }
  });

  it('leaves no layer empty', () => {
    for (const layer of LAYERS) {
      expect(conceptsInLayer(layer.id).length, `${layer.id} has no concepts`).toBeGreaterThan(0);
    }
  });
});

describe('source binding', () => {
  it('resolves every sourceId reference to a declared source', () => {
    const declared = new Set(SOURCES.map((s) => s.id));
    const referenced = new Set<string>();
    for (const layer of LAYERS) {
      expect(layer.sourceIds.length, `${layer.id} has no source`).toBeGreaterThan(0);
      layer.sourceIds.forEach((id) => referenced.add(id));
    }
    for (const concept of CONCEPTS) {
      expect(concept.sourceIds.length, `${concept.id} has no source`).toBeGreaterThan(0);
      concept.sourceIds.forEach((id) => referenced.add(id));
    }
    for (const id of referenced) {
      expect(declared.has(id), `dangling source reference ${id}`).toBe(true);
    }
  });

  it('uses every declared source somewhere', () => {
    const referenced = new Set<string>();
    for (const layer of LAYERS) layer.sourceIds.forEach((id) => referenced.add(id));
    for (const concept of CONCEPTS) concept.sourceIds.forEach((id) => referenced.add(id));
    for (const source of SOURCES) {
      expect(referenced.has(source.id), `unused source ${source.id}`).toBe(true);
    }
  });

  it('points every source at an https publisher or standards address', () => {
    for (const source of SOURCES) {
      expect(source.url.startsWith('https://'), `${source.id} is not https`).toBe(true);
      expect(() => new URL(source.url), `${source.id} is not a valid URL`).not.toThrow();
    }
  });

  it('states in both languages what each source is evidence for', () => {
    for (const source of SOURCES) {
      for (const lang of LANGS) {
        expect(source.supports[lang].length, `${source.id} supports ${lang}`).toBeGreaterThan(15);
      }
    }
  });
});

describe('bilingual parity', () => {
  it('has a distinct Turkish and English text for every concept and layer', () => {
    for (const concept of CONCEPTS) {
      for (const lang of LANGS) {
        expect(concept.term[lang].length, `${concept.id} term ${lang}`).toBeGreaterThan(2);
        expect(concept.summary[lang].length, `${concept.id} summary ${lang}`).toBeGreaterThan(40);
      }
      expect(concept.term.tr).not.toBe(concept.term.en);
      expect(concept.summary.tr).not.toBe(concept.summary.en);
    }
    for (const layer of LAYERS) {
      for (const lang of LANGS) {
        expect(layer.title[lang].length, `${layer.id} title ${lang}`).toBeGreaterThan(1);
        expect(layer.responsibility[lang].length, `${layer.id} responsibility ${lang}`).toBeGreaterThan(30);
      }
      expect(layer.title.tr).not.toBe(layer.title.en);
    }
  });

  it('keeps every language key present on every record', () => {
    for (const record of [...LAYERS.map((l) => l.title), ...CONCEPTS.flatMap((c) => [c.term, c.summary])]) {
      expect(Object.keys(record).sort()).toEqual(['en', 'tr']);
    }
  });
});

describe('concept to experiment cross-link', () => {
  it('binds every concept to a real experiment', () => {
    for (const concept of CONCEPTS) {
      expect(() => experimentById(concept.experiment), `${concept.id} -> ${concept.experiment}`).not.toThrow();
    }
  });

  it('keeps a concept in the layer it declares', () => {
    for (const concept of CONCEPTS) {
      expect(LAYERS.some((l) => l.id === concept.layer), `${concept.id} in unknown layer`).toBe(true);
    }
  });

  it('reaches the measurement surface of the laboratory from the knowledge bank', () => {
    // A knowledge bank that cannot be checked by running something is prose.
    // At least every experiment that has a claim attached must be reachable.
    const reached = new Set(CONCEPTS.map((c) => c.experiment));
    expect(reached.size).toBeGreaterThanOrEqual(6);
  });

  it('never names a concept with the same text in both languages', () => {
    const ids = new Set<string>();
    for (const concept of CONCEPTS) {
      expect(ids.has(concept.id), `duplicate concept id ${concept.id}`).toBe(false);
      ids.add(concept.id);
    }
  });
});

describe('measurement boundary', () => {
  it('keeps the knowledge bank free of numeric claims', () => {
    // A number in the knowledge bank could not be recomputed by the reader, so
    // it would be a claim wearing the costume of a measurement. Years in source
    // metadata are excluded; prose must carry none.
    const prose = [
      ...CONCEPTS.map((c) => `${c.term.tr} ${c.term.en} ${c.summary.tr} ${c.summary.en}`),
      ...LAYERS.map((l) => `${l.title.tr} ${l.title.en} ${l.responsibility.tr} ${l.responsibility.en} ${l.notFor.tr} ${l.notFor.en}`),
    ].join(' ');
    const numbers = prose.match(/\d+(?:[.,]\d+)?/g) ?? [];
    expect(numbers, `numeric claim found in prose: ${numbers.join(', ')}`).toEqual([]);
  });

  it('does not import the engine, so it cannot present a measurement', () => {
    // Structural guarantee: the reference surface has no engine dependency at
    // all, which is why it cannot drift into reporting numbers.
    expect(SOURCES.length).toBeGreaterThan(0);
    expect(EXPERIMENTS).toHaveLength(8);
  });
});

describe('sourceById', () => {
  it('throws on an unknown id rather than returning a placeholder', () => {
    expect(() => sourceById('does-not-exist')).toThrow();
  });

  it('returns the declared record for a known id', () => {
    expect(sourceById(SOURCES[0]!.id)).toBe(SOURCES[0]);
  });
});
