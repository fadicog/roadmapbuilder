import React, { useState } from 'react';
import { useReleaseMarkers, useRoadmapStore, useSprintConfig, useDisplaySprintCount } from '../store/roadmapStore';
import { formatDate, sprintStartDate, sprintEndDate, toISODateString } from '../utils/workingDays';

export function ReleaseMarkerList() {
  const releaseMarkers = useReleaseMarkers();
  const sprintConfig = useSprintConfig();
  const displaySprintCount = useDisplaySprintCount();
  const { addReleaseMarker, updateReleaseMarker, deleteReleaseMarker } = useRoadmapStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Calculate min/max dates for the date picker
  const minDate = toISODateString(sprintStartDate(sprintConfig.firstSprintNumber, sprintConfig));
  const maxDate = toISODateString(
    sprintEndDate(sprintConfig.firstSprintNumber + displaySprintCount - 1, sprintConfig)
  );

  const resetForm = () => {
    setName('');
    setDate('');
    setError(null);
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a release name');
      return;
    }

    if (!date) {
      setError('Please select a date');
      return;
    }

    if (editingId) {
      updateReleaseMarker(editingId, { name: name.trim(), date });
    } else {
      addReleaseMarker(name.trim(), date);
    }

    resetForm();
  };

  const handleEdit = (marker: { id: string; name: string; date: string }) => {
    setEditingId(marker.id);
    setName(marker.name);
    setDate(marker.date);
    setShowAddForm(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}" release marker?`)) {
      deleteReleaseMarker(id);
    }
  };

  return (
    <div className="release-marker-list">
      <div className="section-header">
        <h3>Release Markers</h3>
        {!showAddForm && (
          <button
            className="btn btn-primary btn-small"
            onClick={() => setShowAddForm(true)}
          >
            + Add Release
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="release-form">
          <div className="form-group">
            <label htmlFor="release-name">Release Name</label>
            <input
              id="release-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., March Release"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="release-date">Release Date</label>
            <input
              id="release-date"
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
            />
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

      {releaseMarkers.length === 0 && !showAddForm && (
        <div className="empty-state small">
          <p>No release markers. Add milestones to show on the timeline.</p>
        </div>
      )}

      <div className="markers-container">
        {releaseMarkers.map((marker) => (
          <div key={marker.id} className="marker-row">
            <div className="marker-info">
              <span className="marker-name">{marker.name}</span>
              <span className="marker-date">{formatDate(marker.date)}</span>
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
