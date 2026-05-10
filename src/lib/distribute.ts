import type {
  CargoTemplate,
  HoldGeometry,
  HoldId,
  PlacedPiece,
} from '../types';
import { HOLDS, SHIP } from '../data/ship';
import {
  computeStability,
  interpHydro,
  type ConditionMode,
} from './stability';

export type DistributeMode =
  | { kind: 'quantity'; quantity: number }
  | { kind: 'meanDraft'; meanDraft: number }
  | { kind: 'sternTrim'; trim: number };

export interface DistributeRequest {
  template: CargoTemplate;
  /** other parcels already loaded, kept fixed when distributing */
  existingTemplates: CargoTemplate[];
  existingPlacements: PlacedPiece[];
  seawaterDensity: number;
  condition: ConditionMode;
  mode: DistributeMode;
}

export interface DistributeResult {
  byHold: Record<HoldId, number>;
  totalPlaced: number;
  totalRequested: number;
  estTotalWeight: number;
  estMeanDraft: number;
  estTrim: number;
  feasible: boolean;
  message: string;
}

/* ----------------------------------------------------------------------
 * Analytical distributor.
 *
 * Per-piece simulation through computeStability is far too expensive
 * for parcels of several thousand pieces.  We work with a 4-element
 * count vector (n1, n2, n3, n4) and use closed-form expressions for
 * displacement / mean draft / trim, treating each hold's contribution
 * as a point mass at its longitudinal centre.  SF / BM are not checked
 * during the search — they are evaluated once at the end and reported
 * via the result.feasible flag so the user can see if the chosen
 * distribution exceeds limits.
 * -------------------------------------------------------------------- */

export function autoDistribute(req: DistributeRequest): DistributeResult {
  const { template, existingTemplates, existingPlacements } = req;

  // 1) Per-hold layout capacity for the new parcel — estimated
  //    analytically (footprint count × stack tiers, capped by tank-top
  //    and hold height).  Running the actual packer four times costs
  //    a couple of seconds per call which is unacceptable for parcels
  //    of thousands of pieces; the estimate is conservative enough for
  //    the distribution decision.  The actual placement after
  //    distribution still uses the real packer.
  const capacity: Record<HoldId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const h of HOLDS) {
    capacity[h.id] = estimateHoldCapacity(h, template);
  }

  // 2) Pre-compute the lightship + existing-cargo moments (independent
  //    of the new parcel).
  const tplMap = new Map<string, CargoTemplate>(
    existingTemplates.map((t) => [t.id, t]),
  );
  let baseW = SHIP.lightship;
  let baseMx = SHIP.lightship * SHIP.lightshipLcg;
  for (const p of existingPlacements) {
    const tpl = tplMap.get(p.templateId);
    const hold = HOLDS.find((h) => h.id === p.holdId);
    if (!tpl || !hold) continue;
    const lDim = p.rotated ? tpl.breadth : tpl.length;
    const cx = hold.xAft + p.x + lDim / 2;
    baseW += tpl.weight;
    baseMx += tpl.weight * cx;
  }

  // 3) Hold longitudinal centre (used as the LCG of every piece in the
  //    hold for trim/draft estimation).
  const holdLcg: Record<HoldId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const h of HOLDS) holdLcg[h.id] = h.xAft + h.length / 2;

  // ---- Determine target counts depending on the requested mode ----
  let counts: Record<HoldId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  if (req.mode.kind === 'quantity') {
    counts = greedyDistributeByQuantity(
      req.mode.quantity,
      capacity,
      template,
      baseW,
      baseMx,
      holdLcg,
    );
  } else if (req.mode.kind === 'meanDraft') {
    // Required total displacement to reach target draft.
    const dispNeeded = findDispForDraft(req.mode.meanDraft, req.seawaterDensity);
    const need = Math.max(0, dispNeeded - baseW);
    if (template.weight > 0) {
      const qty = Math.floor(need / template.weight);
      counts = greedyDistributeByQuantity(qty, capacity, template, baseW, baseMx, holdLcg);
    }
  } else if (req.mode.kind === 'sternTrim') {
    counts = searchByTrim(
      req.mode.trim,
      template,
      capacity,
      baseW,
      baseMx,
      holdLcg,
      req.seawaterDensity,
    );
  }

  // ---- Final stability for the chosen distribution -----------------
  // To avoid building (and stability-iterating over) thousands of
  // synthetic placements, we represent each hold's stack as a single
  // "super-piece" whose weight equals (piece weight × number of pieces
  // in that hold).  This is enough to get total displacement, mean
  // draft and trim right, and gives an approximate SF/BM that is
  // good enough for the feasibility flag.
  const tplPerHold: CargoTemplate[] = [];
  const placementsForStab: PlacedPiece[] = existingPlacements.slice();
  for (const h of HOLDS) {
    const n = counts[h.id];
    if (n <= 0) continue;
    const cloned: CargoTemplate = {
      ...template,
      id: `${template.id}__h${h.id}`,
      weight: template.weight * n,
      quantity: 1,
    };
    tplPerHold.push(cloned);
    placementsForStab.push({
      id: `tmp_${h.id}_${cloned.id}`,
      templateId: cloned.id,
      holdId: h.id,
      x: h.length / 2 - template.length / 2,
      y: h.breadth / 2 - template.breadth / 2,
      z: 0,
      rotated: false,
      tier: 0,
    });
  }
  const stab = computeStability({
    placements: placementsForStab,
    templates: [...existingTemplates, ...tplPerHold],
    seawaterDensity: req.seawaterDensity,
    condition: req.condition,
  });

  return {
    byHold: counts,
    totalPlaced: counts[1] + counts[2] + counts[3] + counts[4],
    totalRequested:
      req.mode.kind === 'quantity'
        ? req.mode.quantity
        : counts[1] + counts[2] + counts[3] + counts[4],
    estTotalWeight: stab.totalWeight,
    estMeanDraft: stab.meanDraft,
    estTrim: stab.trim,
    feasible: stab.sfUtilization <= 1 && stab.bmUtilization <= 1,
    message:
      stab.sfUtilization > 1 || stab.bmUtilization > 1
        ? 'Distribution exceeds SF/BM limits — consider lower quantity.'
        : 'OK',
  };
}

/** Quick analytical estimate of how many pieces of a single template
 *  fit inside a hold, ignoring notches and rotation (slightly
 *  conservative). */
function estimateHoldCapacity(hold: HoldGeometry, tpl: CargoTemplate): number {
  const tol = 1 + (tpl.tolerancePct || 0) / 100;
  const l = tpl.length * tol;
  const w = tpl.breadth * tol;
  const h = tpl.height * tol;
  const clearance = 0.05;
  // Try both orientations and take the larger floor count.
  const nByXY = (a: number, b: number) =>
    Math.floor((hold.length + clearance) / (a + clearance)) *
    Math.floor((hold.breadth + clearance) / (b + clearance));
  let floor = nByXY(l, w);
  if (tpl.allowRotation && l !== w) floor = Math.max(floor, nByXY(w, l));
  if (floor <= 0) return 0;
  // Tier limits: hold height, max stack tier, tank-top.
  const heightTiers = Math.max(1, Math.floor(hold.height / Math.max(h, 0.001)));
  const stackTiers = tpl.stackPolicy === 'stackable' ? Math.max(1, tpl.maxStackTier) : 1;
  const footprintArea = l * w;
  const tankTopTiers =
    tpl.weight > 0 && footprintArea > 0
      ? Math.max(1, Math.floor((SHIP.tankTopLoad * footprintArea) / tpl.weight))
      : stackTiers;
  const tiers = Math.min(heightTiers, stackTiers, tankTopTiers);
  return floor * tiers;
}

/* ---------------------- helpers ---------------------- */

/** Cheap displacement / draft / trim estimate from a count vector,
 *  using each hold's longitudinal centre as the cargo LCG. */
function estimate(
  counts: Record<HoldId, number>,
  tpl: CargoTemplate,
  baseW: number,
  baseMx: number,
  holdLcg: Record<HoldId, number>,
  rho: number,
): { disp: number; draft: number; trim: number } {
  let w = baseW;
  let mx = baseMx;
  for (const id of [1, 2, 3, 4] as HoldId[]) {
    const n = counts[id];
    if (n <= 0) continue;
    w += n * tpl.weight;
    mx += n * tpl.weight * holdLcg[id];
  }
  const lcg = w > 0 ? mx / w : 0;
  const hydro = interpHydro(w, rho);
  // Trim (m) = (LCG - LCB) × Δ / (100 × MCT1cm) — MCT is t·m / cm,
  // so dividing by 100 converts cm→m.
  const trim = ((lcg - hydro.lcb) * w) / (100 * hydro.mct1cm);
  return { disp: w, draft: hydro.draft, trim };
}

/** Greedily pour `qty` pieces into the four holds, choosing at each
 *  step the hold whose addition keeps |trim| smallest (so quantity-
 *  mode produces a roughly balanced load). */
function greedyDistributeByQuantity(
  qty: number,
  capacity: Record<HoldId, number>,
  tpl: CargoTemplate,
  baseW: number,
  baseMx: number,
  holdLcg: Record<HoldId, number>,
): Record<HoldId, number> {
  const counts: Record<HoldId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let placed = 0;
  while (placed < qty) {
    let best: HoldId | null = null;
    let bestAbsTrim = Number.POSITIVE_INFINITY;
    for (const id of [1, 2, 3, 4] as HoldId[]) {
      if (counts[id] >= capacity[id]) continue;
      counts[id] += 1;
      const { trim } = estimate(counts, tpl, baseW, baseMx, holdLcg, SHIP.defaultSeawaterDensity);
      counts[id] -= 1;
      if (Math.abs(trim) < bestAbsTrim) {
        bestAbsTrim = Math.abs(trim);
        best = id;
      }
    }
    if (best === null) break; // all four holds full
    counts[best] += 1;
    placed += 1;
  }
  return counts;
}

/** Search for the count vector whose trim is closest to the target
 *  while respecting per-hold capacity.  We add pieces one at a time,
 *  always picking the hold whose addition reduces |trim − target|
 *  fastest. */
function searchByTrim(
  targetTrim: number,
  tpl: CargoTemplate,
  capacity: Record<HoldId, number>,
  baseW: number,
  baseMx: number,
  holdLcg: Record<HoldId, number>,
  rho: number,
): Record<HoldId, number> {
  const counts: Record<HoldId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const totalCap = capacity[1] + capacity[2] + capacity[3] + capacity[4];
  let bestSnapshot = { ...counts };
  let bestObj = Number.POSITIVE_INFINITY;
  for (let step = 0; step < totalCap; step++) {
    let bestId: HoldId | null = null;
    let bestStepObj = Number.POSITIVE_INFINITY;
    for (const id of [1, 2, 3, 4] as HoldId[]) {
      if (counts[id] >= capacity[id]) continue;
      counts[id] += 1;
      const { trim } = estimate(counts, tpl, baseW, baseMx, holdLcg, rho);
      counts[id] -= 1;
      const obj = Math.abs(trim - targetTrim);
      if (obj < bestStepObj) {
        bestStepObj = obj;
        bestId = id;
      }
    }
    if (bestId === null) break;
    counts[bestId] += 1;
    if (bestStepObj < bestObj) {
      bestObj = bestStepObj;
      bestSnapshot = { ...counts };
    } else if (bestStepObj > bestObj * 1.5 && bestObj < 0.05) {
      // we've passed the optimum — stop adding pieces
      break;
    }
  }
  return bestSnapshot;
}

function findDispForDraft(targetDraft: number, rho: number): number {
  let lo = SHIP.lightship;
  let hi = SHIP.lightship + SHIP.maxHoldWeight * 4;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const d = interpHydro(mid, rho).draft;
    if (d < targetDraft) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
