import { useState } from 'react';
import { useStore, makeId } from '../store';
import type { CargoTemplate } from '../types';

export function CargoForm() {
  const addTemplate = useStore((s) => s.addTemplate);

  const [form, setForm] = useState<Omit<CargoTemplate, 'id' | 'color'>>({
    name: '',
    length: 1.2,
    breadth: 0.8,
    height: 1.0,
    weight: 0.5,
    tolerancePct: 0,
    allowRotation: true,
    stackPolicy: 'no_stack',
    maxStackTier: 1,
    dischargePort: '',
    shipper: '',
    quantity: 10,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm({
      name: '',
      length: 1.2,
      breadth: 0.8,
      height: 1.0,
      weight: 0.5,
      tolerancePct: 0,
      allowRotation: true,
      stackPolicy: 'no_stack',
      maxStackTier: 1,
      dischargePort: '',
      shipper: '',
      quantity: 10,
    });
  }

  function submit() {
    if (!form.name.trim()) {
      alert('Введите название груза.');
      return;
    }
    if (form.length <= 0 || form.breadth <= 0 || form.height <= 0 || form.weight <= 0) {
      alert('Размеры и вес должны быть положительными.');
      return;
    }
    addTemplate({ ...form, id: makeId('c') });
    reset();
  }

  return (
    <div className="section">
      <h2>Add cargo parcel</h2>
      <div className="field">
        <label>Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Pipe bundle 12 m"
        />
      </div>
      <div className="row three">
        <div className="field">
          <label>Length, m</label>
          <input
            type="number"
            step="0.01"
            value={form.length}
            onChange={(e) => set('length', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="field">
          <label>Breadth, m</label>
          <input
            type="number"
            step="0.01"
            value={form.breadth}
            onChange={(e) => set('breadth', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="field">
          <label>Height, m</label>
          <input
            type="number"
            step="0.01"
            value={form.height}
            onChange={(e) => set('height', parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Weight per piece, t</label>
          <input
            type="number"
            step="0.01"
            value={form.weight}
            onChange={(e) => set('weight', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="field">
          <label>Quantity, pcs</label>
          <input
            type="number"
            step="1"
            value={form.quantity}
            onChange={(e) => set('quantity', parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Dimensional tolerance, %</label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="50"
            value={form.tolerancePct}
            onChange={(e) => set('tolerancePct', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="field">
          <label>Stack policy</label>
          <select
            value={form.stackPolicy}
            onChange={(e) =>
              set('stackPolicy', e.target.value as CargoTemplate['stackPolicy'])
            }
          >
            <option value="no_stack">Single tier only</option>
            <option value="stackable">Stackable</option>
          </select>
        </div>
      </div>
      {form.stackPolicy === 'stackable' && (
        <div className="field">
          <label>Max stacking tiers</label>
          <input
            type="number"
            step="1"
            min="1"
            max="10"
            value={form.maxStackTier}
            onChange={(e) => set('maxStackTier', parseInt(e.target.value, 10) || 1)}
          />
        </div>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={form.allowRotation}
          onChange={(e) => set('allowRotation', e.target.checked)}
        />
        Allow 90° rotation around vertical axis
      </label>
      <div className="row">
        <div className="field">
          <label>Discharge port</label>
          <input
            type="text"
            value={form.dischargePort}
            onChange={(e) => set('dischargePort', e.target.value)}
            placeholder="HAM"
          />
        </div>
        <div className="field">
          <label>Shipper / BL</label>
          <input
            type="text"
            value={form.shipper}
            onChange={(e) => set('shipper', e.target.value)}
            placeholder="Acme Co."
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button className="btn primary" onClick={submit}>
          Add parcel
        </button>
        <button className="btn" onClick={reset}>
          Reset
        </button>
      </div>
      {form.tolerancePct > 0 && (
        <div className="empty" style={{ marginTop: 6 }}>
          Effective dims used by the packer:{' '}
          {(form.length * (1 + form.tolerancePct / 100)).toFixed(2)} ×{' '}
          {(form.breadth * (1 + form.tolerancePct / 100)).toFixed(2)} ×{' '}
          {(form.height * (1 + form.tolerancePct / 100)).toFixed(2)} m
        </div>
      )}
    </div>
  );
}
