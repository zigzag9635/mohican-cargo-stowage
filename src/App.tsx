import { useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { LeftPane } from './components/LeftPane';
import { RightPane } from './components/RightPane';
import { HoldTabs } from './components/HoldTabs';
import { HoldCanvas } from './components/HoldCanvas';
import { useT } from './lib/i18n';

type ColorMode = 'template' | 'port' | 'shipper' | 'weight' | 'stack';

export default function App() {
  const [colorMode, setColorMode] = useState<ColorMode>('template');
  const t = useT();

  return (
    <div className="app">
      <Toolbar />
      <LeftPane />
      <main className="center-pane">
        <HoldTabs />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{t.colourBy}</span>
          <div className="subtab" style={{ marginBottom: 0 }}>
            <button className={colorMode === 'template' ? 'active' : ''} onClick={() => setColorMode('template')}>{t.cmTemplate}</button>
            <button className={colorMode === 'port' ? 'active' : ''} onClick={() => setColorMode('port')}>{t.cmPort}</button>
            <button className={colorMode === 'shipper' ? 'active' : ''} onClick={() => setColorMode('shipper')}>{t.cmShipper}</button>
            <button className={colorMode === 'weight' ? 'active' : ''} onClick={() => setColorMode('weight')}>{t.cmWeight}</button>
            <button className={colorMode === 'stack' ? 'active' : ''} onClick={() => setColorMode('stack')}>{t.cmStack}</button>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Header text={t.topView} />
            <HoldCanvas view="top" colorMode={colorMode} />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Header text={t.sideView} />
            <HoldCanvas view="side" colorMode={colorMode} />
          </div>
        </div>
        <div className="legend">
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#22c55e44', border: '1px dashed #22c55e44' }} /> {t.legendFreeSpace}</span>
          <span>{t.legendDragHint}</span>
        </div>
      </main>
      <RightPane />
    </div>
  );
}

function Header({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '4px 12px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        fontSize: 11,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {text}
    </div>
  );
}
