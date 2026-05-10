# M/V Mohican — Cargo Stowage Planner

Desktop application for planning the stowage of general cargo in the four
holds of the general-cargo / bulk-carrier **M/V Mohican** (9 400 DWT).
Designed to run **offline on Windows 11** on the bridge.

## Features

- Dedicated geometric model of the four cargo holds, including the
  upper-corner notches at the fore/aft ends.
- Manual entry of cargo parcels (length × breadth × height, weight,
  quantity, port of discharge, shipper, dimensional tolerance, rotation
  permission, stacking permission, max stacking tier).
- 2D top + side views per hold with **drag-and-drop** placement, free-
  space dimensioning and colour coding by parcel / port / shipper /
  weight / stackability.
- Bottom-Left-Fill auto packer per hold, plus an "auto-distribute"
  optimiser that allocates a parcel across all four holds for a target
  quantity, target mean draft or target stern trim while honouring
  `max hold weight = 2 900 t`, `tank-top load = 8.66 t/m²`, the
  shear-force / bending-moment limits from the Bulk Cargo Loading
  Manual and the user's chosen sea-water density.
- Real-time stability dashboard: total displacement, mean draft, draft
  fwd / aft, trim, LCG, VCG, SF and BM utilisation per condition (sea
  passage / harbour).
- JSON save / open of plans and PDF export of the full plan (cover
  summary + per-hold top + side views).

## Data sources

All ship constants are baked into [`src/data/ship.ts`](src/data/ship.ts)
and digested from the documents supplied by the master:

- `135B.100.001.Aa-General+Arrangement.pdf`
- `135.152.107.B-Bulk+Cargo+Loading+Manual-BV.pdf` (principal
  particulars, hold capacity table, SF/BM still-water limits,
  hydrostatics)
- `135.152.001.Da-Tank+Capacity+Plan.pdf`
- `135.152.101.Fa-Intact+Stability+Booklet-BV.pdf`

Hold internal dimensions and the upper-corner notches were measured
on board and entered by the master:

| Hold | L × B × H, m   | Notches at upper corners (1.30 m long × 1.75 m high) |
| ---- | -------------- | ---------------------------------------------------- |
| 1    | 26.0 × 13.4 × 9.5 | aft only                                          |
| 2    | 27.3 × 13.4 × 9.5 | both ends                                         |
| 3    | 27.3 × 13.4 × 9.5 | both ends                                         |
| 4    | 26.0 × 13.4 × 9.5 | fore only                                         |

## Getting started (development)

```bash
npm install
npm run dev          # Vite dev server + Electron with HMR
```

## Building the Windows installer

On a Windows machine (or with Wine on Linux):

```bash
npm install
npm run electron:build:win
```

The NSIS installer and the portable `.exe` will be written to
`release/`.  Both are self-contained and require **no internet
connection** to run.

## Project layout

```
electron/
  main.ts          # Electron main process (windows, menus, file dialogs)
  preload.ts       # IPC bridge exposed to the renderer as window.api
src/
  App.tsx
  store.ts         # Zustand store (plan + selection + active hold)
  data/ship.ts     # Mohican constants
  lib/
    geometry.ts    # Hold geometry helpers (notches, free-area scan)
    packing.ts     # Bottom-Left-Fill packer with rotation / stacking
    stability.ts   # LCG / VCG / trim / draft / SF / BM
    distribute.ts  # Auto-distribute across holds (qty / draft / trim)
    pdf.ts         # PDF export
  components/
    Toolbar.tsx
    LeftPane.tsx
    RightPane.tsx
    HoldTabs.tsx
    HoldCanvas.tsx
    CargoForm.tsx
    CargoList.tsx
    AutoPanel.tsx
```

## Limits applied by the planner

- Hold maximum weight: **2 900 t** each (Bulk Cargo Loading Manual,
  §1.6).
- Allowable tank-top load: **8.664 t/m²** (≡ 85 kN/m²).
- Still-water shear force: **±16 350 kN** along the ship.
- Still-water bending moment: piecewise from the SF/BM table in §1.7,
  selectable per condition (at sea / at harbour).
- Light-ship mass and LCG are first-cut estimates that the operator can
  refine in [`src/data/ship.ts`](src/data/ship.ts) once the official
  light-ship report is to hand.

## License

MIT.  Provided "as is" — always cross-check the resulting plan against
the master's own stability and strength calculations before loading.
