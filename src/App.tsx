import { useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { LeftPane } from './components/LeftPane';
import { RightPane } from './components/RightPane';
import { HoldTabs } from './components/HoldTabs';
import { HoldCanvas } from './components/HoldCanvas';

type ColorMode = 'template' | 'port' | 'shipper' | 'weight' | 'stack';

export default function App() {
  const [colorMode, setColorMode] = useState<ColorMode>('template');

  return (
    <div className="app">
      <Toolbar />
      <LeftPane />
      <main className="center-pane">
        <HoldTabs />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Colour by:</span>
          <div className="subtab" style={{ marginBottom: 0 }}>
            <button className={colorMode === 'template' ? 'active' : ''} onClick={() => setColorMode('template')}>Parcel</button>
            <button className={colorMode === 'port' ? 'active' : ''} onClick={() => setColorMode('port')}>Port</button>
            <button className={colorMode === 'shipper' ? 'active' : ''} onClick={() => setColorMode('shipper')}>Shipper</button>
            <button className={colorMode === 'weight' ? 'active' : ''} onClick={() => setColorMode('weight')}>Weight</button>
            <button className={colorMode === 'stack' ? 'active' : ''} onClick={() => setColorMode('stack')}>Stack</button>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Header text="TOP VIEW (looking down)" />
            <HoldCanvas view="top" colorMode={colorMode} />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Header text="SIDE VIEW (looking from port; aft is on the left)" />
            <HoldCanvas view="side" colorMode={colorMode} />
          </div>
        </div>
        <div className="legend">
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#22c55e44', border: '1px dashed #22c55e44' }} /> free space (with dimensions)</span>
          <span>Drag pieces to move · Double-click to remove</span>
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
