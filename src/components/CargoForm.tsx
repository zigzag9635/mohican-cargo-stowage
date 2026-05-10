import { useEffect, useState } from 'react';
import { useStore, makeId } from '../store';
import type { CargoTemplate } from '../types';
import { useT } from '../lib/i18n';

type FormState = Omit<CargoTemplate, 'id' | 'color'>;

const DEFAULT_FORM: FormState = {
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
};

export function CargoForm() {
  const addTemplate = useStore((s) => s.addTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const editingTemplateId = useStore((s) => s.editingTemplate);
  const setEditingTemplate = useStore((s) => s.setEditingTemplate);
  const editingTemplate = useStore((s) =>
    s.editingTemplate ? s.templates.find((tt) => tt.id === s.editingTemplate) ?? null : null,
  );
  const t = useT();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  // When editing a template, copy its values into the form.
  useEffect(() => {
    if (editingTemplate) {
      const { id: _id, color: _color, ...rest } = editingTemplate;
      void _id;
      void _color;
      setForm(rest);
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [editingTemplateId, editingTemplate]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm(DEFAULT_FORM);
    if (editingTemplateId) setEditingTemplate(null);
  }

  function submit() {
    if (!form.name.trim()) {
      alert(t.enterName);
      return;
    }
    if (form.length <= 0 || form.breadth <= 0 || form.height <= 0 || form.weight <= 0) {
      alert(t.nonPositive);
      return;
    }
    if (editingTemplateId) {
      updateTemplate(editingTemplateId, form);
      setEditingTemplate(null);
      setForm(DEFAULT_FORM);
    } else {
      addTemplate({ ...form, id: makeId('c') });
      reset();
    }
  }

  const isEditing = !!editingTemplateId;

  return (
    <div className={`section ${isEditing ? 'editing' : ''}`}>
      <h2>
        {isEditing
          ? `${t.editParcel}: ${editingTemplate?.name || ''}`
          : t.addCargoParcel}
      </h2>
      <div className="field">
        <label>{t.name}</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={t.namePlaceholder}
        />
      </div>
      <div className="row three">
        <div className="field">
          <label>{t.lengthM}</label>
          <input
            type="number"
            step="0.01"
            value={form.length}
            onChange={(e) => set('length', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="field">
          <label>{t.breadthM}</label>
          <input
            type="number"
            step="0.01"
            value={form.breadth}
            onChange={(e) => set('breadth', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="field">
          <label>{t.heightM}</label>
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
          <label>{t.weightPerPiece}</label>
          <input
            type="number"
            step="0.01"
            value={form.weight}
            onChange={(e) => set('weight', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="field">
          <label>{t.quantityPcs}</label>
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
          <label>{t.tolerancePct}</label>
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
          <label>{t.stackPolicy}</label>
          <select
            value={form.stackPolicy}
            onChange={(e) =>
              set('stackPolicy', e.target.value as CargoTemplate['stackPolicy'])
            }
          >
            <option value="no_stack">{t.singleTier}</option>
            <option value="stackable">{t.stackable}</option>
          </select>
        </div>
      </div>
      {form.stackPolicy === 'stackable' && (
        <div className="field">
          <label>{t.maxStackTiers}</label>
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
        {t.allowRotation}
      </label>
      <div className="row">
        <div className="field">
          <label>{t.dischargePort}</label>
          <input
            type="text"
            value={form.dischargePort}
            onChange={(e) => set('dischargePort', e.target.value)}
            placeholder="HAM"
          />
        </div>
        <div className="field">
          <label>{t.shipperBl}</label>
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
          {isEditing ? t.saveChanges : t.addParcel}
        </button>
        <button className="btn" onClick={reset}>
          {isEditing ? t.cancel : t.reset}
        </button>
      </div>
      {isEditing && (
        <div className="empty" style={{ marginTop: 6 }}>
          {t.editingHint}
        </div>
      )}
      {form.tolerancePct > 0 && (
        <div className="empty" style={{ marginTop: 6 }}>
          {t.effectiveDims}:{' '}
          {(form.length * (1 + form.tolerancePct / 100)).toFixed(2)} ×{' '}
          {(form.breadth * (1 + form.tolerancePct / 100)).toFixed(2)} ×{' '}
          {(form.height * (1 + form.tolerancePct / 100)).toFixed(2)} m
        </div>
      )}
    </div>
  );
}
