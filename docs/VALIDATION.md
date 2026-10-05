# VIS — Local validation record

Recorded before the first deployment on macOS/arm64, Node.js 22.23.1, Playwright 1.63.0.

## Environment probes

WebGPU was measured before any code was written, because the hybrid runtime rests on it and
`navigator.gpu` existing is not evidence that a kernel can run.

| Context | `navigator.gpu` | `requestAdapter()` | Note |
|---|---|---|---|
| Playwright headless, default flags | present | **null** | silent failure; no error thrown |
| Playwright headless + `--enable-unsafe-webgpu --use-angle=metal` | present | `apple` / `metal-3` | required flags |
| Playwright headed + same flags | present | `apple` / `metal-3` | |
| Real Chrome 154 | present | `apple` / `metal-3` | |

Two traps found by measuring rather than assuming:

- `requestAdapter()` returns `null` **without throwing** while `navigator.gpu` is present. A
  capability check on `!!navigator.gpu` therefore passes on a browser where no kernel can run.
- `about:blank` is not a secure context, and `navigator.gpu` is `undefined` there. The first probe
  run reported "no WebGPU" for that reason alone; all WebGPU assertions therefore run on
  `http://127.0.0.1:<port>` or HTTPS.

A real compute shader (64 work items, `data[i] = f32(i)²`) was dispatched and read back in
headless Chromium: `[0,1,4,9,16,25,36,49]`, mathematically correct. The GPU path is therefore
testable, not merely plausible.

## Engine parity, measured on the same input

`selectEngine` compares every GPU operator against the CPU path on scene seed 42 and reports the
largest absolute difference. Two real bugs were found this way and fixed:

| Operator | Before | After | Cause |
|---|---:|---:|---|
| `gaussian` | 1.58e-1 | 1.19e-7 | CPU second separable pass read a fixed row, so the blur ran along x twice and never touched y. The GPU path ran both axes correctly, so the two engines computed different filters. |
| `sobel` | 5.12e-1 | 1.04e-7 | The GPU path treated a Sobel row as a separable 1D pass. A Sobel row is not one vector. The kernels are now shared from `ops.ts` and both engines convolve the same matrix. |
| `convolve` | 0.00e+0 | 0.00e+0 | |
| `threshold` | 0.00e+0 | 0.00e+0 | |
| `dilate` / `erode` | 0.00e+0 | 0.00e+0 | New rank-filter kernels with `max` and `min` entry points. |

Agreement tolerance is 1e-3 — a measurement tolerance for f32 against f64 accumulation, not a
rounding allowance.

## Scene generator corrections

- Objects were placed almost entirely on top of each other, which makes the answer key ambiguous:
  one silhouette hides another, and a detector cannot be scored against a key that disagrees with
  itself. Placement now uses circular rejection sampling with a margin, and a test asserts that no
  pixel is claimed by two silhouettes across five seeds.
- The horizon was a hard contrast step and became the strongest gradient in the frame, so a
  fraction-of-maximum Canny threshold landed above every object boundary: 23 detected pixels and a
  0.0 border hit rate. The horizon is now blended across three rows and the Canny threshold scales
  off a high percentile of the gradient distribution. Edge hit rate at 1px tolerance: **0.82**.

## Canny hysteresis correction

Hysteresis started from `like(strong)`, which allocates zeros rather than cloning, so the strong
edges were discarded and the output was identically zero. Fixed with an explicit `clone`, and the
regression is guarded by a test asserting a non-empty edge map.

## Knowledge bank sources, checked rather than recalled

Every source in `src/content/library.ts` was resolved before it was written, because a
reference that cannot be opened is indistinguishable from a fabricated one. Two candidates
were **rejected during this work** and replaced:

| Rejected | Why | Replaced by |
|---|---|---|
| A Sobel & Feldman and a Horn & Schunck DOI | Both returned 404 at doi.org; the titles were written from memory | Ojala 2002 and the correct `10.1016/0004-3702(81)90024-2` |
| A Hough 1962 record pointing at a CERN ID | The CERN record is behind a bot check, and the DOI that resolved (`10.1364/AO.28.003479`) is a 1989 paper by different authors | Zhang 2000 camera calibration |

`10.1007/BF00130422` was initially taken for Horn & Schunck; Crossref shows it is a muscle
physiology paper. The lesson matches the rest of this file: the identity of a source has to be
measured, not remembered.

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

## Test inventory

| Suite | Count | What it covers |
|---|---:|---|
| `npm test` (vitest) | 66 | determinism, no-overlap key, horizon contrast, Sobel kernels, 2D blur, Canny thresholds, component labelling, Hough peak, IoU and matching, flow recovery, CNN reproducibility and loss decrease, engine prose derived without re-measuring, every experiment runs, answer key is exactly 1.0, plus 18 knowledge-bank invariants: layer order and boundaries, source binding and reachability, TR/EN parity, concept-to-experiment cross-links, and the ban on numeric claims in reference prose |
| `npm run test:ui` browser | 16 | all eight experiments render, answer key measures 1.0000, every experiment reports, learned path reports both sides and a difference, seed change re-measures, synthetic scope in both languages, language parity, CPU path selectable and measured, depth correlations reported, motion shift recovered, parent links, no console errors, plus the knowledge bank: seven sourced layers each stating its boundary, a primary source opening in a new tab, the explicit statement that its own numbers are not measurements, a concept cross-link that returns to the measuring experiment, and language switching inside the bank |
| `npm run test:ui` webgpu | 5 | adapter reachable or loud failure, real compute shader, engine selection reported, CPU/GPU parity under 1e-3, delegated operators named |
| `scripts/verify-dist.mjs` | — | 7 required files, release manifest fields, canonical address, hashed bundles, security headers, no-store on the manifest, published schema, and a scan proving the artifact contains no external calls |

## Result

```
npm run lint      clean
npm run build     dist verified, 300 kB js / 10 kB css
npm test          66 passed
npm run test:ui   21 passed (16 browser + 5 webgpu)
```
