import type {
  CargoTemplate,
  HoldLoad,
  HydroRow,
  PlacedPiece,
  SfBmFrame,
  SfBmTable,
  ShipParticulars,
  StabilityResult,
} from '../types';
import { HOLDS, HYDRO_TABLE, SF_BM_LIMITS, SHIP } from '../data/ship';

export type ConditionMode = 'sea' | 'harbour';

/** Linear interpolation between two hydrostatic rows for a given total
 *  displacement.  Returns mean draft, LCB, MCT and TPC. */
export function interpHydro(
  displacement: number,
  rho: number,
): { draft: number; lcb: number; lcf: number; mct1cm: number; tpc: number } {
  const sw = SHIP.defaultSeawaterDensity;
  // The hydrostatic table is for salt water (1.025).  Convert the
  // requested displacement into the equivalent volume and back to
  // displacement at the actual density.
  const volume = displacement / rho;
  const tableDisp = volume * sw;
  const rows = HYDRO_TABLE;
  if (tableDisp <= rows[0].displacement) {
    const r = rows[0];
    return { draft: r.draft, lcb: r.lcb, lcf: r.lcf, mct1cm: r.mct1cm, tpc: r.tpc };
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (tableDisp >= a.displacement && tableDisp <= b.displacement) {
      const t = (tableDisp - a.displacement) / (b.displacement - a.displacement);
      return {
        draft: lerp(a.draft, b.draft, t),
        lcb: lerp(a.lcb, b.lcb, t),
        lcf: lerp(a.lcf, b.lcf, t),
        mct1cm: lerp(a.mct1cm, b.mct1cm, t),
        tpc: lerp(a.tpc, b.tpc, t),
      };
    }
  }
  const r = rows[rows.length - 1];
  return { draft: r.draft, lcb: r.lcb, lcf: r.lcf, mct1cm: r.mct1cm, tpc: r.tpc };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function computeHoldLoads(
  placements: PlacedPiece[],
  templates: CargoTemplate[],
): HoldLoad[] {
  const tplMap = new Map(templates.map((t) => [t.id, t]));
  const result: HoldLoad[] = HOLDS.map((h) => ({
    holdId: h.id,
    pieces: 0,
    weight: 0,
    lcg: 0,
    tcg: 0,
    vcg: 0,
    maxTankTopLoad: 0,
  }));

  // Per-hold weighted moments
  const sums: Record<number, { w: number; mx: number; my: number; mz: number }> = {};
  for (const h of HOLDS) sums[h.id] = { w: 0, mx: 0, my: 0, mz: 0 };

  for (const p of placements) {
    const tpl = tplMap.get(p.templateId);
    const hold = HOLDS.find((h) => h.id === p.holdId);
    if (!tpl || !hold) continue;
    const lDim = p.rotated ? tpl.breadth : tpl.length;
    const wDim = p.rotated ? tpl.length : tpl.breadth;
    const hDim = tpl.height;
    // centre of the placed piece in ship coordinates
    const cx = hold.xAft + p.x + lDim / 2;
    // y in hold-local: 0 = port side; ship y = (W/2) - (yLocal + w/2)? Easier:
    // hold breadth is centred on CL → y_ship = (p.y + wDim / 2) - hold.breadth / 2.
    // Positive y = starboard.
    const cy = p.y + wDim / 2 - hold.breadth / 2;
    const cz = hold.zTankTop + p.z + hDim / 2;
    const w = tpl.weight;
    const s = sums[hold.id];
    s.w += w;
    s.mx += w * cx;
    s.my += w * cy;
    s.mz += w * cz;
    const ent = result.find((r) => r.holdId === hold.id)!;
    ent.pieces += 1;
  }

  for (const r of result) {
    const s = sums[r.holdId];
    if (s.w > 0) {
      r.weight = s.w;
      r.lcg = s.mx / s.w;
      r.tcg = s.my / s.w;
      r.vcg = s.mz / s.w;
    }
    // max tank-top load: scan placements on the floor and approximate
    const hold = HOLDS.find((h) => h.id === r.holdId)!;
    const cellSize = 0.5;
    const nx = Math.ceil(hold.length / cellSize);
    const ny = Math.ceil(hold.breadth / cellSize);
    const grid = new Float64Array(nx * ny);
    // Pre-aggregate the weight sitting above each stack column keyed by
    // (holdId, x, y).  This is O(N) and avoids the O(N²) filter that
    // used to dominate computeStability for thousands of placements.
    const stackedWeightAbove = new Map<string, number>();
    for (const q of placements) {
      if (q.holdId !== r.holdId) continue;
      if (q.tier === 0) continue;
      const t = tplMap.get(q.templateId);
      if (!t) continue;
      const k = `${q.x.toFixed(3)},${q.y.toFixed(3)}`;
      stackedWeightAbove.set(k, (stackedWeightAbove.get(k) ?? 0) + t.weight);
    }
    for (const p of placements) {
      if (p.holdId !== r.holdId) continue;
      if (p.tier !== 0) continue;
      const tpl = tplMap.get(p.templateId);
      if (!tpl) continue;
      const lDim = p.rotated ? tpl.breadth : tpl.length;
      const wDim = p.rotated ? tpl.length : tpl.breadth;
      const k = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
      const stackedW = stackedWeightAbove.get(k) ?? 0;
      const totalW = tpl.weight + stackedW;
      const x0 = Math.max(0, Math.floor(p.x / cellSize));
      const x1 = Math.min(nx, Math.ceil((p.x + lDim) / cellSize));
      const y0 = Math.max(0, Math.floor(p.y / cellSize));
      const y1 = Math.min(ny, Math.ceil((p.y + wDim) / cellSize));
      const projArea = lDim * wDim;
      const perCell = totalW / projArea;
      for (let i = x0; i < x1; i++) {
        for (let j = y0; j < y1; j++) {
          const idx = i * ny + j;
          if (grid[idx] < perCell) grid[idx] = perCell;
        }
      }
    }
    let max = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
    r.maxTankTopLoad = max;
  }
  return result;
}

/** Cargo-only weight distribution along the ship.  We treat each
 *  placement as a uniformly distributed load over its own longitudinal
 *  extent.  Lightship is intentionally NOT included here: the SF/BM
 *  reported by the planner is the *cargo-induced* shear force /
 *  bending moment relative to the lightship baseline, which is the
 *  quantity that matters for the SOLAS still-water envelope check. */
function buildLoadDistribution(
  placements: PlacedPiece[],
  templates: CargoTemplate[],
  ship: ShipParticulars,
  step: number,
): { x: number; q: number }[] {
  const tplMap = new Map(templates.map((t) => [t.id, t]));
  const nSegments = Math.ceil(ship.lbp / step) + 2;
  const xs: number[] = [];
  for (let i = 0; i <= nSegments; i++) xs.push(i * step);
  const segLoad = new Float64Array(xs.length);

  for (const p of placements) {
    const tpl = tplMap.get(p.templateId);
    const hold = HOLDS.find((h) => h.id === p.holdId);
    if (!tpl || !hold) continue;
    const lDim = p.rotated ? tpl.breadth : tpl.length;
    const xStart = hold.xAft + p.x;
    const xEnd = xStart + lDim;
    const slices: { idx: number; frac: number }[] = [];
    let fracSum = 0;
    for (let i = 0; i < xs.length; i++) {
      const sx = xs[i];
      const ex = sx + step;
      const overlap = Math.max(0, Math.min(xEnd, ex) - Math.max(xStart, sx));
      if (overlap > 0) {
        const frac = overlap / step;
        slices.push({ idx: i, frac });
        fracSum += frac;
      }
    }
    if (fracSum > 0) {
      for (const s of slices) {
        segLoad[s.idx] += (s.frac / fracSum) * tpl.weight;
      }
    }
  }

  return xs.map((x, i) => ({ x, q: segLoad[i] / step }));
}

/** Approximate buoyancy distribution (per-metre) consistent with the
 *  ship's hydrostatic LCB and total displacement.  We model the ship's
 *  waterline area as a parabolic distribution along x peaking near
 *  midship, and scale it so that ∫ b(x) dx = displacement and
 *  ∫ x·b(x) dx / displacement = LCB. */
function buoyancyDistribution(
  displacement: number,
  lcb: number,
  ship: ShipParticulars,
  xs: number[],
): number[] {
  const lbp = ship.lbp;
  // Parabolic shape p(x) = 1 - ((x - x0)/(lbp/2))^2 yields max at x0
  // and zero at the perpendiculars.  Adjust x0 so that the centroid of
  // p(x) over [0, lbp] equals lcb.  For a shifted parabola the
  // centroid offset from x0 is small, so we use x0 = lcb directly as a
  // first iteration and then refine.
  let x0 = lcb;
  for (let iter = 0; iter < 8; iter++) {
    let area = 0;
    let mom = 0;
    for (const x of xs) {
      if (x < 0 || x > lbp) continue;
      const v = Math.max(0, 1 - ((x - x0) / (lbp / 2)) ** 2);
      area += v;
      mom += v * x;
    }
    const centroid = area > 0 ? mom / area : x0;
    const error = lcb - centroid;
    x0 += error;
    if (Math.abs(error) < 1e-3) break;
  }
  // Now compute scale so that the integral equals displacement.
  let area = 0;
  const shape: number[] = [];
  const dx = xs[1] - xs[0];
  for (const x of xs) {
    if (x < 0 || x > lbp) {
      shape.push(0);
      continue;
    }
    const v = Math.max(0, 1 - ((x - x0) / (lbp / 2)) ** 2);
    shape.push(v);
    area += v * dx;
  }
  const scale = area > 0 ? displacement / area : 0;
  return shape.map((v) => v * scale);
}

/** Integrate q(x) (load per metre, t/m) and b(x) to obtain SF and BM
 *  along the ship.  Boundary conditions: SF(0) = SF(LBP) = 0,
 *  BM(0) = BM(LBP) = 0. */
function integrateSfBm(
  q: number[],
  b: number[],
  xs: number[],
): { sf: number[]; bm: number[] } {
  const dx = xs[1] - xs[0];
  const w: number[] = []; // net = q - b
  for (let i = 0; i < xs.length; i++) w.push(q[i] - b[i]);
  // SF(x) = ∫_0^x w(s) ds  (not quite — rigorously SF is the
  // cumulative load including buoyancy, in tonnes).  Sign convention:
  // positive SF is hogging.
  const sf: number[] = [0];
  for (let i = 1; i < xs.length; i++) {
    sf.push(sf[i - 1] + 0.5 * (w[i] + w[i - 1]) * dx);
  }
  const bm: number[] = [0];
  for (let i = 1; i < xs.length; i++) {
    bm.push(bm[i - 1] + 0.5 * (sf[i] + sf[i - 1]) * dx);
  }
  return { sf, bm };
}

export interface StabilityInputs {
  placements: PlacedPiece[];
  templates: CargoTemplate[];
  seawaterDensity: number;
  condition: ConditionMode;
}

export function computeStability(inp: StabilityInputs): StabilityResult {
  const ship = SHIP;
  const tplMap = new Map(inp.templates.map((t) => [t.id, t]));

  // Cargo total + LCG
  let cargoW = 0;
  let cargoMx = 0;
  let cargoMz = 0;
  for (const p of inp.placements) {
    const tpl = tplMap.get(p.templateId);
    const hold = HOLDS.find((h) => h.id === p.holdId);
    if (!tpl || !hold) continue;
    const lDim = p.rotated ? tpl.breadth : tpl.length;
    const cx = hold.xAft + p.x + lDim / 2;
    const cz = hold.zTankTop + p.z + tpl.height / 2;
    cargoW += tpl.weight;
    cargoMx += tpl.weight * cx;
    cargoMz += tpl.weight * cz;
  }
  const totalW = ship.lightship + cargoW;
  const totalMx = ship.lightship * ship.lightshipLcg + cargoMx;
  const totalMz = ship.lightship * ship.lightshipVcg + cargoMz;
  const lcg = totalW > 0 ? totalMx / totalW : ship.lightshipLcg;
  const vcg = totalW > 0 ? totalMz / totalW : ship.lightshipVcg;

  const hydro = interpHydro(totalW, inp.seawaterDensity);
  const meanDraft = hydro.draft;
  // Trim from MCT: trim (m) = (LCG - LCB) * displacement / (100 * MCT [t·m/cm]) / 100
  // (positive trim = trim by stern in our convention; MCT is per cm).
  const trim = (lcg - hydro.lcb) * totalW / (hydro.mct1cm * 100);
  const draftAft = meanDraft - trim * (ship.lbp / 2 - hydro.lcf) / ship.lbp;
  const draftFwd = meanDraft + trim * (ship.lbp / 2 + hydro.lcf) / ship.lbp;

  // Cargo-induced SF/BM along the ship.  We model the additional
  // buoyancy that supports the cargo weight as a parabolic
  // distribution whose centroid coincides with the cargo's LCG; this
  // makes the integrated SF and BM both vanish at the perpendiculars
  // which is the correct boundary condition.  The result is the
  // shear-force / bending-moment delta induced by the cargo, which is
  // what the SOLAS still-water envelope is intended to bound.
  const step = 1.0;
  const dist = buildLoadDistribution(inp.placements, inp.templates, ship, step);
  const xs = dist.map((d) => d.x);
  const q = dist.map((d) => d.q);
  const lcgCargo = cargoW > 0 ? cargoMx / cargoW : ship.lbp / 2;
  const b = buoyancyDistribution(cargoW, lcgCargo, ship, xs);
  const { sf, bm } = integrateSfBm(q, b, xs);

  // Convert SF (tonnes) → kN by × g (≈9.81), and BM (t·m) → kN·m
  const g = 9.80665;
  const sfKn = sf.map((v) => v * g);
  const bmKnm = bm.map((v) => v * g);

  const limTable: SfBmTable = SF_BM_LIMITS;
  const limRows: SfBmFrame[] = inp.condition === 'sea' ? limTable.atSea : limTable.atHarbour;
  const limAt = (x: number, key: keyof SfBmFrame): number => {
    if (x <= limRows[0].x) return limRows[0][key] as number;
    for (let i = 0; i < limRows.length - 1; i++) {
      const a = limRows[i];
      const c = limRows[i + 1];
      if (x >= a.x && x <= c.x) {
        const t = (x - a.x) / (c.x - a.x);
        return lerp(a[key] as number, c[key] as number, t);
      }
    }
    return limRows[limRows.length - 1][key] as number;
  };

  let sfUtil = 0;
  let bmUtil = 0;
  const sfArr: StabilityResult['shearForce'] = [];
  const bmArr: StabilityResult['bendingMoment'] = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const sfMin = limAt(x, 'sfMin');
    const sfMax = limAt(x, 'sfMax');
    const bmMin = limAt(x, 'bendMin');
    const bmMax = limAt(x, 'bendMax');
    sfArr.push({ x, sf: sfKn[i], sfMin, sfMax });
    bmArr.push({ x, bm: bmKnm[i], bmMin, bmMax });
    const u = sfKn[i] >= 0 ? sfKn[i] / sfMax : sfKn[i] / sfMin;
    const ub = bmKnm[i] >= 0 ? bmKnm[i] / bmMax : bmKnm[i] / bmMin;
    if (Number.isFinite(u) && u > sfUtil) sfUtil = u;
    if (Number.isFinite(ub) && ub > bmUtil) bmUtil = ub;
  }

  return {
    totalWeight: totalW,
    displacement: totalW,
    meanDraft,
    trim,
    draftAft,
    draftFwd,
    lcg,
    vcg,
    shearForce: sfArr,
    bendingMoment: bmArr,
    sfUtilization: sfUtil,
    bmUtilization: bmUtil,
  };
}

void HYDRO_TABLE;
export type { HydroRow };
