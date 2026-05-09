import type { HoldGeometry } from '../types';

export interface Box3 {
  /** longitudinal coordinate of aft-port-bottom corner, in hold-local frame */
  x: number;
  y: number;
  z: number;
  l: number;
  w: number;
  h: number;
}

/** Returns true if the supplied box fits entirely inside the hold envelope
 *  (taking notches at the upper fore/aft corners into account). */
export function fitsInHold(box: Box3, hold: HoldGeometry): boolean {
  if (box.x < -1e-6) return false;
  if (box.y < -1e-6) return false;
  if (box.z < -1e-6) return false;
  if (box.x + box.l > hold.length + 1e-6) return false;
  if (box.y + box.w > hold.breadth + 1e-6) return false;
  if (box.z + box.h > hold.height + 1e-6) return false;

  for (const n of hold.notches) {
    const topZ = box.z + box.h;
    const notchTopZ = hold.height;
    const notchBottomZ = hold.height - n.height;
    if (topZ <= notchBottomZ + 1e-6) continue;

    // The piece reaches into the upper "notch band".  In that band, the
    // longitudinal range covered by the notch is forbidden.
    const xStart = box.x;
    const xEnd = box.x + box.l;

    if (n.end === 'aft') {
      if (xStart < n.length - 1e-6) return false;
    } else {
      if (xEnd > hold.length - n.length + 1e-6) return false;
    }

    void notchTopZ;
  }

  return true;
}

export function boxesOverlap(a: Box3, b: Box3): boolean {
  return (
    a.x < b.x + b.l - 1e-6 &&
    a.x + a.l > b.x + 1e-6 &&
    a.y < b.y + b.w - 1e-6 &&
    a.y + a.w > b.y + 1e-6 &&
    a.z < b.z + b.h - 1e-6 &&
    a.z + a.h > b.z + 1e-6
  );
}

/** Returns the largest free rectangle on the tank-top floor at the given
 *  longitudinal position; useful when displaying remaining-space dims. */
export function freeFloorAreas(
  hold: HoldGeometry,
  occupied: Box3[],
): { x: number; y: number; l: number; w: number }[] {
  // Maximal-rectangles algorithm in 2D.  Start with a single rectangle
  // covering the entire tank top, then for every occupied footprint
  // subtract its projection on the floor.
  let rects: { x: number; y: number; l: number; w: number }[] = [
    { x: 0, y: 0, l: hold.length, w: hold.breadth },
  ];
  for (const o of occupied) {
    const next: typeof rects = [];
    const block = { x: o.x, y: o.y, l: o.l, w: o.w };
    for (const r of rects) {
      // No intersection
      if (
        block.x >= r.x + r.l ||
        block.x + block.l <= r.x ||
        block.y >= r.y + r.w ||
        block.y + block.w <= r.y
      ) {
        next.push(r);
        continue;
      }
      // Split r into up to 4 sub-rectangles around the blocked region.
      if (block.x > r.x) next.push({ x: r.x, y: r.y, l: block.x - r.x, w: r.w });
      if (block.x + block.l < r.x + r.l)
        next.push({ x: block.x + block.l, y: r.y, l: r.x + r.l - (block.x + block.l), w: r.w });
      if (block.y > r.y)
        next.push({
          x: Math.max(r.x, block.x),
          y: r.y,
          l: Math.min(r.x + r.l, block.x + block.l) - Math.max(r.x, block.x),
          w: block.y - r.y,
        });
      if (block.y + block.w < r.y + r.w)
        next.push({
          x: Math.max(r.x, block.x),
          y: block.y + block.w,
          l: Math.min(r.x + r.l, block.x + block.l) - Math.max(r.x, block.x),
          w: r.y + r.w - (block.y + block.w),
        });
    }
    // Remove dominated rectangles (those completely inside another).
    rects = next.filter(
      (a, i) =>
        !next.some(
          (b, j) =>
            i !== j &&
            b.x <= a.x + 1e-6 &&
            b.y <= a.y + 1e-6 &&
            b.x + b.l >= a.x + a.l - 1e-6 &&
            b.y + b.w >= a.y + a.w - 1e-6,
        ),
    );
  }
  // Filter out negligible slivers
  return rects.filter((r) => r.l > 0.05 && r.w > 0.05);
}
