import { useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Text, Group } from 'react-konva';
import type Konva from 'konva';
import { useStore } from '../store';
import { holdById } from '../data/ship';
import type { CargoTemplate, PlacedPiece } from '../types';
import { freeFloorAreas } from '../lib/geometry';
import { fitsInHold, boxesOverlap, type Box3 } from '../lib/geometry';

interface Props {
  view: 'top' | 'side';
  colorMode: 'port' | 'shipper' | 'weight' | 'stack' | 'template';
}

const PADDING = 32;

export function HoldCanvas({ view, colorMode }: Props) {
  const activeHold = useStore((s) => s.activeHold);
  const placements = useStore((s) => s.placements);
  const templates = useStore((s) => s.templates);
  const updatePlacement = useStore((s) => s.updatePlacement);
  const removePlacement = useStore((s) => s.removePlacement);
  const selectedPlacement = useStore((s) => s.selectedPlacement);
  const selectPlacement = useStore((s) => s.selectPlacement);

  const hold = holdById(activeHold);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Listen for window resize so the canvas adapts.
  const [size, setSize] = useState({ w: 1100, h: 360 });
  useMemo(() => {
    function onResize() {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(600, r.width - 16), h: Math.max(260, r.height - 16) });
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!hold) return null;

  const tplMap = new Map(templates.map((t) => [t.id, t]));
  const placementsHere = placements.filter((p) => p.holdId === hold.id);

  // Map ship metres → screen pixels.
  // For both views, the horizontal axis is the hold length.
  // - top view: vertical = breadth
  // - side view: vertical = height
  const verticalSpan = view === 'top' ? hold.breadth : hold.height;
  const usableW = size.w - 2 * PADDING - 60; // leave room for ruler labels
  const usableH = size.h - 2 * PADDING - 30;
  const sx = usableW / hold.length;
  const sy = usableH / verticalSpan;
  const scale = Math.min(sx, sy);
  const offsetX = PADDING + 40;
  const offsetY = PADDING + 10;

  function toScreen(xMeters: number, yMeters: number): { x: number; y: number } {
    // Y axis: in side view "up" should mean larger height (z) → invert.
    if (view === 'top') {
      return { x: offsetX + xMeters * scale, y: offsetY + yMeters * scale };
    }
    return { x: offsetX + xMeters * scale, y: offsetY + (verticalSpan - yMeters) * scale };
  }

  function fromScreen(px: number, py: number): { x: number; y: number } {
    const xm = (px - offsetX) / scale;
    if (view === 'top') return { x: xm, y: (py - offsetY) / scale };
    return { x: xm, y: verticalSpan - (py - offsetY) / scale };
  }

  // Hold outline — accounting for notches.
  const outlineCorners: { x: number; y: number }[] = [];
  if (view === 'top') {
    outlineCorners.push({ x: 0, y: 0 });
    outlineCorners.push({ x: hold.length, y: 0 });
    outlineCorners.push({ x: hold.length, y: hold.breadth });
    outlineCorners.push({ x: 0, y: hold.breadth });
  } else {
    // Side view (z axis vertical): the hold has notches at the upper
    // fore and/or aft corners.  Build the outline polygon.
    const points: { x: number; y: number }[] = [];
    points.push({ x: 0, y: 0 });
    points.push({ x: hold.length, y: 0 });
    let topRight = hold.height;
    let topLeft = hold.height;
    const aft = hold.notches.find((n) => n.end === 'aft');
    const fore = hold.notches.find((n) => n.end === 'fore');
    if (fore) {
      points.push({ x: hold.length, y: hold.height - fore.height });
      points.push({ x: hold.length - fore.length, y: hold.height - fore.height });
      points.push({ x: hold.length - fore.length, y: hold.height });
      topRight = hold.height - fore.height;
      void topRight;
    } else {
      points.push({ x: hold.length, y: hold.height });
    }
    if (aft) {
      points.push({ x: aft.length, y: hold.height });
      points.push({ x: aft.length, y: hold.height - aft.height });
      points.push({ x: 0, y: hold.height - aft.height });
      topLeft = hold.height - aft.height;
      void topLeft;
    } else {
      points.push({ x: 0, y: hold.height });
    }
    outlineCorners.push(...points);
  }
  const outlinePts = outlineCorners.flatMap((p) => {
    const s = toScreen(p.x, p.y);
    return [s.x, s.y];
  });

  function colorOf(_piece: PlacedPiece, tpl: CargoTemplate | undefined): string {
    if (!tpl) return '#666';
    if (colorMode === 'template') return tpl.color ?? '#888';
    if (colorMode === 'port') return hashColor(tpl.dischargePort || '·');
    if (colorMode === 'shipper') return hashColor(tpl.shipper || '·');
    if (colorMode === 'stack') return tpl.stackPolicy === 'stackable' ? '#22c55e' : '#ef4444';
    if (colorMode === 'weight') {
      const t = Math.min(1, tpl.weight / 10);
      const r = Math.round(64 + 191 * t);
      const g = Math.round(192 - 128 * t);
      const b = Math.round(128 - 64 * t);
      return `rgb(${r},${g},${b})`;
    }
    return '#888';
  }

  // Compute free-area rectangles to display remaining space dimensions.
  const occupied: Box3[] = placementsHere.map((p) => {
    const tpl = tplMap.get(p.templateId);
    if (!tpl) return { x: p.x, y: p.y, z: p.z, l: 0, w: 0, h: 0 };
    const lDim = p.rotated ? tpl.breadth : tpl.length;
    const wDim = p.rotated ? tpl.length : tpl.breadth;
    return { x: p.x, y: p.y, z: p.z, l: lDim, w: wDim, h: tpl.height };
  });
  const freeRects = view === 'top' ? freeFloorAreas(hold, occupied) : [];

  // Drag handler — when a piece is moved, update placement.x/y or x/z.
  function handleDragEnd(p: PlacedPiece, evt: Konva.KonvaEventObject<DragEvent>) {
    if (!hold) return;
    const node = evt.target;
    const screen = node.getAbsolutePosition();
    const local = fromScreen(screen.x, screen.y);
    const tpl = tplMap.get(p.templateId);
    if (!tpl) return;
    const lDim = p.rotated ? tpl.breadth : tpl.length;
    const wDim = p.rotated ? tpl.length : tpl.breadth;

    let newX = p.x;
    let newY = p.y;
    let newZ = p.z;
    if (view === 'top') {
      newX = clamp(local.x, 0, hold.length - lDim);
      newY = clamp(local.y, 0, hold.breadth - wDim);
    } else {
      newX = clamp(local.x, 0, hold.length - lDim);
      newZ = clamp(local.y, 0, hold.height - tpl.height);
    }
    const origTl = toScreen(
      p.x,
      view === 'top' ? p.y : p.z + tpl.height,
    );
    const trial: Box3 = { x: newX, y: newY, z: newZ, l: lDim, w: wDim, h: tpl.height };
    if (!fitsInHold(trial, hold)) {
      node.position({ x: origTl.x, y: origTl.y });
      return;
    }
    const others: Box3[] = placementsHere
      .filter((q) => q.id !== p.id)
      .map((q) => {
        const t = tplMap.get(q.templateId);
        if (!t) return { x: q.x, y: q.y, z: q.z, l: 0, w: 0, h: 0 };
        const dl = q.rotated ? t.breadth : t.length;
        const dw = q.rotated ? t.length : t.breadth;
        return { x: q.x, y: q.y, z: q.z, l: dl, w: dw, h: t.height };
      });
    if (others.some((b) => boxesOverlap(trial, b))) {
      node.position({ x: origTl.x, y: origTl.y });
      return;
    }
    updatePlacement(p.id, { x: newX, y: newY, z: newZ });
    const newTl = toScreen(
      newX,
      view === 'top' ? newY : newZ + tpl.height,
    );
    node.position({ x: newTl.x, y: newTl.y });
  }

  // Background grid lines (every 1 m and labelled every 5 m)
  const grid: { x1: number; y1: number; x2: number; y2: number; label?: string; lx?: number; ly?: number }[] = [];
  const drawGrid = () => {
    for (let m = 0; m <= hold.length; m += 1) {
      const start = toScreen(m, 0);
      const end = toScreen(m, verticalSpan);
      grid.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y, label: m % 5 === 0 ? `${m}` : '', lx: start.x, ly: end.y + 4 });
    }
    for (let m = 0; m <= verticalSpan; m += 1) {
      const start = toScreen(0, m);
      const end = toScreen(hold.length, m);
      const yLabel = view === 'top' ? `${m}` : `${m}`;
      grid.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y, label: m % 1 === 0 ? yLabel : '', lx: start.x - 16, ly: start.y - 5 });
    }
  };
  drawGrid();

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <Stage width={size.w} height={size.h}>
        <Layer>
          {/* grid */}
          {grid.map((g, i) => (
            <Line key={`g${i}`} points={[g.x1, g.y1, g.x2, g.y2]} stroke="#1e2a44" strokeWidth={0.5} />
          ))}
          {grid
            .filter((g) => g.label)
            .map((g, i) =>
              g.lx !== undefined && g.ly !== undefined ? (
                <Text
                  key={`gl${i}`}
                  x={g.lx}
                  y={g.ly}
                  text={g.label!}
                  fill="#475569"
                  fontSize={9}
                />
              ) : null,
            )}
          {/* hold outline */}
          <Line points={outlinePts} closed stroke="#94a3b8" strokeWidth={2} fill="#0f1a30" />
          {/* free-space rectangles + dimension labels */}
          {freeRects.map((r, i) => {
            const tl = toScreen(r.x, r.y);
            return (
              <Group key={`fr${i}`}>
                <Rect
                  x={tl.x}
                  y={tl.y}
                  width={r.l * scale}
                  height={r.w * scale}
                  fill="#0c1a3522"
                  stroke="#22c55e44"
                  dash={[2, 3]}
                />
                <Text
                  x={tl.x + 4}
                  y={tl.y + 4}
                  text={`${r.l.toFixed(2)} × ${r.w.toFixed(2)} m`}
                  fontSize={10}
                  fill="#22c55e"
                />
              </Group>
            );
          })}

          {/* placed pieces */}
          {placementsHere.map((p) => {
            const tpl = tplMap.get(p.templateId);
            if (!tpl) return null;
            const lDim = p.rotated ? tpl.breadth : tpl.length;
            const wDim = p.rotated ? tpl.length : tpl.breadth;
            // Top view: rectangle from (p.x, p.y) of size (lDim, wDim).
            // Side view: rectangle from (p.x, p.z) of size (lDim, tpl.height).
            // Side view shows ALL tiers of pieces stacked at this (x, z).
            const rx = p.x;
            const ry = view === 'top' ? p.y : p.z;
            const rw = lDim;
            const rh = view === 'top' ? wDim : tpl.height;
            const tl = toScreen(rx, view === 'top' ? ry : ry + rh);
            const widthPx = rw * scale;
            const heightPx = rh * scale;
            const fill = colorOf(p, tpl);
            const isSelected = selectedPlacement === p.id;
            return (
              <Group
                key={p.id}
                x={tl.x}
                y={tl.y}
                draggable
                onDragEnd={(e) => handleDragEnd(p, e)}
                onClick={() => selectPlacement(p.id)}
                onTap={() => selectPlacement(p.id)}
                onDblClick={() => removePlacement(p.id)}
              >
                <Rect
                  width={widthPx}
                  height={heightPx}
                  fill={fill}
                  opacity={view === 'side' ? (p.tier === 0 ? 0.85 : 0.55) : 0.85}
                  stroke={isSelected ? '#fff' : '#0b1224'}
                  strokeWidth={isSelected ? 2 : 1}
                  cornerRadius={2}
                />
                {widthPx > 35 && heightPx > 14 && (
                  <Text
                    x={4}
                    y={4}
                    text={`${tpl.name}`}
                    fontSize={10}
                    fill="#fff"
                    width={widthPx - 8}
                    ellipsis
                    listening={false}
                  />
                )}
                {widthPx > 60 && heightPx > 26 && (
                  <Text
                    x={4}
                    y={16}
                    text={`${rw.toFixed(2)}×${rh.toFixed(2)}m  ${tpl.weight}t`}
                    fontSize={9}
                    fill="#e2e8f0"
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

          {/* axis labels */}
          <Text x={offsetX} y={size.h - 18} text="X (length, m) →" fill="#94a3b8" fontSize={11} />
          <Text
            x={4}
            y={offsetY - 4}
            text={view === 'top' ? '↓ Y (breadth, m)' : '↑ Z (height, m)'}
            fill="#94a3b8"
            fontSize={11}
          />
          <Text
            x={size.w - 200}
            y={size.h - 18}
            text={`${hold.name}  ${hold.length}×${hold.breadth}×${hold.height} m`}
            fill="#94a3b8"
            fontSize={11}
          />
        </Layer>
      </Stage>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}


