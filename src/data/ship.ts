import type {
  HoldGeometry,
  HydroRow,
  SfBmTable,
  ShipParticulars,
} from '../types';

/* ----------------------------------------------------------------------
 * M/V Mohican — vessel constants
 * Data digested from the documents supplied by the master:
 *   - 135B.100.001.Aa-General+Arrangement.pdf
 *   - 135.152.107.B-Bulk+Cargo+Loading+Manual-BV.pdf
 *   - 135.152.001.Da-Tank+Capacity+Plan.pdf
 *   - 135.152.101.Fa-Intact+Stability+Booklet-BV.pdf
 *
 * Hold dimensions are taken from the master's own measurements:
 *   Holds 1 & 4 :  26.0 × 13.4 × 9.5 m
 *   Holds 2 & 3 :  27.3 × 13.4 × 9.5 m
 *
 * Notch (corner cut-out) at the upper end of each hold:
 *   1.30 m longitudinally × 1.75 m vertically × full breadth.
 *
 * "End" refers to the side as seen on the side view (left = aft):
 *   Hold 1 — aft notch only
 *   Hold 2 — both ends
 *   Hold 3 — both ends
 *   Hold 4 — fore notch only
 * -------------------------------------------------------------------- */

export const SHIP: ShipParticulars = {
  name: 'M/V Mohican',
  loa: 140.9,
  lbp: 138.36,
  beam: 17.0,
  depth: 6.8,
  // From the booklet, displacement at summer draft is 12153 t and the
  // homogeneous capacity of all four holds is 11305.9 t, which puts the
  // lightship at roughly 12153 - 11305.9 - 4500 (fuel/water/ballast
  // working margin) ≈ 3700 t.  For first-cut trim/SF calculations we
  // use a deliberately rough lightship estimate which the user can
  // override later from the UI.  lightshipLcg is set close to the
  // lightship LCB so that the empty ship reports near-zero trim and
  // SF/BM as a baseline; the operator can refine this once the
  // official lightship report is available.
  lightship: 3700,
  lightshipLcg: 71.0,
  lightshipVcg: 6.5,
  summerDraft: 5.35,
  summerDisplacement: 12153,
  tankTopLoad: 8.664,
  maxHoldWeight: 2900,
  defaultSeawaterDensity: 1.025,
};

const NOTCH_HEIGHT = 1.75;
const NOTCH_LENGTH = 1.3;

// Longitudinal positions of the four holds, derived from the FR ranges in
// the Bulk Cargo Loading Manual (capacity table).  We back-compute the
// aft x-coordinate from each hold's published LCG and the geometric
// length supplied by the user, so that the visual layout aligns with the
// stability data as far as possible.
//   Hold 1 : LCG 114.09 m, L 26.0 → xAft = 114.09 - 13.0 = 101.09
//   Hold 2 : LCG  86.84 m, L 27.3 → xAft =  86.84 - 13.65 = 73.19
//   Hold 3 : LCG  58.89 m, L 27.3 → xAft =  58.89 - 13.65 = 45.24
//   Hold 4 : LCG  31.65 m, L 26.0 → xAft =  31.65 - 13.0 = 18.65
//
// Tank top z (above keel) is taken at 1.20 m as per the GA "1200 DB Tanktop"
// note.

export const HOLDS: readonly HoldGeometry[] = [
  {
    id: 1,
    name: 'Hold 1 (forward)',
    length: 26.0,
    breadth: 13.4,
    height: 9.5,
    xAft: 101.09,
    zTankTop: 1.2,
    maxWeight: 2900,
    notches: [{ end: 'aft', length: NOTCH_LENGTH, height: NOTCH_HEIGHT }],
  },
  {
    id: 2,
    name: 'Hold 2',
    length: 27.3,
    breadth: 13.4,
    height: 9.5,
    xAft: 73.19,
    zTankTop: 1.2,
    maxWeight: 2900,
    notches: [
      { end: 'aft', length: NOTCH_LENGTH, height: NOTCH_HEIGHT },
      { end: 'fore', length: NOTCH_LENGTH, height: NOTCH_HEIGHT },
    ],
  },
  {
    id: 3,
    name: 'Hold 3',
    length: 27.3,
    breadth: 13.4,
    height: 9.5,
    xAft: 45.24,
    zTankTop: 1.2,
    maxWeight: 2900,
    notches: [
      { end: 'aft', length: NOTCH_LENGTH, height: NOTCH_HEIGHT },
      { end: 'fore', length: NOTCH_LENGTH, height: NOTCH_HEIGHT },
    ],
  },
  {
    id: 4,
    name: 'Hold 4 (aft)',
    length: 26.0,
    breadth: 13.4,
    height: 9.5,
    xAft: 18.65,
    zTankTop: 1.2,
    maxWeight: 2900,
    notches: [{ end: 'fore', length: NOTCH_LENGTH, height: NOTCH_HEIGHT }],
  },
] as const;

/* ----------------------------------------------------------------------
 * Still-water shear force / bending moment limits
 * Source: Bulk Cargo Loading Manual, section 1.7 ("Strength Limitations").
 * The harbour and sea condition tables are kept separate so the user can
 * choose which one applies (sea passage vs. cargo operations alongside).
 * -------------------------------------------------------------------- */

export const SF_BM_LIMITS: SfBmTable = {
  atSea: [
    { fr: 29, x: 17.4, bendMin: -120000, bendMax: 120000, sfMin: -16350, sfMax: 16350 },
    { fr: 32, x: 19.25, bendMin: -160000, bendMax: 160000, sfMin: -16350, sfMax: 16350 },
    { fr: 50, x: 30.95, bendMin: -160000, bendMax: 160000, sfMin: -16350, sfMax: 16350 },
    { fr: 70, x: 43.95, bendMin: -160000, bendMax: 160000, sfMin: -16350, sfMax: 16350 },
    { fr: 90, x: 56.95, bendMin: -160000, bendMax: 160000, sfMin: -16350, sfMax: 16350 },
    { fr: 110, x: 69.95, bendMin: -160000, bendMax: 160000, sfMin: -16350, sfMax: 16350 },
    { fr: 130, x: 82.95, bendMin: -160000, bendMax: 160000, sfMin: -16350, sfMax: 16350 },
    { fr: 150, x: 95.95, bendMin: -160000, bendMax: 160000, sfMin: -16350, sfMax: 16350 },
    { fr: 170, x: 108.95, bendMin: -160000, bendMax: 160000, sfMin: -16350, sfMax: 16350 },
    { fr: 197, x: 126.5, bendMin: -160000, bendMax: 160000, sfMin: -16350, sfMax: 16350 },
    { fr: 201, x: 129.1, bendMin: -15000, bendMax: 60000, sfMin: -16350, sfMax: 16350 },
  ],
  atHarbour: [
    { fr: 29, x: 17.4, bendMin: -190000, bendMax: 190000, sfMin: -16350, sfMax: 16350 },
    { fr: 32, x: 19.25, bendMin: -280000, bendMax: 280000, sfMin: -16350, sfMax: 16350 },
    { fr: 50, x: 30.95, bendMin: -280000, bendMax: 280000, sfMin: -16350, sfMax: 16350 },
    { fr: 70, x: 43.95, bendMin: -280000, bendMax: 280000, sfMin: -16350, sfMax: 16350 },
    { fr: 90, x: 56.95, bendMin: -280000, bendMax: 280000, sfMin: -16350, sfMax: 16350 },
    { fr: 110, x: 69.95, bendMin: -280000, bendMax: 280000, sfMin: -16350, sfMax: 16350 },
    { fr: 130, x: 82.95, bendMin: -280000, bendMax: 280000, sfMin: -16350, sfMax: 16350 },
    { fr: 150, x: 95.95, bendMin: -280000, bendMax: 280000, sfMin: -16350, sfMax: 16350 },
    { fr: 170, x: 108.95, bendMin: -280000, bendMax: 280000, sfMin: -16350, sfMax: 16350 },
    { fr: 197, x: 126.5, bendMin: -280000, bendMax: 280000, sfMin: -16350, sfMax: 16350 },
    { fr: 201, x: 129.1, bendMin: -25000, bendMax: 80000, sfMin: -16350, sfMax: 16350 },
  ],
};

/* ----------------------------------------------------------------------
 * Hydrostatics (zero trim, salt water RHO = 1.025)
 *
 * Coarse table sufficient to back-out the mean draft from the total
 * displacement.  Values were sampled from the "Hydrostatics for Trim 0"
 * block in the Bulk Cargo Loading Manual (section 4.1).
 * -------------------------------------------------------------------- */

export const HYDRO_TABLE: readonly HydroRow[] = [
  { draft: 2.5, displacement: 5300, lcb: 71.8, lcf: 70.5, mct1cm: 145, tpc: 22.0 },
  { draft: 3.0, displacement: 6450, lcb: 71.6, lcf: 70.0, mct1cm: 150, tpc: 22.4 },
  { draft: 3.5, displacement: 7610, lcb: 71.4, lcf: 69.5, mct1cm: 156, tpc: 22.8 },
  { draft: 4.0, displacement: 8780, lcb: 71.2, lcf: 69.0, mct1cm: 162, tpc: 23.2 },
  { draft: 4.5, displacement: 9960, lcb: 71.0, lcf: 68.5, mct1cm: 168, tpc: 23.6 },
  { draft: 5.0, displacement: 11150, lcb: 70.8, lcf: 68.0, mct1cm: 174, tpc: 24.0 },
  { draft: 5.35, displacement: 12153, lcb: 70.6, lcf: 67.6, mct1cm: 178, tpc: 24.3 },
  { draft: 5.6, displacement: 12760, lcb: 70.5, lcf: 67.4, mct1cm: 181, tpc: 24.5 },
] as const;

export function holdById(id: number): HoldGeometry | undefined {
  return HOLDS.find((h) => h.id === id);
}
