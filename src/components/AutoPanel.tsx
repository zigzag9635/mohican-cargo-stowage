import { useState } from 'react';
import { useStore } from '../store';
import { autoDistribute, type DistributeMode } from '../lib/distribute';
import { HOLDS, holdById } from '../data/ship';
import { autoPackOneHold } from '../lib/packing';
import { SHIP } from '../data/ship';
import type { HoldId, PlacedPiece } from '../types';
import { useT } from '../lib/i18n';

export function AutoPanel() {
  const templates = useStore((s) => s.templates);
  const placements = useStore((s) => s.placements);
  const seawaterDensity = useStore((s) => s.seawaterDensity);
  const condition = useStore((s) => s.condition);
  const activeHold = useStore((s) => s.activeHold);
  const setActiveHold = useStore((s) => s.setActiveHold);
  const selectedTemplate = useStore((s) => s.selectedTemplate);
  const autoPack = useStore.getState().autoPack;
  const updateTemplate = useStore((s) => s.updateTemplate);
  const clearHold = useStore((s) => s.clearHold);
  const setPlacements = (newP: PlacedPiece[]) =>
    useStore.setState({ placements: newP });

  const [mode, setMode] = useState<'quantity' | 'meanDraft' | 'sternTrim'>('quantity');
  const [quantity, setQuantity] = useState(100);
  const [meanDraft, setMeanDraft] = useState(SHIP.summerDraft);
  const [sternTrim, setSternTrim] = useState(0.5);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string>('');
  const t = useT();

  function packCurrentHold() {
    const r = autoPack(activeHold);
    setResult(t.holdResult(activeHold, r.placed, r.unplaced));
  }

  function clearCurrentHold() {
    if (confirm(t.confirmClearHold(activeHold))) clearHold(activeHold);
  }

  function packAllHolds() {
    let total = 0;
    let working = placements.slice();
    // remaining quantity per template that still has to be packed across holds
    const remainingQty = new Map(templates.map((tpl) => [tpl.id, tpl.quantity]));
    for (const h of HOLDS) {
      working = working.filter((p) => p.holdId !== h.id);
      const tplsForThisHold = templates
        .map((tpl) => ({ ...tpl, quantity: remainingQty.get(tpl.id) ?? 0 }))
        .filter((tpl) => tpl.quantity > 0);
      if (tplsForThisHold.length === 0) continue;
      const result = autoPackOneHold(h, tplsForThisHold, SHIP.tankTopLoad);
      working.push(...result.placed);
      total += result.placed.length;
      // deduct placed counts per template
      for (const p of result.placed) {
        remainingQty.set(p.templateId, (remainingQty.get(p.templateId) ?? 0) - 1);
      }
    }
    setPlacements(working);
    setResult(t.allHoldsResult(total));
  }

  async function distribute() {
    const tpl = templates.find((tt) => tt.id === selectedTemplate) ?? templates[0];
    if (!tpl) {
      alert(t.addParcelFirst);
      return;
    }
    const m: DistributeMode =
      mode === 'quantity'
        ? { kind: 'quantity', quantity }
        : mode === 'meanDraft'
          ? { kind: 'meanDraft', meanDraft }
          : { kind: 'sternTrim', trim: sternTrim };
    setRunning(true);
    const res = autoDistribute({
      template: tpl,
      existingTemplates: templates.filter((tt) => tt.id !== tpl.id),
      existingPlacements: placements.filter((p) => p.templateId !== tpl.id),
      seawaterDensity,
      condition,
      mode: m,
    });
    setRunning(false);
    setResult(
      t.distributedParcel(
        tpl.name,
        res.byHold[1], res.byHold[2], res.byHold[3], res.byHold[4],
        res.totalPlaced, res.estTrim, res.estMeanDraft,
      ) + (res.feasible ? '' : t.feasibilityWarn),
    );
    // Update template quantity to reflect total recommended.
    updateTemplate(tpl.id, { quantity: res.totalPlaced });
    // Pack each hold individually with that template only — but we
    // need to respect the per-hold counts.  We do this by temporarily
    // placing pieces into each hold using a per-hold packer.
    const remainingByHold: Record<HoldId, number> = { ...res.byHold };
    const newPlacements: PlacedPiece[] = placements.filter((p) => p.templateId !== tpl.id);
    for (const h of HOLDS) {
      const wanted = remainingByHold[h.id];
      if (wanted <= 0) continue;
      const limited = { ...tpl, quantity: wanted };
      const hold = holdById(h.id);
      if (!hold) continue;
      const { placed } = autoPackOneHold(hold, [limited], SHIP.tankTopLoad);
      newPlacements.push(...placed);
    }
    setPlacements(newPlacements);
  }

  return (
    <div className="section">
      <h2>{t.autoLayout}</h2>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {HOLDS.map((h) => (
          <button
            key={h.id}
            className={`btn ${activeHold === h.id ? 'primary' : ''}`}
            onClick={() => setActiveHold(h.id)}
          >
            H{h.id}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={packCurrentHold}>
          {t.packHoldN(activeHold)}
        </button>
        <button className="btn" onClick={packAllHolds}>
          {t.packAllHolds}
        </button>
        <button className="btn danger" onClick={clearCurrentHold}>
          {t.clearHoldN(activeHold)}
        </button>
      </div>

      <h2 style={{ marginTop: 14 }}>{t.autoDistribute}</h2>
      <div className="empty" style={{ marginBottom: 6 }}>
        {t.selectedParcel}: {selectedTemplate ? templates.find((tt) => tt.id === selectedTemplate)?.name : t.useFirstParcel}
      </div>
      <div className="subtab">
        <button className={mode === 'quantity' ? 'active' : ''} onClick={() => setMode('quantity')}>
          {t.byQuantity}
        </button>
        <button className={mode === 'meanDraft' ? 'active' : ''} onClick={() => setMode('meanDraft')}>
          {t.byMeanDraft}
        </button>
        <button className={mode === 'sternTrim' ? 'active' : ''} onClick={() => setMode('sternTrim')}>
          {t.bySternTrim}
        </button>
      </div>
      {mode === 'quantity' && (
        <div className="field">
          <label>{t.quantityPcs}</label>
          <input
            type="number"
            step="1"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
          />
        </div>
      )}
      {mode === 'meanDraft' && (
        <div className="field">
          <label>{t.targetMeanDraft(SHIP.summerDraft)}</label>
          <input
            type="number"
            step="0.01"
            min="2.5"
            max={SHIP.summerDraft}
            value={meanDraft}
            onChange={(e) => setMeanDraft(parseFloat(e.target.value) || 0)}
          />
        </div>
      )}
      {mode === 'sternTrim' && (
        <div className="field">
          <label>{t.targetTrim}</label>
          <input
            type="number"
            step="0.01"
            value={sternTrim}
            onChange={(e) => setSternTrim(parseFloat(e.target.value) || 0)}
          />
        </div>
      )}
      <button className="btn primary" onClick={distribute} disabled={running}>
        {running ? t.calculating : t.distributeAndPack}
      </button>
      {result && (
        <div
          className="empty"
          style={{
            marginTop: 8,
            padding: '6px 8px',
            background: '#0b1224',
            border: '1px solid #334155',
            borderRadius: 3,
            fontStyle: 'normal',
            color: '#cbd5e1',
            fontSize: 11,
          }}
        >
          {result}
        </div>
      )}
    </div>
  );
}
