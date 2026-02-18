import React, { useRef, useState } from 'react';
import { useRoadmapStore, useDisplaySprintCount, useSprintConfig, useTimingUnit } from '../store/roadmapStore';

export function DataControls() {
  const { exportData, importData, clearAllData, setDisplaySprintCount, updateSprintConfig, setTimingUnit, syncEpicDetailsFromPool } = useRoadmapStore();
  const displaySprintCount = useDisplaySprintCount();
  const sprintConfig = useSprintConfig();
  const timingUnit = useTimingUnit();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadmap-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importData(content);
      if (success) {
        alert('Data imported successfully!');
      } else {
        alert('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);

    // Reset input
    e.target.value = '';
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      clearAllData();
    }
  };

  return (
    <div className="data-controls">
      <div className="section-header collapsible" onClick={() => setIsSettingsOpen(!isSettingsOpen)}>
        <h3>
          <span className="collapse-icon">{isSettingsOpen ? '▼' : '▶'}</span>
          Settings
        </h3>
      </div>

      {isSettingsOpen && (
        <>
          <div className="settings-section">
            <div className="settings-group">
              <h4>Input Mode</h4>
              <div className="setting-row">
                <label htmlFor="timing-unit">Item Timing:</label>
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${timingUnit === 'sprints' ? 'active' : ''}`}
                    onClick={() => setTimingUnit('sprints')}
                  >
                    Sprints
                  </button>
                  <button
                    className={`toggle-btn ${timingUnit === 'dates' ? 'active' : ''}`}
                    onClick={() => setTimingUnit('dates')}
                  >
                    Dates
                  </button>
                </div>
              </div>
              <p className="setting-hint">
                {timingUnit === 'sprints'
                  ? 'New items will use sprint numbers for start/end timing.'
                  : 'New items will use calendar dates for start/end timing.'}
              </p>
            </div>

            <div className="settings-group">
              <h4>Sprint Configuration</h4>
              <div className="setting-row">
                <label htmlFor="first-sprint">First Sprint #:</label>
                <input
                  id="first-sprint"
                  type="number"
                  value={sprintConfig.firstSprintNumber}
                  min={1}
                  max={999}
                  onChange={(e) => updateSprintConfig({ firstSprintNumber: Number(e.target.value) })}
                />
              </div>

              <div className="setting-row">
                <label htmlFor="first-sprint-date">First Sprint Start:</label>
                <input
                  id="first-sprint-date"
                  type="date"
                  value={sprintConfig.firstSprintStartDate}
                  onChange={(e) => updateSprintConfig({ firstSprintStartDate: e.target.value })}
                />
              </div>

              <div className="setting-row">
                <label htmlFor="working-days">Working Days/Sprint:</label>
                <input
                  id="working-days"
                  type="number"
                  value={sprintConfig.workingDaysPerSprint}
                  min={1}
                  max={30}
                  onChange={(e) => updateSprintConfig({ workingDaysPerSprint: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="settings-group">
              <h4>Display</h4>
              <div className="setting-row">
                <label htmlFor="sprint-count">Show Sprints:</label>
                <select
                  id="sprint-count"
                  value={displaySprintCount}
                  onChange={(e) => setDisplaySprintCount(Number(e.target.value))}
                >
                  <option value={6}>6 sprints (~3 months)</option>
                  <option value={12}>12 sprints (~6 months)</option>
                  <option value={18}>18 sprints (~9 months)</option>
                  <option value={24}>24 sprints (~1 year)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="settings-group">
            <h4>Data Management</h4>
            <div className="data-actions">
              <button className="btn btn-secondary" onClick={() => { syncEpicDetailsFromPool(); alert('Epic details synced from pool!'); }} title="Fill empty epic fields on roadmap items from matching pool items">
                Sync Epic Details
              </button>
              <button className="btn btn-secondary" onClick={handleExport}>
                Export JSON
              </button>
              <button className="btn btn-secondary" onClick={handleImportClick}>
                Import JSON
              </button>
              <button className="btn btn-danger" onClick={handleClear}>
                Clear All
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
