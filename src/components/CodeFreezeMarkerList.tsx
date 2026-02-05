import React, { useState } from 'react';
import { useCodeFreezeMarkers, useRoadmapStore, useSprintConfig, useDisplaySprintCount } from '../store/roadmapStore';

export function CodeFreezeMarkerList() {
  const codeFreezeMarkers = useCodeFreezeMarkers();
  const sprintConfig = useSprintConfig();
  const displaySprintCount = useDisplaySprintCount();
  const { addCodeFreezeMarker, updateCodeFreezeMarker, deleteCodeFreezeMarker } = useRoadmapStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [afterSprint, setAfterSprint] = useState<number>(sprintConfig.firstSprintNumber);
  const [error, setError] = useState<string | null>(null);

  // Generate available sprint numbers
  const availableSprints = Array.from(
    { length: displaySprintCount },
    (_, i) => sprintConfig.firstSprintNumber + i
  );

  const resetForm = () => {
    setName('');
    setAfterSprint(sprintConfig.firstSprintNumber);
    setError(null);
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a code freeze name');
      return;
    }

    if (editingId) {
      updateCodeFreezeMarker(editingId, { name: name.trim(), afterSprint });
    } else {
      addCodeFreezeMarker(name.trim(), afterSprint);
    }

    resetForm();
  };

  const handleEdit = (marker: { id: string; name: string; afterSprint: number }) => {
    setEditingId(marker.id);
    setName(marker.name);
    setAfterSprint(marker.afterSprint);
    setShowAddForm(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}" code freeze marker?`)) {
      deleteCodeFreezeMarker(id);
    }
  };

  return (
    <div className="code-freeze-marker-list">
      <div className="section-header">
        <h3>Code Freeze Markers</h3>
        {!showAddForm && (
          <button
            className="btn btn-primary btn-small"
            onClick={() => setShowAddForm(true)}
          >
            + Add Code Freeze
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="code-freeze-form">
          <div className="form-group">
            <label htmlFor="code-freeze-name">Code Freeze Name</label>
            <input
              id="code-freeze-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., March Code Freeze"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="code-freeze-sprint">After Sprint</label>
            <select
              id="code-freeze-sprint"
              value={afterSprint}
              onChange={(e) => setAfterSprint(Number(e.target.value))}
            >
              {availableSprints.map((sprint) => (
                <option key={sprint} value={sprint}>
                  Sprint {sprint}
                </option>
              ))}
            </select>
            <small className="form-hint">Code freeze line appears at the end of the selected sprint</small>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-small">
              {editingId ? 'Update' : 'Add'}
            </button>
            <button type="button" className="btn btn-secondary btn-small" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {codeFreezeMarkers.length === 0 && !showAddForm && (
        <div className="empty-state small">
          <p>No code freeze markers. Add markers to show freeze points on the timeline.</p>
        </div>
      )}

      <div className="markers-container">
        {codeFreezeMarkers.map((marker) => (
          <div key={marker.id} className="marker-row code-freeze-marker-row">
            <div className="marker-info">
              <span className="marker-name">{marker.name}</span>
              <span className="marker-sprint">After Sprint {marker.afterSprint}</span>
            </div>
            <div className="marker-actions">
              <button
                className="btn btn-small btn-text"
                onClick={() => handleEdit(marker)}
              >
                Edit
              </button>
              <button
                className="btn btn-small btn-text btn-danger"
                onClick={() => handleDelete(marker.id, marker.name)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
