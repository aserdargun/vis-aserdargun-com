/**
 * The boundary between the two applications, written down once.
 *
 * VIS explains and cites. CVL measures. Neither application does the other's
 * job, and this file is the reason that can be checked instead of believed:
 *
 * - VIS has no measurement engine. It cannot produce a number, so it never
 *   claims one. The only numbers it reports are the reader's own review counts.
 * - CVL has no knowledge bank. It cannot cite a source, so it never explains an
 *   operator. Every layer it measures links back here for the explanation.
 *
 * When a concept needs checking, this module is what turns "measure it" into a
 * real destination: a named layer in the laboratory, not a button that stays on
 * this page. The identifiers below are the eight layers CVL measures, in the
 * order its laboratory runs them.
 */

/** The laboratory that measures. VIS never measures; it points here. */
export const LABORATORY_URL = 'https://cvl.aserdargun.com/';

/** The eight measured layers, named exactly as the laboratory names them. */
export type LaboratoryLayer = 'signal' | 'filtering' | 'edges' | 'regions' | 'geometry' | 'learning' | 'depth' | 'motion';

export const LABORATORY_LAYERS: readonly LaboratoryLayer[] = [
  'signal',
  'filtering',
  'edges',
  'regions',
  'geometry',
  'learning',
  'depth',
  'motion',
];

/**
 * A deep link to the layer that measures this idea.
 *
 * The layer is named in the fragment so the reader lands on the experiment
 * behind the concept rather than on the laboratory's front page.
 */
export function measureLink(layer: LaboratoryLayer): string {
  return `${LABORATORY_URL}#katman-${layer}`;
}

export function isLaboratoryLayer(value: string): value is LaboratoryLayer {
  return (LABORATORY_LAYERS as readonly string[]).includes(value);
}