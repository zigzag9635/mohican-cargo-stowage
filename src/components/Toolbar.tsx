import { useEffect } from 'react';
import { useStore } from '../store';
import { exportPlanToPdf } from '../lib/pdf';
import { SHIP } from '../data/ship';
import { useT, useLang } from '../lib/i18n';

declare global {
  interface Window {
    api?: {
      saveJson: (
        defaultName: string,
        data: string,
      ) => Promise<{ canceled: true } | { canceled: false; filePath: string }>;
      openJson: () => Promise<
        | { canceled: true }
        | { canceled: false; filePath: string; data: string }
      >;
      savePdf: (
        defaultName: string,
        data: ArrayBuffer,
      ) => Promise<{ canceled: true } | { canceled: false; filePath: string }>;
      onMenu: (
        channel: 'new' | 'open' | 'save' | 'export-pdf' | 'about',
        cb: () => void,
      ) => () => void;
      setLang?: (lang: 'en' | 'ru') => void;
    };
  }
}

export function Toolbar() {
  const exportPlan = useStore((s) => s.exportPlan);
  const loadPlan = useStore((s) => s.loadPlan);
  const newPlan = useStore((s) => s.newPlan);
  const t = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);

  async function handleSave() {
    const plan = exportPlan();
    const json = JSON.stringify(plan, null, 2);
    if (window.api?.saveJson) {
      await window.api.saveJson(
        `${SHIP.name.replace(/\s+/g, '_')}_plan.json`,
        json,
      );
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${SHIP.name.replace(/\s+/g, '_')}_plan.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleOpen() {
    if (window.api?.openJson) {
      const res = await window.api.openJson();
      if (res.canceled) return;
      try {
        const plan = JSON.parse(res.data);
        loadPlan(plan);
      } catch {
        alert(t.invalidPlanFile);
      }
    } else {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,application/json';
      inp.onchange = () => {
        const file = inp.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            loadPlan(JSON.parse(String(reader.result)));
          } catch {
            alert(t.invalidPlanFile);
          }
        };
        reader.readAsText(file);
      };
      inp.click();
    }
  }

  async function handleExportPdf() {
    const plan = exportPlan();
    const buffer = await exportPlanToPdf(plan);
    if (window.api?.savePdf) {
      await window.api.savePdf(
        `${SHIP.name.replace(/\s+/g, '_')}_plan.pdf`,
        buffer,
      );
    } else {
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${SHIP.name.replace(/\s+/g, '_')}_plan.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function handleNew() {
    if (confirm(t.confirmNewPlan)) newPlan();
  }

  useEffect(() => {
    // sync menu language with renderer language on mount and on every change
    window.api?.setLang?.(lang);
    const off1 = window.api?.onMenu('new', handleNew);
    const off2 = window.api?.onMenu('open', handleOpen);
    const off3 = window.api?.onMenu('save', handleSave);
    const off4 = window.api?.onMenu('export-pdf', handleExportPdf);
    return () => {
      off1?.();
      off2?.();
      off3?.();
      off4?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function chooseLang(l: 'en' | 'ru') {
    setLang(l);
    window.api?.setLang?.(l);
  }

  return (
    <div className="toolbar">
      <h1>{t.appTitle}</h1>
      <button onClick={handleNew}>{t.menuNew}</button>
      <button onClick={handleOpen}>{t.menuOpen}</button>
      <button onClick={handleSave}>{t.menuSave}</button>
      <button onClick={handleExportPdf}>{t.menuExportPdf}</button>
      <span className="spacer" />
      <div className="lang-toggle">
        <button
          className={lang === 'ru' ? 'active' : ''}
          onClick={() => chooseLang('ru')}
          title="Русский"
        >
          RU
        </button>
        <button
          className={lang === 'en' ? 'active' : ''}
          onClick={() => chooseLang('en')}
          title="English"
        >
          EN
        </button>
      </div>
      <span className="empty">{t.statusOffline}</span>
    </div>
  );
}
