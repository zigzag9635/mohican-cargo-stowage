import type {
  CargoTemplate,
  HoldGeometry,
  HoldId,
  PlacedPiece,
} from '../types';
import { boxesOverlap, fitsInHold, type Box3 } from './geometry';

interface PieceInstance {
  templateId: string;
  l: number;
  w: number;
  h: number;
  weight: number;
  allowRotation: boolean;
  stackable: boolean;
  maxStackTier: number;
  /** index within the parcel — used to make placement ids deterministic */
  parcelIndex: number;
}

interface PackOptions {
  /** if false, items will not be auto-rotated even when allowed */
  enableRotation?: boolean;
  /** clearance between pieces, m (defaults to 0.05) */
  clearance?: number;
}

/** Expand a list of templates into individual piece instances and sort
 *  them by descending footprint × weight (heavier and bigger first).
 *  When the user specifies a positive dimensional tolerance, the
 *  effective length / breadth / height of each piece are inflated by
 *  the tolerance percentage so that the packer leaves room for the
 *  worst-case oversize. */
export function expandTemplates(templates: CargoTemplate[]): PieceInstance[] {
  const out: PieceInstance[] = [];
  for (const t of templates) {
    const tol = 1 + (t.tolerancePct || 0) / 100;
    for (let i = 0; i < t.quantity; i++) {
      out.push({
        templateId: t.id,
        l: t.length * tol,
        w: t.breadth * tol,
        h: t.height * tol,
        weight: t.weight,
        allowRotation: t.allowRotation,
        stackable: t.stackPolicy === 'stackable',
        maxStackTier: Math.max(1, t.maxStackTier),
        parcelIndex: i,
      });
    }
  }
  out.sort((a, b) => {
    const fa = a.l * a.w * a.weight;
    const fb = b.l * b.w * b.weight;
    return fb - fa;
  });
  return out;
}

/** Bottom-Left-Fill packer that places pieces inside a single hold,
 *  honouring rotation, stacking, notches and tank-top weight limits.
 *
 *  Returns the array of placed pieces (in hold-local coordinates) and
 *  a list of indices that could not be fitted. */
export function packHold(
  hold: HoldGeometry,
  pieces: PieceInstance[],
  shipTankTopLoad: number,
  opts: PackOptions = {},
): { placed: PlacedPiece[]; unplaced: PieceInstance[] } {
  const clearance = opts.clearance ?? 0.05;
  const placedBoxes: Box3[] = [];
  // Boxes that sit on the tank top (z = 0) only.  Stack-top placements
  // re-use the same (x, y) footprint and are guaranteed not to overlap
  // with anything outside that column, so they do NOT need to be
  // checked against placedBoxes during overlap testing.  Restricting the
  // overlap test to floorBoxes turns an O(N) per-placement scan into
  // O(F) where F is the number of distinct floor footprints (≈ N /
  // maxStackTier).
  const floorBoxes: Box3[] = [];
  const placedPieces: PlacedPiece[] = [];
  // For each (x, y) footprint occupied by a stackable template, we
  // remember the next free z slot and the next tier index.  When the
  // next identical piece arrives we drop it directly on top.
  const stackTops: Map<
    string,
    {
      x: number;
      y: number;
      w: number;
      l: number;
      /** absolute z of the next slot (top of the topmost placed piece) */
      nextZ: number;
      /** tier index of the next slot (0-based; 1 means "second piece") */
      nextTier: number;
      /** maximum number of pieces in a stack (== template.maxStackTier) */
      maxTier: number;
      templateId: string;
    }
  > = new Map();
  const unplaced: PieceInstance[] = [];

  // Tank-top load is checked exactly against the candidate footprint:
  // because pieces never overlap on the tank top, each footprint sees
  // only the weight of the (single) stack sitting on it.  We therefore
  // do not need a discretised grid — we just compare
  // (stack_weight / footprint_area) against the tank-top limit.

  // Candidate placement points (bottom-left-fill).  Always start from
  // (0, 0) on the tank top and add new candidates whenever a piece is
  // placed.
  const candidates: { x: number; y: number; z: number }[] = [{ x: 0, y: 0, z: 0 }];

  function uniquePush(c: { x: number; y: number; z: number }) {
    if (
      !candidates.some(
        (p) =>
          Math.abs(p.x - c.x) < 1e-3 && Math.abs(p.y - c.y) < 1e-3 && Math.abs(p.z - c.z) < 1e-3,
      )
    )
      candidates.push(c);
  }

  function tryPlaceOnGround(piece: PieceInstance): PlacedPiece | null {
    candidates.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
    const orientations: { l: number; w: number }[] = [{ l: piece.l, w: piece.w }];
    if (piece.allowRotation && (opts.enableRotation ?? true) && piece.l !== piece.w)
      orientations.push({ l: piece.w, w: piece.l });

    for (const c of candidates) {
      if (c.z > 1e-6) continue; // only ground placements in this loop
      for (const orient of orientations) {
        const box: Box3 = {
          x: c.x,
          y: c.y,
          z: 0,
          l: orient.l,
          w: orient.w,
          h: piece.h,
        };
        if (!fitsInHold(box, hold)) continue;
        if (overlapsAnyFloor(box)) continue;
        // tank-top weight check — account for the worst-case full stack
        // that could end up on this footprint.
        const tiers = piece.stackable ? piece.maxStackTier : 1;
        const loadOnFloor = (piece.weight * tiers) / (box.l * box.w);
        if (loadOnFloor > shipTankTopLoad) continue;
        return makePlacement(piece, box, 0);
      }
    }
    return null;
  }

  // Fast overlap check that only looks at boxes on the tank top.
  // Floor boxes are sorted by x so we can stop scanning once b.x is
  // beyond the candidate.
  function overlapsAnyFloor(box: Box3): boolean {
    const xMax = box.x + box.l;
    for (const b of floorBoxes) {
      if (b.x >= xMax) break;
      if (b.x + b.l <= box.x) continue;
      if (boxesOverlap(box, b)) return true;
    }
    return false;
  }

  function tryPlaceOnTopOfStack(piece: PieceInstance): PlacedPiece | null {
    if (!piece.stackable) return null;
    // Iterate stacks in reverse insertion order: newest stack first,
    // because that's the one most likely to still have room.
    const keys = [...stackTops.keys()];
    for (let i = keys.length - 1; i >= 0; i--) {
      const stack = stackTops.get(keys[i])!;
      if (stack.templateId !== piece.templateId) continue;
      if (stack.nextTier >= stack.maxTier) {
        // drop full stacks so future iterations stay short
        stackTops.delete(keys[i]);
        continue;
      }
      const box: Box3 = {
        x: stack.x,
        y: stack.y,
        z: stack.nextZ,
        l: stack.l,
        w: stack.w,
        h: piece.h,
      };
      if (!fitsInHold(box, hold)) continue;
      // The stack column is reserved by its tier-0 footprint, so we do
      // not need to test against every placed box — nothing else can
      // intrude on that column.
      return makePlacement(piece, box, stack.nextTier);
    }
    return null;
  }

  let runningCount = 0;
  function makePlacement(piece: PieceInstance, box: Box3, tier: number): PlacedPiece {
    runningCount += 1;
    const placement: PlacedPiece = {
      id: `p_${hold.id}_${piece.templateId}_${piece.parcelIndex}_${runningCount}`,
      templateId: piece.templateId,
      holdId: hold.id as HoldId,
      x: box.x,
      y: box.y,
      z: box.z,
      rotated: !nearlyEqual(box.l, piece.l) || !nearlyEqual(box.w, piece.w),
      tier,
    };
    placedBoxes.push({ ...box });
    if (box.z < 1e-6) {
      // keep floor boxes sorted by x for fast overlap pruning
      let lo = 0;
      let hi = floorBoxes.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (floorBoxes[mid].x < box.x) lo = mid + 1;
        else hi = mid;
      }
      floorBoxes.splice(lo, 0, { ...box });
    }
    placedPieces.push(placement);
    if (piece.stackable && piece.maxStackTier > 1) {
      const key = `${piece.templateId}@${box.x.toFixed(3)},${box.y.toFixed(3)}`;
      stackTops.set(key, {
        x: box.x,
        y: box.y,
        l: box.l,
        w: box.w,
        nextZ: box.z + box.h,
        nextTier: tier + 1,
        maxTier: piece.maxStackTier,
        templateId: piece.templateId,
      });
    }
    // Only emit ground candidates — stack tops are searched via the
    // stackTops map and don't contribute to the BLF candidate list.
    if (box.z < 1e-6) {
      uniquePush({ x: box.x + box.l + clearance, y: box.y, z: 0 });
      uniquePush({ x: box.x, y: box.y + box.w + clearance, z: 0 });
    }
    return placement;
  }

  for (const piece of pieces) {
    let p = tryPlaceOnTopOfStack(piece);
    if (!p) p = tryPlaceOnGround(piece);
    if (!p) unplaced.push(piece);
  }

  return { placed: placedPieces, unplaced };
}

function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) < 1e-3;
}

/** Convenience wrapper that takes an array of cargo templates and runs
 *  the packer for one specific hold.  Pieces unable to fit are returned
 *  as well, so the UI can highlight them. */
export function autoPackOneHold(
  hold: HoldGeometry,
  templates: CargoTemplate[],
  shipTankTopLoad: number,
): { placed: PlacedPiece[]; unplacedQty: Map<string, number> } {
  const all = expandTemplates(templates);
  const { placed, unplaced } = packHold(hold, all, shipTankTopLoad);
  const unplacedQty = new Map<string, number>();
  for (const u of unplaced) {
    unplacedQty.set(u.templateId, (unplacedQty.get(u.templateId) ?? 0) + 1);
  }
  return { placed, unplacedQty };
}
