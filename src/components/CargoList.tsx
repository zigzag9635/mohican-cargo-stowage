import { useStore } from '../store';

export function CargoList() {
  const templates = useStore((s) => s.templates);
  const placements = useStore((s) => s.placements);
  const removeTemplate = useStore((s) => s.removeTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const selectedTemplate = useStore((s) => s.selectedTemplate);
  const selectTemplate = useStore((s) => s.selectTemplate);

  return (
    <div className="section">
      <h2>Cargo parcels ({templates.length})</h2>
      {templates.length === 0 && (
        <div className="empty">No parcels yet. Use the form below to add one.</div>
      )}
      <div className="cargo-list">
        {templates.map((t) => {
          const placedCount = placements.filter((p) => p.templateId === t.id).length;
          const remaining = Math.max(0, t.quantity - placedCount);
          return (
            <div
              key={t.id}
              className={`cargo-item ${selectedTemplate === t.id ? 'selected' : ''}`}
              onClick={() => selectTemplate(t.id === selectedTemplate ? null : t.id)}
            >
              <span className="swatch" style={{ background: t.color || '#888' }} />
              <div>
                <div className="name">{t.name}</div>
                <div className="dims">
                  {t.length}×{t.breadth}×{t.height} m · {t.weight} t · port {t.dischargePort || '—'}
                </div>
                <div className="dims">
                  Stack: {t.stackPolicy === 'stackable' ? `≤${t.maxStackTier}` : 'no'}
                  {' · '}Rot: {t.allowRotation ? 'Y' : 'N'}
                  {' · '}Tol: {t.tolerancePct}%
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className="qty">
                  {placedCount}/{t.quantity}
                </span>
                <button
                  className="btn danger"
                  style={{ padding: '2px 6px', fontSize: 10 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      confirm(
                        `Удалить партию «${t.name}» вместе со всеми размещёнными местами в трюмах?`,
                      )
                    )
                      removeTemplate(t.id);
                  }}
                >
                  Del
                </button>
                <input
                  type="number"
                  step="1"
                  min={placedCount}
                  value={t.quantity}
                  onChange={(e) =>
                    updateTemplate(t.id, {
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
                  title={`Total parcel size; ${remaining} remaining unplaced`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
