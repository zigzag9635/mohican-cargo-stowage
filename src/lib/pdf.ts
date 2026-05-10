import { jsPDF } from 'jspdf';
import type {
  CargoTemplate,
  HoldGeometry,
  PlacedPiece,
  StowagePlan,
} from '../types';
import { HOLDS, SHIP } from '../data/ship';
import { computeHoldLoads, computeStability } from './stability';

const A4 = { w: 297, h: 210 }; // landscape, mm
const MARGIN = 10;

export async function exportPlanToPdf(plan: StowagePlan): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Cover / summary page
  drawSummaryPage(doc, plan);

  for (const h of HOLDS) {
    doc.addPage();
    drawHoldPage(doc, plan, h);
  }

  return doc.output('arraybuffer');
}

function drawSummaryPage(doc: jsPDF, plan: StowagePlan) {
  let y = MARGIN;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${plan.shipName} — Cargo Stowage Plan`, MARGIN, y + 6);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Voyage: ${plan.voyage || '—'}`, MARGIN, y);
  doc.text(`Created: ${plan.createdAt.replace('T', ' ').slice(0, 16)}`, A4.w - MARGIN - 60, y);
  y += 5;
  doc.text(`Sea-water density: ${plan.seawaterDensity.toFixed(3)} t/m³`, MARGIN, y);
  y += 6;

  // Stability and load summary
  const loads = computeHoldLoads(plan.placements, plan.templates);
  const stab = computeStability({
    placements: plan.placements,
    templates: plan.templates,
    seawaterDensity: plan.seawaterDensity,
    condition: 'sea',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Stability summary', MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const summary = [
    [`Total cargo`, `${loads.reduce((s, l) => s + l.pieces, 0)} pcs / ${loads.reduce((s, l) => s + l.weight, 0).toFixed(1)} t`],
    [`Displacement`, `${stab.displacement.toFixed(1)} t`],
    [`Mean draft`, `${stab.meanDraft.toFixed(3)} m`],
    [`Trim (+ stern)`, `${stab.trim >= 0 ? '+' : ''}${stab.trim.toFixed(3)} m`],
    [`Draft FP / AP`, `${stab.draftFwd.toFixed(2)} / ${stab.draftAft.toFixed(2)} m`],
    [`LCG / VCG`, `${stab.lcg.toFixed(2)} / ${stab.vcg.toFixed(2)} m`],
    [`SF utilisation`, `${(stab.sfUtilization * 100).toFixed(0)} %`],
    [`BM utilisation`, `${(stab.bmUtilization * 100).toFixed(0)} %`],
  ];
  for (const [k, v] of summary) {
    doc.text(k, MARGIN, y);
    doc.text(v, MARGIN + 70, y);
    y += 4;
  }

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Hold loading', MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Hold', MARGIN, y);
  doc.text('Pieces', MARGIN + 35, y);
  doc.text('Weight, t', MARGIN + 60, y);
  doc.text('% of max', MARGIN + 85, y);
  doc.text('LCG, m', MARGIN + 110, y);
  doc.text('VCG, m', MARGIN + 130, y);
  doc.text('Tank-top max, t/m²', MARGIN + 150, y);
  y += 4;
  doc.setLineWidth(0.1);
  doc.line(MARGIN, y - 1, A4.w - MARGIN, y - 1);
  for (const l of loads) {
    const h = HOLDS.find((x) => x.id === l.holdId)!;
    doc.text(h.name, MARGIN, y);
    doc.text(`${l.pieces}`, MARGIN + 35, y);
    doc.text(l.weight.toFixed(1), MARGIN + 60, y);
    doc.text(`${((l.weight / h.maxWeight) * 100).toFixed(0)} %`, MARGIN + 85, y);
    doc.text(l.lcg.toFixed(2), MARGIN + 110, y);
    doc.text(l.vcg.toFixed(2), MARGIN + 130, y);
    doc.text(l.maxTankTopLoad.toFixed(2), MARGIN + 150, y);
    y += 4;
  }

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Cargo parcels', MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Parcel', MARGIN, y);
  doc.text('L×W×H, m', MARGIN + 60, y);
  doc.text('Wt, t', MARGIN + 95, y);
  doc.text('Qty', MARGIN + 110, y);
  doc.text('Stack', MARGIN + 125, y);
  doc.text('Rot', MARGIN + 140, y);
  doc.text('Tol, %', MARGIN + 155, y);
  doc.text('Port', MARGIN + 175, y);
  doc.text('Shipper', MARGIN + 220, y);
  y += 4;
  doc.line(MARGIN, y - 1, A4.w - MARGIN, y - 1);
  for (const t of plan.templates) {
    if (y > A4.h - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(t.name, MARGIN, y, { maxWidth: 55 });
    doc.text(`${t.length}×${t.breadth}×${t.height}`, MARGIN + 60, y);
    doc.text(t.weight.toString(), MARGIN + 95, y);
    doc.text(t.quantity.toString(), MARGIN + 110, y);
    doc.text(
      t.stackPolicy === 'stackable' ? `≤${t.maxStackTier}` : '—',
      MARGIN + 125,
      y,
    );
    doc.text(t.allowRotation ? 'Y' : 'N', MARGIN + 140, y);
    doc.text(t.tolerancePct.toFixed(1), MARGIN + 155, y);
    doc.text(t.dischargePort || '', MARGIN + 175, y);
    doc.text(t.shipper || '', MARGIN + 220, y);
    y += 4;
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Limits used: max hold weight ${SHIP.maxHoldWeight} t · tank-top ${SHIP.tankTopLoad} t/m² · LBP ${SHIP.lbp} m · summer T ${SHIP.summerDraft} m`,
    MARGIN,
    A4.h - MARGIN,
  );
}

function drawHoldPage(doc: jsPDF, plan: StowagePlan, hold: HoldGeometry) {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`${hold.name}`, MARGIN, MARGIN + 4);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Internal envelope: ${hold.length} × ${hold.breadth} × ${hold.height} m, max load ${hold.maxWeight} t`,
    MARGIN,
    MARGIN + 10,
  );

  const placements = plan.placements.filter((p) => p.holdId === hold.id);
  const tplMap = new Map(plan.templates.map((t) => [t.id, t]));

  // top view
  drawHoldView(doc, hold, placements, tplMap, 'top', MARGIN, MARGIN + 18, A4.w - 2 * MARGIN, 80);
  // side view
  drawHoldView(doc, hold, placements, tplMap, 'side', MARGIN, MARGIN + 105, A4.w - 2 * MARGIN, 60);

  // legend / piece list
  const y = MARGIN + 170;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    `Pieces in this hold: ${placements.length} (weight ${placements.reduce((s, p) => {
      const t = tplMap.get(p.templateId);
      return s + (t ? t.weight : 0);
    }, 0).toFixed(1)} t)`,
    MARGIN,
    y,
  );
}

function drawHoldView(
  doc: jsPDF,
  hold: HoldGeometry,
  placements: PlacedPiece[],
  tplMap: Map<string, CargoTemplate>,
  view: 'top' | 'side',
  x0: number,
  y0: number,
  w: number,
  h: number,
) {
  const verticalSpan = view === 'top' ? hold.breadth : hold.height;
  const sx = (w - 12) / hold.length;
  const sy = (h - 6) / verticalSpan;
  const scale = Math.min(sx, sy);
  const ox = x0 + 6;
  const oy = y0 + 4;

  function toScreen(xm: number, ym: number) {
    if (view === 'top') return { x: ox + xm * scale, y: oy + ym * scale };
    return { x: ox + xm * scale, y: oy + (verticalSpan - ym) * scale };
  }

  // outline
  doc.setLineWidth(0.4);
  doc.setDrawColor(0);
  if (view === 'top') {
    const a = toScreen(0, 0);
    doc.rect(a.x, a.y, hold.length * scale, hold.breadth * scale);
  } else {
    const corners: { x: number; y: number }[] = [];
    corners.push({ x: 0, y: 0 });
    corners.push({ x: hold.length, y: 0 });
    const fore = hold.notches.find((n) => n.end === 'fore');
    const aft = hold.notches.find((n) => n.end === 'aft');
    if (fore) {
      corners.push({ x: hold.length, y: hold.height - fore.height });
      corners.push({ x: hold.length - fore.length, y: hold.height - fore.height });
      corners.push({ x: hold.length - fore.length, y: hold.height });
    } else corners.push({ x: hold.length, y: hold.height });
    if (aft) {
      corners.push({ x: aft.length, y: hold.height });
      corners.push({ x: aft.length, y: hold.height - aft.height });
      corners.push({ x: 0, y: hold.height - aft.height });
    } else corners.push({ x: 0, y: hold.height });
    for (let i = 0; i < corners.length; i++) {
      const a = toScreen(corners[i].x, corners[i].y);
      const b = toScreen(corners[(i + 1) % corners.length].x, corners[(i + 1) % corners.length].y);
      doc.line(a.x, a.y, b.x, b.y);
    }
  }

  // Pieces
  for (const p of placements) {
    const t = tplMap.get(p.templateId);
    if (!t) continue;
    const lDim = p.rotated ? t.breadth : t.length;
    const wDim = p.rotated ? t.length : t.breadth;
    const hDim = t.height;
    let rx, ry, rw, rh;
    if (view === 'top') {
      rx = p.x;
      ry = p.y;
      rw = lDim;
      rh = wDim;
    } else {
      rx = p.x;
      ry = p.z + hDim;
      rw = lDim;
      rh = hDim;
    }
    const tl = toScreen(rx, ry);
    const color = hexToRgb(t.color || '#888888');
    doc.setFillColor(color.r, color.g, color.b);
    doc.setDrawColor(0);
    doc.rect(tl.x, tl.y, rw * scale, rh * scale, 'FD');
  }

  // axis labels
  doc.setFontSize(7);
  doc.setTextColor(80);
  doc.text(
    `${view.toUpperCase()} VIEW · X (length) · ${view === 'top' ? 'Y (breadth)' : 'Z (height)'}`,
    x0 + 2,
    oy + (view === 'top' ? hold.breadth : hold.height) * scale + 4,
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  if (m.startsWith('hsl')) return { r: 100, g: 100, b: 100 };
  const i = parseInt(m, 16);
  if (Number.isNaN(i)) return { r: 100, g: 100, b: 100 };
  return { r: (i >> 16) & 0xff, g: (i >> 8) & 0xff, b: i & 0xff };
}

