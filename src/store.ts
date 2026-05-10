import { create } from 'zustand';
import type {
  CargoTemplate,
  HoldId,
  PlacedPiece,
  StowagePlan,
} from './types';
import { SHIP, holdById } from './data/ship';
import { autoPackOneHold } from './lib/packing';

interface StoreState {
  voyage: string;
  notes: string;
  seawaterDensity: number;
  condition: 'sea' | 'harbour';
  templates: CargoTemplate[];
  placements: PlacedPiece[];
  selectedTemplate: string | null;
  selectedPlacement: string | null;
  /** template currently being edited in CargoForm; null → "add new" mode */
  editingTemplate: string | null;
  activeHold: HoldId;

  setVoyage: (v: string) => void;
  setNotes: (n: string) => void;
  setDensity: (d: number) => void;
  setCondition: (c: 'sea' | 'harbour') => void;
  setActiveHold: (h: HoldId) => void;
  selectTemplate: (id: string | null) => void;
  selectPlacement: (id: string | null) => void;
  setEditingTemplate: (id: string | null) => void;

  addTemplate: (t: CargoTemplate) => void;
  updateTemplate: (id: string, patch: Partial<CargoTemplate>) => void;
  removeTemplate: (id: string) => void;

  addPlacement: (p: PlacedPiece) => void;
  updatePlacement: (id: string, patch: Partial<PlacedPiece>) => void;
  removePlacement: (id: string) => void;
  clearHold: (id: HoldId) => void;

  autoPack: (holdId: HoldId) => { placed: number; unplaced: number };

  loadPlan: (plan: StowagePlan) => void;
  exportPlan: () => StowagePlan;
  newPlan: () => void;
}

const PALETTE = [
  '#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#0EA5E9',
];

let _colorIdx = 0;
function nextColor(): string {
  const c = PALETTE[_colorIdx % PALETTE.length];
  _colorIdx += 1;
  return c;
}

export function makeId(prefix = 't'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useStore = create<StoreState>((set, get) => ({
  voyage: '',
  notes: '',
  seawaterDensity: SHIP.defaultSeawaterDensity,
  condition: 'sea',
  templates: [],
  placements: [],
  selectedTemplate: null,
  selectedPlacement: null,
  editingTemplate: null,
  activeHold: 1,

  setVoyage: (v) => set({ voyage: v }),
  setNotes: (n) => set({ notes: n }),
  setDensity: (d) => set({ seawaterDensity: d }),
  setCondition: (c) => set({ condition: c }),
  setActiveHold: (h) => set({ activeHold: h }),
  selectTemplate: (id) => set({ selectedTemplate: id }),
  selectPlacement: (id) => set({ selectedPlacement: id }),
  setEditingTemplate: (id) => set({ editingTemplate: id }),

  addTemplate: (t) =>
    set((s) => ({
      templates: [...s.templates, { ...t, color: t.color ?? nextColor() }],
      selectedTemplate: t.id,
    })),
  updateTemplate: (id, patch) =>
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  removeTemplate: (id) =>
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== id),
      placements: s.placements.filter((p) => p.templateId !== id),
      selectedTemplate: s.selectedTemplate === id ? null : s.selectedTemplate,
      editingTemplate: s.editingTemplate === id ? null : s.editingTemplate,
    })),

  addPlacement: (p) => set((s) => ({ placements: [...s.placements, p] })),
  updatePlacement: (id, patch) =>
    set((s) => ({
      placements: s.placements.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  removePlacement: (id) =>
    set((s) => ({
      placements: s.placements.filter((p) => p.id !== id),
      selectedPlacement: s.selectedPlacement === id ? null : s.selectedPlacement,
    })),
  clearHold: (id) =>
    set((s) => ({ placements: s.placements.filter((p) => p.holdId !== id) })),

  autoPack: (holdId) => {
    const { templates, placements } = get();
    // remove existing placements in this hold first
    const remaining = placements.filter((p) => p.holdId !== holdId);
    const hold = holdById(holdId);
    if (!hold) return { placed: 0, unplaced: 0 };
    // count already-placed quantities in OTHER holds — we don't deduct
    // those here, the user's templates carry the parcel size.  We trust
    // the operator to set quantity correctly.  We simply pack as many
    // pieces as fit.
    const { placed } = autoPackOneHold(hold, templates, SHIP.tankTopLoad);
    set({ placements: [...remaining, ...placed] });
    const requested = templates.reduce((s, t) => s + t.quantity, 0);
    return { placed: placed.length, unplaced: Math.max(0, requested - placed.length) };
  },

  loadPlan: (plan) =>
    set({
      voyage: plan.voyage,
      notes: plan.notes,
      seawaterDensity: plan.seawaterDensity,
      templates: plan.templates,
      placements: plan.placements,
      selectedTemplate: null,
      selectedPlacement: null,
      editingTemplate: null,
    }),
  exportPlan: () => {
    const s = get();
    const plan: StowagePlan = {
      schemaVersion: 1,
      shipName: SHIP.name,
      voyage: s.voyage,
      notes: s.notes,
      seawaterDensity: s.seawaterDensity,
      templates: s.templates,
      placements: s.placements,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return plan;
  },
  newPlan: () =>
    set({
      voyage: '',
      notes: '',
      seawaterDensity: SHIP.defaultSeawaterDensity,
      condition: 'sea',
      templates: [],
      placements: [],
      selectedTemplate: null,
      selectedPlacement: null,
      editingTemplate: null,
      activeHold: 1,
    }),
}));
