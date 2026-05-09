import { useMemo } from 'react';
import { useStore } from '../store';
import { HOLDS, SHIP } from '../data/ship';
import { computeHoldLoads, computeStability } from '../lib/stability';

export function LeftPane() {
  const placements = useStore((s) => s.placements);
  const templates = useStore((s) => s.templates);
  const seawaterDensity = useStore((s) => s.seawaterDensity);
  const condition = useStore((s) => s.condition);
  const setDensity = useStore((s) => s.setDensity);
  const setCondition = useStore((s) => s.setCondition);
  const voyage = useStore((s) => s.voyage);
  const notes = useStore((s) => s.notes);
  const setVoyage = useStore((s) => s.setVoyage);
  const setNotes = useStore((s) => s.setNotes);

  const loads = useMemo(
    () => computeHoldLoads(placements, templates),
    [placements, templates],
  );
  const stability = useMemo(
    () =>
      computeStability({
        placements,
        templates,
        seawaterDensity,
        condition,
      }),
    [placements, templates, seawaterDensity, condition],
  );

  const totalCargoW = loads.reduce((s, l) => s + l.weight, 0);
  const totalCargoPieces = loads.reduce((s, l) => s + l.pieces, 0);

  return (
    <aside className="left-pane">
      <div className="section">
        <h2>Voyage</h2>
        <div className="field">
          <label>Voyage / reference</label>
          <input
            type="text"
            value={voyage}
            onChange={(e) => setVoyage(e.target.value)}
            placeholder="e.g. 24 / Hamburg → St-Petersburg"
          />
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="section">
        <h2>Conditions</h2>
        <div className="field">
          <label>Sea water density (t/m³)</label>
          <input
            type="number"
            step="0.001"
            min="0.95"
            max="1.05"
            value={seawaterDensity}
            onChange={(e) => setDensity(parseFloat(e.target.value) || SHIP.defaultSeawaterDensity)}
          />
        </div>
        <div className="subtab">
          <button
            className={condition === 'sea' ? 'active' : ''}
            onClick={() => setCondition('sea')}
          >
            At sea
          </button>
          <button
            className={condition === 'harbour' ? 'active' : ''}
            onClick={() => setCondition('harbour')}
          >
            In harbour
          </button>
        </div>
      </div>

      <div className="section">
        <h2>Ship summary</h2>
        <div className="metric">
          <span className="label">Cargo total</span>
          <span className="value">
            {totalCargoPieces} pcs · {totalCargoW.toFixed(1)} t
          </span>
        </div>
        <div className="metric">
          <span className="label">Total displacement</span>
          <span className="value">{stability.displacement.toFixed(1)} t</span>
        </div>
        <div className="metric">
          <span className="label">Mean draft</span>
          <span className="value">{stability.meanDraft.toFixed(3)} m</span>
        </div>
        <div className="metric">
          <span className="label">Trim (− = bow / + = stern)</span>
          <span className={`value ${Math.abs(stability.trim) > 0.5 ? 'warn' : ''}`}>
            {stability.trim >= 0 ? '+' : ''}
            {stability.trim.toFixed(3)} m
          </span>
        </div>
        <div className="metric">
          <span className="label">Draft FP / AP</span>
          <span className="value">
            {stability.draftFwd.toFixed(2)} / {stability.draftAft.toFixed(2)} m
          </span>
        </div>
        <div className="metric">
          <span className="label">LCG</span>
          <span className="value">{stability.lcg.toFixed(2)} m</span>
        </div>
        <div className="metric">
          <span className="label">VCG</span>
          <span className="value">{stability.vcg.toFixed(2)} m</span>
        </div>
      </div>

      <div className="section">
        <h2>Strength check ({condition})</h2>
        <UtilBar label="Shear force (SF)" value={stability.sfUtilization} />
        <UtilBar label="Bending moment (BM)" value={stability.bmUtilization} />
      </div>

      <div className="section">
        <h2>Holds</h2>
        {HOLDS.map((h) => {
          const l = loads.find((x) => x.holdId === h.id)!;
          const ratio = l.weight / h.maxWeight;
          const tankUtil = l.maxTankTopLoad / SHIP.tankTopLoad;
          return (
            <div key={h.id} style={{ marginBottom: 8 }}>
              <div className="metric">
                <span className="label">{h.name}</span>
                <span className="value">
                  {l.pieces} pcs · {l.weight.toFixed(1)} t
                </span>
              </div>
              <div className="bar">
                <div
                  className={`fill ${ratio > 1 ? 'bad' : ratio > 0.9 ? 'warn' : ''}`}
                  style={{ transform: `scaleX(${Math.min(1.05, ratio)})` }}
                />
              </div>
              <div className="metric" style={{ fontSize: 10, marginTop: 2 }}>
                <span className="label">
                  Max tank-top: {l.maxTankTopLoad.toFixed(2)} t/m² (limit {SHIP.tankTopLoad} t/m²)
                </span>
                <span className={`value ${tankUtil > 1 ? 'bad' : tankUtil > 0.9 ? 'warn' : 'good'}`}>
                  {(tankUtil * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function UtilBar({ label, value }: { label: string; value: number }) {
  const pct = Math.abs(value) * 100;
  const cls = pct > 100 ? 'bad' : pct > 85 ? 'warn' : '';
  return (
    <div style={{ marginBottom: 6 }}>
      <div className="metric" style={{ marginBottom: 2 }}>
        <span className="label">{label}</span>
        <span className={`value ${cls === 'bad' ? 'bad' : cls === 'warn' ? 'warn' : 'good'}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="bar">
        <div
          className={`fill ${cls}`}
          style={{ transform: `scaleX(${Math.min(1.05, pct / 100)})` }}
        />
      </div>
    </div>
  );
}
