import { useState } from 'react';
import { useItems, useRoadmapStore, useSprintConfig, useDisplaySprintCount } from '../store/roadmapStore';
import { ItemForm } from './ItemForm';
import { SubtaskEditor } from './SubtaskEditor';
import { sprintStartDate, sprintEndDate, formatDate, fromISODateString, toISODateString } from '../utils/workingDays';
import { CATEGORY_COLORS } from '../data/poolItems';
import type { RoadmapItem } from '../types';

// Helper to get item display dates
function getItemDates(item: RoadmapItem, sprintConfig: any): { start: Date; end: Date; displayText: string } {
  if (item.startSprint !== undefined && item.endSprint !== undefined) {
    // Sprint-based item
    const start = sprintStartDate(item.startSprint, sprintConfig);
    const end = sprintEndDate(item.endSprint, sprintConfig);
    return {
      start,
      end,
      displayText: `Sprint ${item.startSprint} - Sprint ${item.endSprint}`,
    };
  } else if (item.startDate && item.endDate) {
    // Date-based item
    const start = fromISODateString(item.startDate);
    const end = fromISODateString(item.endDate);
    return {
      start,
      end,
      displayText: `${formatDate(start)} - ${formatDate(end)}`,
    };
  }
  // Fallback
  return {
    start: new Date(),
    end: new Date(),
    displayText: 'No dates',
  };
}

// Inline sprint range editor component
function SprintRangeEditor({
  item,
  sprintConfig,
  displaySprintCount,
  onCancel,
}: {
  item: RoadmapItem;
  sprintConfig: any;
  displaySprintCount: number;
  onCancel: () => void;
}) {
  const { updateItem } = useRoadmapStore();
  const isSprintBased = item.startSprint !== undefined;

  // Sprint mode state
  const [startSprint, setStartSprint] = useState(item.startSprint || sprintConfig.firstSprintNumber);
  const [endSprint, setEndSprint] = useState(item.endSprint || sprintConfig.firstSprintNumber);

  // Date mode state
  const [startDate, setStartDate] = useState(item.startDate || toISODateString(new Date()));
  const [endDate, setEndDate] = useState(item.endDate || toISODateString(new Date()));

  const [error, setError] = useState<string | null>(null);

  // Generate sprint options
  const sprintOptions: number[] = [];
  for (let i = 0; i < displaySprintCount; i++) {
    sprintOptions.push(sprintConfig.firstSprintNumber + i);
  }

  const handleSave = () => {
    setError(null);

    if (isSprintBased) {
      if (endSprint < startSprint) {
        setError('End sprint must be >= start sprint');
        return;
      }
      updateItem(item.id, { startSprint, endSprint });
    } else {
      if (new Date(endDate) < new Date(startDate)) {
        setError('End date must be on or after start date');
        return;
      }
      updateItem(item.id, { startDate, endDate });
    }
    onCancel();
  };

  return (
    <div className="sprint-range-editor">
      {isSprintBased ? (
        <div className="sprint-range-fields">
          <div className="sprint-range-field">
            <label>Start</label>
            <select
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
                <option key={s} value={s}>S{s}</option>
              ))}
            </select>
          </div>
          <span className="sprint-range-separator">-</span>
          <div className="sprint-range-field">
            <label>End</label>
            <select
              value={endSprint}
              onChange={(e) => setEndSprint(Number(e.target.value))}
            >
              {sprintOptions.filter((s) => s >= startSprint).map((s) => (
                <option key={s} value={s}>S{s}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="sprint-range-fields">
          <div className="sprint-range-field">
            <label>Start</label>
            <input
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
          <span className="sprint-range-separator">-</span>
          <div className="sprint-range-field">
            <label>End</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      )}
      {error && <div className="sprint-range-error">{error}</div>}
      <div className="sprint-range-actions">
        <button type="button" className="btn btn-small btn-primary" onClick={handleSave}>
          Save
        </button>
        <button type="button" className="btn btn-small btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ItemList() {
  const items = useItems();
  const sprintConfig = useSprintConfig();
  const displaySprintCount = useDisplaySprintCount();
  const { deleteItem } = useRoadmapStore();

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingSprintRangeId, setEditingSprintRangeId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteItem(id);
      setExpandedItems((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="item-list">
      <div className="item-list-header">
        <h3>Roadmap Items</h3>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          + Add Item
        </button>
      </div>

      {showAddForm && (
        <div className="item-form-container">
          <ItemForm onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {items.length === 0 && !showAddForm && (
        <div className="empty-state">
          <p>No roadmap items yet. Add your first item to get started.</p>
        </div>
      )}

      <div className="items-container">
        {items.map((item) => {
          const isExpanded = expandedItems.has(item.id);
          const isEditing = editingItemId === item.id;
          const { start, end, displayText } = getItemDates(item, sprintConfig);
          const isSprintBased = item.startSprint !== undefined;

          return (
            <div key={item.id} className={`item-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="item-row">
                <button
                  className="expand-btn"
                  onClick={() => toggleExpand(item.id)}
                  title={isExpanded ? 'Collapse' : 'Expand to edit subtasks'}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>

                {isEditing ? (
                  <div className="item-edit-form">
                    <ItemForm
                      editingItem={item}
                      onCancel={() => setEditingItemId(null)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="item-info">
                      {item.category && (
                        <span
                          className="pool-category-badge pool-category-badge-sm"
                          style={{
                            backgroundColor: CATEGORY_COLORS[item.category]?.bg || '#f1f5f9',
                            color: CATEGORY_COLORS[item.category]?.text || '#475569',
                            borderColor: CATEGORY_COLORS[item.category]?.border || '#cbd5e1',
                          }}
                        >
                          {item.category}
                        </span>
                      )}
                      <span className="item-name">{item.name}</span>
                      {editingSprintRangeId === item.id ? (
                        <SprintRangeEditor
                          item={item}
                          sprintConfig={sprintConfig}
                          displaySprintCount={displaySprintCount}
                          onCancel={() => setEditingSprintRangeId(null)}
                        />
                      ) : (
                        <span
                          className="item-sprints item-sprints-editable"
                          onClick={() => setEditingSprintRangeId(item.id)}
                          title="Click to edit sprint range"
                        >
                          {displayText}
                          <span className="edit-icon">&#9998;</span>
                        </span>
                      )}
                      {isSprintBased && editingSprintRangeId !== item.id && (
                        <span className="item-dates">
                          {formatDate(start)} - {formatDate(end)}
                        </span>
                      )}
                    </div>

                    <div className="item-actions">
                      <button
                        className="btn btn-small btn-text"
                        onClick={() => setEditingItemId(item.id)}
                        title="Edit item name"
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-small btn-text btn-danger"
                        onClick={() => handleDelete(item.id, item.name)}
                        title="Delete item"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>

              {isExpanded && !isEditing && (
                <div className="item-subtasks">
                  <SubtaskEditor item={item} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
