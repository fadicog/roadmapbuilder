import { EditorPanel } from './components/EditorPanel';
import { TimelineView } from './components/TimelineView';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Sprint Roadmap Builder</h1>
        <p className="app-subtitle">Plan and visualize your sprint-based roadmap</p>
      </header>

      <main className="app-main">
        <div className="panel-left">
          <EditorPanel />
        </div>
        <div className="panel-right">
          <TimelineView />
        </div>
      </main>
    </div>
  );
}

export default App;
