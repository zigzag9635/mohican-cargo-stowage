import { useStore } from '../store';
import { useT } from '../lib/i18n';

export function CargoList() {
  const templates = useStore((s) => s.templates);
  const placements = useStore((s) => s.placements);
  const removeTemplate = useStore((s) => s.removeTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const selectedTemplate = useStore((s) => s.selectedTemplate);
  const selectTemplate = useStore((s) => s.selectTemplate);
  const t = useT();

  return (
    <div className="section">
      <h2>{t.cargoParcels} ({templates.length})</h2>
      {templates.length === 0 && (
        <div className="empty">{t.noParcelsYet}</div>
      )}
      <div className="cargo-list">
        {templates.map((tpl) => {
          const placedCount = placements.filter((p) => p.templateId === tpl.id).length;
          const remaining = Math.max(0, tpl.quantity - placedCount);
          return (
            <div
              key={tpl.id}
              className={`cargo-item ${selectedTemplate === tpl.id ? 'selected' : ''}`}
              onClick={() => selectTemplate(tpl.id === selectedTemplate ? null : tpl.id)}
            >
              <span className="swatch" style={{ background: tpl.color || '#888' }} />
              <div>
                <div className="name">{tpl.name}</div>
                <div className="dims">
                  {t.parcelDimsLine(
                    tpl.length,
                    tpl.breadth,
                    tpl.height,
                    tpl.weight,
                    tpl.dischargePort,
                  )}
                </div>
                <div className="dims">
                  {t.parcelStackLine(
                    tpl.stackPolicy === 'stackable' ? `≤${tpl.maxStackTier}` : t.stackNo,
                    tpl.allowRotation ? t.yes : t.no,
                    tpl.tolerancePct,
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className="qty">
                  {placedCount}/{tpl.quantity}
                </span>
                <button
                  className="btn danger"
                  style={{ padding: '2px 6px', fontSize: 10 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t.confirmDeleteParcel(tpl.name))) removeTemplate(tpl.id);
                  }}
                >
                  {t.del}
                </button>
                <input
                  type="number"
                  step="1"
                  min={placedCount}
                  value={tpl.quantity}
                  onChange={(e) =>
                    updateTemplate(tpl.id, {
                      quantity: Math.max(placedCount, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 56,
                    background: '#0b1224',
                    color: '#e2e8f0',
                    border: '1px solid #334155',
                    borderRadius: 3,
                    padding: '2px 4px',
                    fontSize: 11,
                  }}
                  title={t.qtyTooltip(remaining)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
