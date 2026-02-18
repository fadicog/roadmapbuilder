import { useState, useRef, useCallback } from 'react';
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
  const { deleteItem, reorderItems, sortItemsByStartDate } = useRoadmapStore();

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingSprintRangeId, setEditingSprintRangeId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Drag-and-drop state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null);
  const dragCounter = useRef(0);

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

  // --- Drag-and-drop handlers ---
  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
    // Add a slight delay to allow the drag image to form before styling
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement | null;
      if (el) el.classList.add('dragging');
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    // Clean up all drag states
    const el = draggedItemId ? document.querySelector(`[data-item-id="${draggedItemId}"]`) as HTMLElement | null : null;
    if (el) el.classList.remove('dragging');
    setDraggedItemId(null);
    setDragOverItemId(null);
    setDropPosition(null);
    dragCounter.current = 0;
  }, [draggedItemId]);

  const handleDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (itemId === draggedItemId) return;

    // Determine if cursor is in top half or bottom half of the card
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';

    setDragOverItemId(itemId);
    setDropPosition(position);
  }, [draggedItemId]);

  const handleDragEnter = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    dragCounter.current++;
    if (itemId !== draggedItemId) {
      setDragOverItemId(itemId);
    }
  }, [draggedItemId]);

  const handleDragLeave = useCallback((_e: React.DragEvent) => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOverItemId(null);
      setDropPosition(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    dragCounter.current = 0;

    if (!draggedItemId || draggedItemId === targetItemId) {
      handleDragEnd();
      return;
    }

    // Build the new order
    const currentIds = items.map((item) => item.id);
    const dragIdx = currentIds.indexOf(draggedItemId);
    const targetIdx = currentIds.indexOf(targetItemId);

    if (dragIdx === -1 || targetIdx === -1) {
      handleDragEnd();
      return;
    }

    // Remove dragged item from list
    const newIds = currentIds.filter((id) => id !== draggedItemId);

    // Find where to insert
    let insertIdx = newIds.indexOf(targetItemId);
    if (dropPosition === 'below') {
      insertIdx += 1;
    }

    // Insert at new position
    newIds.splice(insertIdx, 0, draggedItemId);

    reorderItems(newIds);
    handleDragEnd();
  }, [draggedItemId, dropPosition, items, reorderItems, handleDragEnd]);

  // --- Sort handler ---
  const handleSortByDate = useCallback(() => {
    sortItemsByStartDate();
  }, [sortItemsByStartDate]);

  return (
    <div className="item-list">
      <div className="item-list-header">
        <h3>Roadmap Items</h3>
        <div className="item-list-header-actions">
          <button
            className="btn btn-small btn-secondary sort-by-date-btn"
            onClick={handleSortByDate}
            title="Sort items by start date (earliest first)"
            disabled={items.length < 2}
          >
            <svg className="sort-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4L7 1L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 10L7 13L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Sort by Date
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            + Add Item
          </button>
        </div>
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
          const isDragTarget = dragOverItemId === item.id && draggedItemId !== item.id;

          return (
            <div
              key={item.id}
              data-item-id={item.id}
              className={[
                'item-card',
                isExpanded ? 'expanded' : '',
                isDragTarget && dropPosition === 'above' ? 'drop-above' : '',
                isDragTarget && dropPosition === 'below' ? 'drop-below' : '',
              ].filter(Boolean).join(' ')}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDragEnter={(e) => handleDragEnter(e, item.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item.id)}
            >
              <div className="item-row">
                {/* Drag handle */}
                <div
                  className="drag-handle"
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragEnd={handleDragEnd}
                  title="Drag to reorder"
                >
                  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                    <circle cx="3" cy="2" r="1.5" />
                    <circle cx="9" cy="2" r="1.5" />
                    <circle cx="3" cy="6" r="1.5" />
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="3" cy="10" r="1.5" />
                    <circle cx="9" cy="10" r="1.5" />
                    <circle cx="3" cy="14" r="1.5" />
                    <circle cx="9" cy="14" r="1.5" />
                  </svg>
                </div>

                <button
                  className="expand-btn"
                  onClick={() => toggleExpand(item.id)}
                  title={isExpanded ? 'Collapse' : 'Expand to edit subtasks'}
                >
                  {isExpanded ? '\u25BC' : '\u25B6'}
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
