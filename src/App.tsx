import { useState, useEffect, useCallback } from 'react';
import { useStore } from 'zustand';
import { EditorPanel } from './components/EditorPanel';
import { TimelineView } from './components/TimelineView';
import { EpicsView } from './components/EpicsView';
import { useRoadmapStore } from './store/roadmapStore';
import './App.css';

type AppTab = 'timeline' | 'epics';

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('timeline');

  // Access temporal store for undo/redo
  const { undo, redo, pastStates, futureStates } = useStore(
    (useRoadmapStore as any).temporal,
    (s: any) => s
  );
  const canUndo = (pastStates?.length ?? 0) > 0;
  const canRedo = (futureStates?.length ?? 0) > 0;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as Element)?.tagName || '');
    if (isInputFocused) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo) undo();
    }
    if (((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
      e.preventDefault();
      if (canRedo) redo();
    }
  }, [undo, redo, canUndo, canRedo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <h1>Sprint Roadmap Builder</h1>
          <p className="app-subtitle">Plan and visualize your sprint-based roadmap</p>
        </div>
        <div className="app-header-right">
          <div className="undo-redo-controls">
            <button className="btn btn-small btn-secondary" onClick={() => undo()} disabled={!canUndo} title="Undo (Ctrl+Z)">
              &#8617; Undo
            </button>
            <button className="btn btn-small btn-secondary" onClick={() => redo()} disabled={!canRedo} title="Redo (Ctrl+Y)">
              &#8618; Redo
            </button>
          </div>
          <nav className="app-tab-nav">
            <button className={`tab-nav-btn ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
              Timeline
            </button>
            <button className={`tab-nav-btn ${activeTab === 'epics' ? 'active' : ''}`} onClick={() => setActiveTab('epics')}>
              Epics
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'timeline' ? (
          <>
            <div className="panel-left"><EditorPanel /></div>
            <div className="panel-right"><TimelineView /></div>
          </>
        ) : (
          <div className="epics-panel-full"><EpicsView /></div>
        )}
      </main>
    </div>
  );
}

export default App;
