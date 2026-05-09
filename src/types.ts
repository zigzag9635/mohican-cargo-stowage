// Domain types for the M/V Mohican cargo stowage planner.
// All linear dimensions are in metres unless otherwise noted.
// All weights are in metric tonnes (t). Coordinates follow the ship's own
// system as used in the Bulk Cargo Loading Manual:
//   x — longitudinal (positive towards the bow), origin at AP
//   y — transverse (positive to starboard), origin at centreline
//   z — vertical (positive up), origin at baseline / keel

export type HoldId = 1 | 2 | 3 | 4;

/** A rectangular notch cut out of the otherwise box-shaped hold volume.
 *  All notches in this app are full-breadth and only "eat" the upper
 *  fore/aft corners, matching the description provided by the master:
 *  1.75 m vertically × 1.30 m longitudinally × full breadth.
 */
export interface HoldNotch {
  /** which longitudinal end of the hold the notch is at */
  end: 'fore' | 'aft';
  /** longitudinal extent of the notch, m */
  length: number;
  /** vertical extent of the notch (measured from the top of the hold), m */
  height: number;
}

export interface HoldGeometry {
  id: HoldId;
  name: string;
  /** internal length of the hold, m */
  length: number;
  /** internal breadth of the hold, m */
  breadth: number;
  /** internal height of the hold, from tank top to upper deck, m */
  height: number;
  /** longitudinal coordinate of the aft end of the hold (in ship coords) */
  xAft: number;
  /** vertical coordinate of the tank top (= floor of the hold) */
  zTankTop: number;
  /** maximum allowable cargo weight in this hold, t */
  maxWeight: number;
  notches: HoldNotch[];
}

export interface ShipParticulars {
  name: string;
  loa: number;
  lbp: number;
  beam: number;
  depth: number;
  /** lightship displacement (estimated from loading manual) */
  lightship: number;
  /** lightship LCG (m from AP) */
  lightshipLcg: number;
  /** lightship VCG (m above keel) */
  lightshipVcg: number;
  summerDraft: number;
  summerDisplacement: number;
  /** allowable inner-bottom load, t/m² */
  tankTopLoad: number;
  /** allowable load per hold, t */
  maxHoldWeight: number;
  /** typical fresh-water (1.000) and salt-water (1.025) densities are
   *  the reference; the user can override the value when computing draft */
  defaultSeawaterDensity: number;
}

/** A frame-based row in the SF/BM still-water limit table.  Linearly
 *  interpolated by the stability module. */
export interface SfBmFrame {
  fr: number;
  /** longitudinal coordinate, m from AP */
  x: number;
  bendMin: number;
  bendMax: number;
  sfMin: number;
  sfMax: number;
}

export interface SfBmTable {
  atSea: SfBmFrame[];
  atHarbour: SfBmFrame[];
}

/** Hydrostatic row: displacement at a given mean draft (zero trim,
 *  salt water RHO=1.025).  Used to back-out mean draft from a given
 *  total displacement and to provide LCB/MCT for trim. */
export interface HydroRow {
  draft: number;
  displacement: number;
  /** longitudinal centre of buoyancy, m from AP */
  lcb: number;
  /** longitudinal centre of flotation, m from AP */
  lcf: number;
  /** moment to change trim 1 cm, t·m/cm */
  mct1cm: number;
  /** tonnes per cm immersion, t/cm */
  tpc: number;
}

/* ---------------------------------------------------------------------- */
/* Cargo                                                                   */
/* ---------------------------------------------------------------------- */

export type StackPolicy = 'no_stack' | 'stackable';

export interface CargoTemplate {
  id: string;
  /** human-readable label, e.g. "Pipe bundle 12 m" */
  name: string;
  /** length along its own X axis, m */
  length: number;
  /** breadth along its own Y axis, m */
  breadth: number;
  /** height, m */
  height: number;
  /** weight per single piece, t */
  weight: number;
  /** allowed dimensional tolerance, % (positive number; 5 means ±5 %) */
  tolerancePct: number;
  /** whether the piece may be rotated 90° around the vertical axis when packing */
  allowRotation: boolean;
  /** whether the piece may be stacked under another piece of the same kind */
  stackPolicy: StackPolicy;
  /** maximum stacking tier (1 = single layer, 2 = two layers, ...) */
  maxStackTier: number;
  /** ISO destination port (free text — e.g. "RU LED" or "Hamburg") */
  dischargePort: string;
  /** shipper / bill-of-lading reference */
  shipper: string;
  /** total number of pieces of this kind in the parcel */
  quantity: number;
  /** UI colour used to render placed pieces; if omitted, derived from group */
  color?: string;
}

export interface PlacedPiece {
  /** unique placement id */
  id: string;
  /** template id this piece originates from */
  templateId: string;
  holdId: HoldId;
  /** X coordinate of the aft-port-bottom corner of the placed piece,
   *  in hold-local coordinates (x along the hold length, fwd positive,
   *  starting from the aft bulkhead) */
  x: number;
  y: number;
  z: number;
  /** rotated 90° around vertical (length and breadth swapped) */
  rotated: boolean;
  /** stack tier index (0 = on the floor) */
  tier: number;
}

/** Snapshot of the entire stowage plan that is persisted to JSON. */
export interface StowagePlan {
  schemaVersion: 1;
  shipName: string;
  voyage: string;
  notes: string;
  /** seawater density used for draft / trim calculations, t/m³ */
  seawaterDensity: number;
  templates: CargoTemplate[];
  placements: PlacedPiece[];
  createdAt: string;
  updatedAt: string;
}

/* ---------------------------------------------------------------------- */
/* Calculation results                                                     */
/* ---------------------------------------------------------------------- */

export interface HoldLoad {
  holdId: HoldId;
  pieces: number;
  weight: number;
  /** hold longitudinal centre of gravity, m from AP */
  lcg: number;
  tcg: number;
  vcg: number;
  /** maximum point load on tank top in this hold, t/m² */
  maxTankTopLoad: number;
}

export interface StabilityResult {
  totalWeight: number;
  /** total displacement (lightship + cargo), t */
  displacement: number;
  /** mean draft for the supplied seawater density, m */
  meanDraft: number;
  /** trim, m (positive = trim by stern) */
  trim: number;
  /** draft at AP, m */
  draftAft: number;
  /** draft at FP, m */
  draftFwd: number;
  /** combined LCG of ship + cargo, m from AP */
  lcg: number;
  vcg: number;
  /** array of (x, sf, bm) values along the ship */
  shearForce: { x: number; sf: number; sfMin: number; sfMax: number }[];
  bendingMoment: { x: number; bm: number; bmMin: number; bmMax: number }[];
  /** worst utilisation of SF / BM limits, fraction */
  sfUtilization: number;
  bmUtilization: number;
}
