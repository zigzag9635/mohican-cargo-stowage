import type {
  CargoTemplate,
  HoldId,
  PlacedPiece,
} from '../types';
import { HOLDS, SHIP } from '../data/ship';
import { autoPackOneHold } from './packing';
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
 * Greedy distribution.
 *
 * We loop, attempting to place one extra piece at a time in the hold
 * that gives the best objective value (smallest distance to the target
 * trim / draft, or simplest "fill-the-holds" policy) while keeping
 * SF/BM within their respective limits.
 * -------------------------------------------------------------------- */

export function autoDistribute(req: DistributeRequest): DistributeResult {
  const { template, existingTemplates, existingPlacements } = req;
  const counts: Record<HoldId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let target = Number.POSITIVE_INFINITY;
  if (req.mode.kind === 'quantity') target = req.mode.quantity;
  else if (req.mode.kind === 'meanDraft') {
    // Required total weight to reach the desired mean draft
    const hydro = findDispForDraft(req.mode.meanDraft, req.seawaterDensity);
    const need = Math.max(0, hydro - SHIP.lightship - existingWeight(existingTemplates, existingPlacements));
    if (template.weight > 0) target = Math.floor(need / template.weight);
  } else if (req.mode.kind === 'sternTrim') {
    target = template.quantity;
  }

  // Maximum capacity per hold (rough): by weight, by floor area, and by
  // layout (fast estimate using packing; expensive but only run once).
  const capacityByLayout: Record<HoldId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const h of HOLDS) {
    const tpl: CargoTemplate = { ...template, quantity: 9999 };
    const { placed } = autoPackOneHold(h, [tpl], SHIP.tankTopLoad);
    capacityByLayout[h.id] = placed.length;
  }

  let bestSnapshot = { ...counts };
  let bestObj = Number.POSITIVE_INFINITY;
  const message: string[] = [];

  for (let step = 0; step < target && step < 5000; step++) {
    let bestHold: HoldId | null = null;
    let bestStepObj = Number.POSITIVE_INFINITY;

    for (const h of HOLDS) {
      if (counts[h.id] >= capacityByLayout[h.id]) continue;
      const candidateTemplates: CargoTemplate[] = existingTemplates.slice();
      // Add this template-with-current-count + 1 to the candidate
      const trial: CargoTemplate = { ...template, quantity: counts[h.id] + 1 };
      candidateTemplates.push(trial);
      // The distribution check works on summed quantities → we only
      // pack the trial in *this* hold for now and assume previously
      // placed pieces remain valid.  For BM/SF we approximate by
      // computing stability from existing + new pieces in this hold.
      const trialPlacements: PlacedPiece[] = existingPlacements.slice();
      // Synthetic placements (we don't bother actually packing here —
      // we use a single-point load at the hold's LCG for trim/SF speed).
      const h0 = HOLDS.find((x) => x.id === h.id)!;
      for (let k = 0; k < counts[h.id] + 1; k++) {
        trialPlacements.push({
          id: `tmp_${h.id}_${k}_${trial.id}`,
          templateId: trial.id,
          holdId: h.id,
          x: h0.length / 2 - trial.length / 2,
          y: h0.breadth / 2 - trial.breadth / 2,
          z: 0,
          rotated: false,
          tier: 0,
        });
      }
      // Also add other holds' synthetic placements
      for (const other of HOLDS) {
        if (other.id === h.id) continue;
        for (let k = 0; k < counts[other.id]; k++) {
          trialPlacements.push({
            id: `tmp_${other.id}_${k}_${trial.id}`,
            templateId: trial.id,
            holdId: other.id,
            x: other.length / 2 - trial.length / 2,
            y: other.breadth / 2 - trial.breadth / 2,
            z: 0,
            rotated: false,
            tier: 0,
          });
        }
      }
      const stab = computeStability({
        placements: trialPlacements,
        templates: [...existingTemplates, trial],
        seawaterDensity: req.seawaterDensity,
        condition: req.condition,
      });
      // Reject placements that violate strength limits
      if (Math.abs(stab.sfUtilization) > 1.0) continue;
      if (Math.abs(stab.bmUtilization) > 1.0) continue;

      let obj: number;
      if (req.mode.kind === 'sternTrim') obj = Math.abs(stab.trim - req.mode.trim);
      else if (req.mode.kind === 'meanDraft')
        obj = Math.abs(stab.meanDraft - req.mode.meanDraft);
      else obj = -(counts[1] + counts[2] + counts[3] + counts[4] + 1);
      if (obj < bestStepObj) {
        bestStepObj = obj;
        bestHold = h.id;
      }
    }

    if (bestHold === null) {
      message.push('No further pieces could be placed (capacity or strength limits reached).');
      break;
    }
    counts[bestHold] += 1;
    if (bestStepObj < bestObj) {
      bestObj = bestStepObj;
      bestSnapshot = { ...counts };
    }
  }

  const finalCounts =
    req.mode.kind === 'sternTrim' || req.mode.kind === 'meanDraft' ? bestSnapshot : counts;
  // Final stability for the chosen distribution
  const finalTrial: CargoTemplate = {
    ...template,
    quantity: finalCounts[1] + finalCounts[2] + finalCounts[3] + finalCounts[4],
  };
  const finalPlacements: PlacedPiece[] = existingPlacements.slice();
  for (const h of HOLDS) {
    const h0 = HOLDS.find((x) => x.id === h.id)!;
    for (let k = 0; k < finalCounts[h.id]; k++) {
      finalPlacements.push({
        id: `tmp_${h.id}_${k}_${finalTrial.id}`,
        templateId: finalTrial.id,
        holdId: h.id,
        x: h0.length / 2 - finalTrial.length / 2,
        y: h0.breadth / 2 - finalTrial.breadth / 2,
        z: 0,
        rotated: false,
        tier: 0,
      });
    }
  }
  const stab = computeStability({
    placements: finalPlacements,
    templates: [...existingTemplates, finalTrial],
    seawaterDensity: req.seawaterDensity,
    condition: req.condition,
  });

  return {
    byHold: finalCounts,
    totalPlaced: finalCounts[1] + finalCounts[2] + finalCounts[3] + finalCounts[4],
    totalRequested: Number.isFinite(target) ? target : 0,
    estTotalWeight: stab.totalWeight,
    estMeanDraft: stab.meanDraft,
    estTrim: stab.trim,
    feasible: stab.sfUtilization <= 1 && stab.bmUtilization <= 1,
    message: message.join(' ').trim() || 'OK',
  };
}

function findDispForDraft(targetDraft: number, rho: number): number {
  // Walk back-and-forth on the hydrostatic table.
  // We want a draft equal to targetDraft, so iterate displacements
  // until interpHydro returns approximately the desired draft.
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

function existingWeight(templates: CargoTemplate[], placements: PlacedPiece[]): number {
  const tplMap = new Map(templates.map((t) => [t.id, t]));
  let w = 0;
  for (const p of placements) {
    const tpl = tplMap.get(p.templateId);
    if (tpl) w += tpl.weight;
  }
  return w;
}
