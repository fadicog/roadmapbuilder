import { useState, useCallback } from 'react';
import { useItems, useRoadmapStore, useSprintConfig, useDisplaySprintCount } from '../store/roadmapStore';
import { ItemForm } from './ItemForm';
import { SubtaskEditor } from './SubtaskEditor';
import { sprintStartDate, sprintEndDate, formatDate, fromISODateString, toISODateString } from '../utils/workingDays';
import { CATEGORY_COLORS } from '../data/poolItems';
import type { RoadmapItem } from '../types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Helper to get item display dates
function getItemDates(item: RoadmapItem, sprintConfig: any): { start: Date; end: Date; displayText: string } {
  if (item.startSprint !== undefined && item.endSprint !== undefined) {
    const start = sprintStartDate(item.startSprint, sprintConfig);
    const end = sprintEndDate(item.endSprint, sprintConfig);
    return {
      start,
      end,
      displayText: `Sprint ${item.startSprint} - Sprint ${item.endSprint}`,
    };
  } else if (item.startDate && item.endDate) {
    const start = fromISODateString(item.startDate);
    const end = fromISODateString(item.endDate);
    return {
      start,
      end,
      displayText: `${formatDate(start)} - ${formatDate(end)}`,
    };
  }
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

  const [startSprint, setStartSprint] = useState(item.startSprint || sprintConfig.firstSprintNumber);
  const [endSprint, setEndSprint] = useState(item.endSprint || sprintConfig.firstSprintNumber);
  const [startDate, setStartDate] = useState(item.startDate || toISODateString(new Date()));
  const [endDate, setEndDate] = useState(item.endDate || toISODateString(new Date()));
  const [error, setError] = useState<string | null>(null);

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
                if (endSprint < val) setEndSprint(val);
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

// Sortable wrapper component for @dnd-kit
function SortableItemCard({ id, children }: { id: string; children: (dragHandleProps: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
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

  // @dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === String(active.id));
      const newIndex = items.findIndex(i => i.id === String(over.id));
      const reordered = arrayMove(items, oldIndex, newIndex);
      reorderItems(reordered.map(i => i.id));
    }
  }, [items, reorderItems]);

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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="items-container">
            {items.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const isEditing = editingItemId === item.id;
              const { start, end, displayText } = getItemDates(item, sprintConfig);
              const isSprintBased = item.startSprint !== undefined;

              return (
                <SortableItemCard key={item.id} id={item.id}>
                  {(dragHandleProps) => (
                    <div
                      data-item-id={item.id}
                      className={`item-card ${isExpanded ? 'expanded' : ''}`}
                    >
                      <div className="item-row">
                        {/* Drag handle */}
                        <div
                          className="drag-handle"
                          title="Drag to reorder"
                          {...dragHandleProps}
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
                  )}
                </SortableItemCard>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
