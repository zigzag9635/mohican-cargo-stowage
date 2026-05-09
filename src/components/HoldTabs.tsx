import { useStore } from '../store';
import { HOLDS } from '../data/ship';
import { computeHoldLoads } from '../lib/stability';
import { useT } from '../lib/i18n';

export function HoldTabs() {
  const activeHold = useStore((s) => s.activeHold);
  const setActiveHold = useStore((s) => s.setActiveHold);
  const placements = useStore((s) => s.placements);
  const templates = useStore((s) => s.templates);
  const loads = computeHoldLoads(placements, templates);
  const t = useT();

  return (
    <div className="hold-tabs">
      {HOLDS.map((h) => {
        const l = loads.find((x) => x.holdId === h.id)!;
        const ratio = l.weight / h.maxWeight;
        return (
          <button
            key={h.id}
            className={`hold-tab ${activeHold === h.id ? 'active' : ''}`}
            onClick={() => setActiveHold(h.id)}
          >
            <strong>{h.name}</strong>
            <span className="stat">
              {l.pieces} {t.pcs} · {l.weight.toFixed(1)} t · {(ratio * 100).toFixed(0)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
