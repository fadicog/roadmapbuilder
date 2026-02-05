import React, { useState } from 'react';
import { useRoadmapStore, useSprintConfig, useDisplaySprintCount, useTimingUnit } from '../store/roadmapStore';
import { sprintStartDate, sprintEndDate, toISODateString } from '../utils/workingDays';
import type { RoadmapItem } from '../types';

interface ItemFormProps {
  onCancel?: () => void;
  editingItem?: RoadmapItem;
}

export function ItemForm({ onCancel, editingItem }: ItemFormProps) {
  const sprintConfig = useSprintConfig();
  const displaySprintCount = useDisplaySprintCount();
  const timingUnit = useTimingUnit();
  const { addItemBySprint, addItemByDate, updateItem } = useRoadmapStore();

  // Determine if editing item is sprint-based or date-based
  const isEditingSprintBased = editingItem?.startSprint !== undefined;

  const [name, setName] = useState(editingItem?.name || '');

  // Sprint mode state
  const [startSprint, setStartSprint] = useState(
    editingItem?.startSprint || sprintConfig.firstSprintNumber
  );
  const [endSprint, setEndSprint] = useState(
    editingItem?.endSprint || sprintConfig.firstSprintNumber
  );

  // Date mode state - default to first sprint dates
  const defaultStartDate = toISODateString(sprintStartDate(sprintConfig.firstSprintNumber, sprintConfig));
  const defaultEndDate = toISODateString(sprintEndDate(sprintConfig.firstSprintNumber, sprintConfig));

  const [startDate, setStartDate] = useState(
    editingItem?.startDate || defaultStartDate
  );
  const [endDate, setEndDate] = useState(
    editingItem?.endDate || defaultEndDate
  );

  const [error, setError] = useState<string | null>(null);
  const [externalVisible, setExternalVisible] = useState(editingItem?.externalVisible ?? false);

  // Generate sprint options
  const sprintOptions: number[] = [];
  for (let i = 0; i < displaySprintCount; i++) {
    sprintOptions.push(sprintConfig.firstSprintNumber + i);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Please enter an item name');
      return;
    }

    if (timingUnit === 'sprints') {
      if (endSprint < startSprint) {
        setError('End sprint must be greater than or equal to start sprint');
        return;
      }

      if (editingItem) {
        updateItem(editingItem.id, { name: name.trim(), startSprint, endSprint, externalVisible });
      } else {
        addItemBySprint(name.trim(), startSprint, endSprint);
      }
    } else {
      // Date mode
      if (new Date(endDate) < new Date(startDate)) {
        setError('End date must be on or after start date');
        return;
      }

      if (editingItem) {
        updateItem(editingItem.id, { name: name.trim(), startDate, endDate, externalVisible });
      } else {
        addItemByDate(name.trim(), startDate, endDate);
      }
    }

    // Reset form
    if (!editingItem) {
      setName('');
      setStartSprint(sprintConfig.firstSprintNumber);
      setEndSprint(sprintConfig.firstSprintNumber);
      setStartDate(defaultStartDate);
      setEndDate(defaultEndDate);
    }

    onCancel?.();
  };

  // Show appropriate form based on timing unit
  // When editing, respect the item's original mode
  const showSprintMode = editingItem
    ? isEditingSprintBased
    : timingUnit === 'sprints';

  return (
    <form onSubmit={handleSubmit} className="item-form">
      <div className="form-group">
        <label htmlFor="item-name">Item Name</label>
        <input
          id="item-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Documents tab refresh"
          autoFocus
        />
      </div>

      {showSprintMode ? (
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="start-sprint">Start Sprint</label>
            <select
              id="start-sprint"
              value={startSprint}
              onChange={(e) => {
                const val = Number(e.target.value);
                setStartSprint(val);
                if (endSprint < val) {
                  setEndSprint(val);
                }
              }}
            >
              {sprintOptions.map((s) => (
                <option key={s} value={s}>
                  Sprint {s}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="end-sprint">End Sprint</label>
            <select
              id="end-sprint"
              value={endSprint}
              onChange={(e) => setEndSprint(Number(e.target.value))}
            >
              {sprintOptions
                .filter((s) => s >= startSprint)
                .map((s) => (
                  <option key={s} value={s}>
                    Sprint {s}
                  </option>
                ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="start-date">Start Date</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (new Date(endDate) < new Date(e.target.value)) {
                  setEndDate(e.target.value);
                }
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="end-date">End Date</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      )}

      {editingItem && (
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={externalVisible}
              onChange={(e) => setExternalVisible(e.target.checked)}
            />
            <span>Show in External Roadmap</span>
          </label>
          <span className="form-hint">Include this item in the external/public roadmap view</span>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {editingItem ? 'Update Item' : 'Add Item'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
