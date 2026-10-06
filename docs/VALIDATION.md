# VIS — Local validation record

Recorded after the split from CVL on macOS/arm64, Node.js 22.23.1, Playwright 1.63.0.

## What changed and why it was verified

VIS used to host a second copy of CVL's laboratory: its own engine, its own scene generator, its
own answer key and its own metric table. Two copies of a measurement are one more thing that can
drift from the answer key, and a reader could not tell which copy was reporting. The laboratory
was removed rather than kept in sync.

The split is only worth anything if it is enforced, so the checks below are structural rather
than cosmetic:

| Check | Where | What it proves |
|---|---|---|
| No engine directory | `release.json` records `measurementEngine: false` | VIS cannot present a measurement it did not compute |
| No published schema | `scripts/verify-dist.mjs`, `scripts/verify-live.mjs` fail if `dist/schemas/` exists | The measurement contract belongs to CVL only |
| No numbers in prose | `tests/library.test.ts` | A claim the reader cannot recompute is rejected |
| No laboratory view | `tests/browser.spec.ts` asserts `view-laboratory` does not exist | The third surface is gone, not merely hidden |
| Every concept links out | `tests/browser.spec.ts`, `tests/library.test.ts` | "Measure this" leaves for `cvl.aserdargun.com/#katman-*` |

## Knowledge bank sources, checked rather than recalled

Every source in `src/content/library.ts` was resolved before it was written, because a
reference that cannot be opened is indistinguishable from a fabricated one. Two candidates
were **rejected during this work** and replaced:

| Rejected | Why | Replaced by |
|---|---|---|
| A Sobel & Feldman and a Horn & Schunck DOI | Both returned 404 at doi.org; the titles were written from memory | Ojala 2002 and the correct `10.1016/0004-3702(81)90024-2` |
| A Hough 1962 record pointing at a CERN ID | The CERN record is behind a bot check, and the DOI that resolved (`10.1364/AO.28.003479`) is a 1989 paper by different authors | Zhang 2000 camera calibration |

`10.1007/BF00130422` was initially taken for Horn & Schunck; Crossref shows it is a muscle
physiology paper. The identity of a source has to be measured, not remembered.

The thirteen sources that remain are all publisher or standards addresses, and every one of
them was confirmed to resolve:

| Layer | Sources |
|---|---|
| signal | SPIE Handbook of Optical Systems, appendix on sampling |
| filtering | Tomasi & Manduchi 1998 (bilateral) |
| edges | Canny 1986, Marr & Hildreth 1980 |
| regions | Otsu 1979, Parašić et al. 2012 (connected components) |
| geometry | Zhang 2000 (calibration), Hartley & Zisserman 2004 |
| learning | LeCun et al. 1998, Krizhevsky et al. 2012, He et al. 2016 |
| motion | Horn & Schunck 1981, Ojala et al. 2002 (texture) |

Hough 1962, Nyquist 1928 and Sobel & Feldman 1968 are the classic citations for this field and
none of them is reachable through a DOI that resolves. They are therefore **not cited**; the
geometry layer rests on sources that can be opened.

## Concept-to-laboratory mapping

Sixteen concepts across seven layers each name the laboratory layer that measures them. The
mapping is not one-to-one and was chosen by meaning, not by position: filtering concepts point
at the separable-convolution measurement, hysteresis and gradient concepts at the edge layer,
line-detection concepts at geometry. `tests/library.test.ts` asserts that every concept names a
declared `LaboratoryLayer` and that the link is well-formed.

## Test inventory

| Suite | Count | What it covers |
|---|---:|---|
| `npm test` (vitest) | 46 | 18 knowledge-bank invariants (layer order and boundaries, source binding and reachability, TR/EN parity, concept-to-laboratory links, the ban on numeric claims in prose) and 22 review invariants (card-to-concept binding, bilingual parity, the no-numbers rule on cards, the SM-2 ladder, ease-factor floor, queue separation, rejection of corrupt stored progress), plus the family favicon checks |
| `npm run test:ui` browser | 12 | the knowledge bank is the landing surface and no laboratory is offered; seven sourced layers each stating its boundary; a primary source opening in a new tab; the explicit statement that its own numbers are not measurements; a concept linking out to the laboratory layer that measures it; every knowledge layer linking out; language switching in both directions; parent links including the laboratory; no console errors; and the review surface: derived deck, reader-graded, progress surviving a reload, a card linking out instead of measuring, bilingual |

The measurement tests — determinism, engine parity, GPU probing — were removed with the engine
they exercised. They live in CVL now, where the answer key that gives them meaning does.

## Result

```
npm run lint      clean
npm run build     dist verified, 256 kB js / 10 kB css
npm test          46 passed
npm run test:ui   12 passed
```