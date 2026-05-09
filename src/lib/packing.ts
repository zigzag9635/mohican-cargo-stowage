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
  const placedPieces: PlacedPiece[] = [];
  // tierStack[`${templateId}@${tier}`] keeps track of "stacks" of identical
  // pieces — i.e. for stackable templates, when piece N is placed at
  // tier 0, piece N+1 may be placed directly on top at tier 1, etc.
  const stackTops: Map<string, { x: number; y: number; w: number; l: number; nextTier: number; maxTier: number; baseZ: number; templateId: string }> = new Map();
  const unplaced: PieceInstance[] = [];

  // Tank-top floor load grid (0.5 m × 0.5 m cells).  We accumulate the
  // weight of every piece sitting on the floor that occupies each cell;
  // the load equals (total weight projected onto the cell) / cell area.
  const cellSize = 0.5;
  const nCellsX = Math.ceil(hold.length / cellSize);
  const nCellsY = Math.ceil(hold.breadth / cellSize);
  const floorLoad = new Float64Array(nCellsX * nCellsY);
  const cellArea = cellSize * cellSize;

  function loadAt(x: number, y: number, l: number, w: number): number {
    let max = 0;
    const x0 = Math.max(0, Math.floor(x / cellSize));
    const x1 = Math.min(nCellsX, Math.ceil((x + l) / cellSize));
    const y0 = Math.max(0, Math.floor(y / cellSize));
    const y1 = Math.min(nCellsY, Math.ceil((y + w) / cellSize));
    for (let i = x0; i < x1; i++) {
      for (let j = y0; j < y1; j++) {
        const v = floorLoad[i * nCellsY + j];
        if (v > max) max = v;
      }
    }
    return max;
  }

  function addLoad(x: number, y: number, l: number, w: number, weight: number) {
    // distribute the weight uniformly over the projection
    const totalCells = (l / cellSize) * (w / cellSize);
    if (totalCells <= 0) return;
    const perCell = weight / (totalCells * cellArea);
    const x0 = Math.max(0, Math.floor(x / cellSize));
    const x1 = Math.min(nCellsX, Math.ceil((x + l) / cellSize));
    const y0 = Math.max(0, Math.floor(y / cellSize));
    const y1 = Math.min(nCellsY, Math.ceil((y + w) / cellSize));
    for (let i = x0; i < x1; i++) {
      for (let j = y0; j < y1; j++) {
        floorLoad[i * nCellsY + j] += perCell;
      }
    }
  }

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
        if (placedBoxes.some((b) => boxesOverlap(box, b))) continue;
        // tank-top weight check
        const loadOnFloor = loadAt(box.x, box.y, box.l, box.w) + piece.weight / (box.l * box.w);
        if (loadOnFloor > shipTankTopLoad) continue;
        return makePlacement(piece, box, 0);
      }
    }
    return null;
  }

  function tryPlaceOnTopOfStack(piece: PieceInstance): PlacedPiece | null {
    if (!piece.stackable) return null;
    for (const [, stack] of stackTops) {
      if (stack.templateId !== piece.templateId) continue;
      if (stack.nextTier >= stack.maxTier) continue;
      // Place a copy directly on top of the stack
      const box: Box3 = {
        x: stack.x,
        y: stack.y,
        z: stack.baseZ + stack.nextTier * piece.h,
        l: stack.l,
        w: stack.w,
        h: piece.h,
      };
      if (!fitsInHold(box, hold)) continue;
      if (placedBoxes.some((b) => boxesOverlap(box, b))) continue;
      const placed = makePlacement(piece, box, stack.nextTier);
      stack.nextTier += 1;
      return placed;
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
    placedPieces.push(placement);
    if (box.z < 1e-6) {
      addLoad(box.x, box.y, box.l, box.w, piece.weight);
    }
    if (piece.stackable && piece.maxStackTier > 1) {
      const key = `${piece.templateId}@${box.x.toFixed(3)},${box.y.toFixed(3)}`;
      stackTops.set(key, {
        x: box.x,
        y: box.y,
        l: box.l,
        w: box.w,
        baseZ: box.z,
        nextTier: tier + 1,
        maxTier: piece.maxStackTier,
        templateId: piece.templateId,
      });
    }
    // emit new candidates
    uniquePush({ x: box.x + box.l + clearance, y: box.y, z: box.z });
    uniquePush({ x: box.x, y: box.y + box.w + clearance, z: box.z });
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
