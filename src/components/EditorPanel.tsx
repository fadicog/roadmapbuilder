import { ItemList } from './ItemList';
import { ItemPool } from './ItemPool';
import { ReleaseMarkerList } from './ReleaseMarkerList';
import { CodeFreezeMarkerList } from './CodeFreezeMarkerList';
import { DataControls } from './DataControls';

export function EditorPanel() {
  return (
    <div className="editor-panel">
      <div className="editor-header">
        <h2>Roadmap Editor</h2>
      </div>

      <div className="editor-content">
        <ItemPool />

        <div className="editor-divider" />

        <ItemList />

        <div className="editor-divider" />

        <ReleaseMarkerList />

        <div className="editor-divider" />

        <CodeFreezeMarkerList />

        <div className="editor-divider" />

        <DataControls />
      </div>
    </div>
  );
}
