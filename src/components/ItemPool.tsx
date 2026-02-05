import { useState, useMemo, useRef, useEffect } from 'react';
import { useRoadmapStore, useSprintConfig, useDisplaySprintCount, useAddedPoolNumbers, usePoolItems } from '../store/roadmapStore';
import { CATEGORY_COLORS, getDefaultSprintDuration, getPriorityOrder } from '../data/poolItems';
import type { PoolItem } from '../types';

// Available categories for the dropdown
const CATEGORIES = ['Product', 'Technical', 'UX', 'Design', 'SP'];
const PRIORITIES = ['High', 'Medium', 'Low', 'TBD'];
const COMPLEXITIES = ['High', 'Medium', 'Low', 'TBD'];

interface AddToRoadmapDialogState {
  poolItem: PoolItem | null;
  startSprint: number;
  durationSprints: number;
}

interface PoolItemFormState {
  isOpen: boolean;
  editingItem: PoolItem | null; // null = creating new, otherwise editing
  featureName: string;
  category: string;
  priority: string;
  complexity: string;
  summary: string;
  tag: string;
  remarks: string;
  externalVisible: boolean;
}

const INITIAL_FORM_STATE: PoolItemFormState = {
  isOpen: false,
  editingItem: null,
  featureName: '',
  category: 'Product',
  priority: 'Medium',
  complexity: 'Medium',
  summary: '',
  tag: '',
  remarks: '',
  externalVisible: false,
};

export function ItemPool() {
  const sprintConfig = useSprintConfig();
  const displaySprintCount = useDisplaySprintCount();
  const addedPoolNumbers = useAddedPoolNumbers();
  const poolItems = usePoolItems();
  const { addFromPool, addPoolItem, updatePoolItem, deletePoolItem } = useRoadmapStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [addToRoadmapDialog, setAddToRoadmapDialog] = useState<AddToRoadmapDialogState | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [formState, setFormState] = useState<PoolItemFormState>(INITIAL_FORM_STATE);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Available pool items (not yet on roadmap)
  const availableItems = useMemo(() => {
    return poolItems.filter((item) => !addedPoolNumbers.has(item.number));
  }, [poolItems, addedPoolNumbers]);

  // Filtered items for the pool list
  const filteredItems = useMemo(() => {
    let items = availableItems;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.featureName.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.tag.toLowerCase().includes(q)
      );
    }

    if (categoryFilter) {
      items = items.filter((item) => item.category === categoryFilter);
    }

    // Sort by priority then by number
    return items.sort((a, b) => {
      const pa = getPriorityOrder(a.priority);
      const pb = getPriorityOrder(b.priority);
      if (pa !== pb) return pa - pb;
      return a.number - b.number;
    });
  }, [availableItems, searchQuery, categoryFilter]);

  // Filtered items for dropdown (sorted by priority)
  const dropdownItems = useMemo(() => {
    let items = availableItems;
    if (dropdownSearch.trim()) {
      const q = dropdownSearch.toLowerCase();
      items = items.filter(
        (item) =>
          item.featureName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.tag.toLowerCase().includes(q)
      );
    }
    return items.sort((a, b) => {
      const pa = getPriorityOrder(a.priority);
      const pb = getPriorityOrder(b.priority);
      if (pa !== pb) return pa - pb;
      return a.number - b.number;
    });
  }, [availableItems, dropdownSearch]);

  // All unique categories from current pool items
  const categories = useMemo(() => {
    const cats = new Set(poolItems.map((item) => item.category));
    return Array.from(cats).sort();
  }, [poolItems]);

  // Sprint options
  const sprintOptions: number[] = [];
  for (let i = 0; i < displaySprintCount; i++) {
    sprintOptions.push(sprintConfig.firstSprintNumber + i);
  }

  const handleOpenAddToRoadmapDialog = (poolItem: PoolItem) => {
    setAddToRoadmapDialog({
      poolItem,
      startSprint: sprintConfig.firstSprintNumber,
      durationSprints: getDefaultSprintDuration(poolItem.complexity),
    });
    setShowDropdown(false);
  };

  const handleConfirmAddToRoadmap = () => {
    if (!addToRoadmapDialog?.poolItem) return;

    addFromPool(
      addToRoadmapDialog.poolItem.featureName,
      addToRoadmapDialog.startSprint,
      addToRoadmapDialog.durationSprints,
      addToRoadmapDialog.poolItem.number,
      addToRoadmapDialog.poolItem.category,
      addToRoadmapDialog.poolItem.priority,
      addToRoadmapDialog.poolItem.complexity,
      addToRoadmapDialog.poolItem.ddaItem
    );

    setAddToRoadmapDialog(null);
  };

  const handleDragStart = (e: React.DragEvent, poolItem: PoolItem) => {
    e.dataTransfer.setData('application/pool-item', JSON.stringify(poolItem));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Open form to create new pool item
  const handleOpenNewForm = () => {
    setFormState({
      ...INITIAL_FORM_STATE,
      isOpen: true,
      editingItem: null,
    });
  };

  // Open form to edit existing pool item
  const handleOpenEditForm = (item: PoolItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormState({
      isOpen: true,
      editingItem: item,
      featureName: item.featureName,
      category: item.category,
      priority: item.priority,
      complexity: item.complexity,
      summary: item.summary,
      tag: item.tag,
      remarks: item.remarks,
      externalVisible: item.externalVisible ?? false,
    });
  };

  const handleCloseForm = () => {
    setFormState(INITIAL_FORM_STATE);
  };

  const handleSaveForm = () => {
    if (!formState.featureName.trim()) return;

    // Calculate scores based on priority and complexity
    const priorityScoreMap: Record<string, number> = { 'High': 8, 'Medium': 5, 'Low': 3, 'TBD': 0, 'TBC': 0 };
    const complexityScoreMap: Record<string, number> = { 'High': 3, 'Medium': 5, 'Low': 8, 'TBD': 0, 'TBC': 0 };
    const priorityScore = priorityScoreMap[formState.priority] || 0;
    const complexityScore = complexityScoreMap[formState.complexity] || 0;

    const itemData = {
      featureName: formState.featureName.trim(),
      category: formState.category,
      priority: formState.priority,
      priorityScore,
      complexity: formState.complexity,
      complexityScore,
      totalScore: priorityScore + complexityScore,
      summary: formState.summary.trim(),
      tag: formState.tag.trim(),
      remarks: formState.remarks.trim(),
      relatesTo: '',
      track: '',
      ddaItem: false,
      toBePickedUp: null,
      alreadyPickedUp: false,
      startSprint: null,
      externalVisible: formState.externalVisible,
    };

    if (formState.editingItem) {
      // Update existing
      updatePoolItem(formState.editingItem.number, itemData);
    } else {
      // Create new
      addPoolItem(itemData);
    }

    handleCloseForm();
  };

  const handleDeletePoolItem = (item: PoolItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${item.featureName}" from the backlog pool?`)) {
      deletePoolItem(item.number);
    }
  };

  const addedCount = addedPoolNumbers.size;
  const totalCount = poolItems.length;

  return (
    <div className="item-pool">
      <div
        className="section-header collapsible"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3>
          <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
          Backlog Pool
          <span className="pool-counter">{addedCount}/{totalCount} placed</span>
        </h3>
      </div>

      {!isCollapsed && (
        <div className="pool-content">
          {/* New Item Button */}
          <button
            className="btn btn-primary pool-new-btn"
            onClick={handleOpenNewForm}
          >
            + New Backlog Item
          </button>

          {/* Searchable Dropdown to quick-add */}
          <div className="pool-dropdown-wrapper" ref={dropdownRef}>
            <div className="pool-dropdown-trigger">
              <input
                type="text"
                className="pool-dropdown-input"
                placeholder="Search and add item to roadmap..."
                value={dropdownSearch}
                onChange={(e) => {
                  setDropdownSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
            </div>

            {showDropdown && (
              <div className="pool-dropdown-menu">
                {dropdownItems.length === 0 ? (
                  <div className="pool-dropdown-empty">No matching items</div>
                ) : (
                  dropdownItems.map((item) => (
                    <div
                      key={item.number}
                      className="pool-dropdown-option"
                      onClick={() => handleOpenAddToRoadmapDialog(item)}
                    >
                      <span
                        className="pool-category-badge"
                        style={{
                          backgroundColor: CATEGORY_COLORS[item.category]?.bg || '#f1f5f9',
                          color: CATEGORY_COLORS[item.category]?.text || '#475569',
                          borderColor: CATEGORY_COLORS[item.category]?.border || '#cbd5e1',
                        }}
                      >
                        {item.category}
                      </span>
                      <span className="pool-dropdown-name">{item.featureName}</span>
                      {item.priority && (
                        <span className={`pool-priority-badge priority-${item.priority.toLowerCase()}`}>
                          {item.priority}
                        </span>
                      )}
                      {item.ddaItem && (
                        <span className="pool-dda-badge pool-dda-badge-small">DDA</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Category filter chips */}
          <div className="pool-filters">
            <button
              className={`pool-filter-chip ${categoryFilter === '' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('')}
            >
              All ({availableItems.length})
            </button>
            {categories.map((cat) => {
              const count = availableItems.filter((i) => i.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  className={`pool-filter-chip ${categoryFilter === cat ? 'active' : ''}`}
                  style={{
                    ...(categoryFilter === cat
                      ? {
                          backgroundColor: CATEGORY_COLORS[cat]?.bg || '#f1f5f9',
                          color: CATEGORY_COLORS[cat]?.text || '#475569',
                          borderColor: CATEGORY_COLORS[cat]?.border || '#cbd5e1',
                        }
                      : {}),
                  }}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Search box for pool list */}
          <input
            type="text"
            className="pool-search"
            placeholder="Filter pool items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Pool items list */}
          <div className="pool-items-list">
            {filteredItems.length === 0 ? (
              <div className="empty-state small">
                <p>{availableItems.length === 0 ? 'All items have been added to the roadmap.' : 'No matching items found.'}</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.number}
                  className="pool-item-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  title={item.summary || item.featureName}
                >
                  <div className="pool-item-header">
                    <span
                      className="pool-category-badge"
                      style={{
                        backgroundColor: CATEGORY_COLORS[item.category]?.bg || '#f1f5f9',
                        color: CATEGORY_COLORS[item.category]?.text || '#475569',
                        borderColor: CATEGORY_COLORS[item.category]?.border || '#cbd5e1',
                      }}
                    >
                      {item.category}
                    </span>
                    <div className="pool-item-actions">
                      <button
                        className="btn-icon"
                        onClick={(e) => handleOpenEditForm(item, e)}
                        title="Edit item"
                      >
                        ✎
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={(e) => handleDeletePoolItem(item, e)}
                        title="Delete item"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="pool-item-name">{item.featureName}</div>

                  {item.summary && (
                    <div className="pool-item-summary">{item.summary}</div>
                  )}

                  <div className="pool-item-meta">
                    {item.priority && (
                      <span className={`pool-priority-badge priority-${item.priority.toLowerCase()}`}>
                        {item.priority}
                      </span>
                    )}
                    {item.complexity && (
                      <span className="pool-complexity-badge">
                        {item.complexity} ({getDefaultSprintDuration(item.complexity)}sp)
                      </span>
                    )}
                    {item.tag && (
                      <span className="pool-tag-badge">{item.tag}</span>
                    )}
                    {item.ddaItem && (
                      <span className="pool-dda-badge">DDA</span>
                    )}
                    {item.externalVisible && (
                      <span className="pool-external-badge">External</span>
                    )}
                  </div>

                  <button
                    className="btn btn-small btn-primary pool-add-btn"
                    onClick={() => handleOpenAddToRoadmapDialog(item)}
                  >
                    + Add to Roadmap
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add to Roadmap Dialog */}
      {addToRoadmapDialog?.poolItem && (
        <div className="modal-overlay" onClick={() => setAddToRoadmapDialog(null)}>
          <div className="modal-content pool-add-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add to Roadmap</h3>
            <div className="pool-add-item-info">
              <span
                className="pool-category-badge"
                style={{
                  backgroundColor: CATEGORY_COLORS[addToRoadmapDialog.poolItem.category]?.bg || '#f1f5f9',
                  color: CATEGORY_COLORS[addToRoadmapDialog.poolItem.category]?.text || '#475569',
                  borderColor: CATEGORY_COLORS[addToRoadmapDialog.poolItem.category]?.border || '#cbd5e1',
                }}
              >
                {addToRoadmapDialog.poolItem.category}
              </span>
              {addToRoadmapDialog.poolItem.ddaItem && (
                <span className="pool-dda-badge">DDA</span>
              )}
              <strong>{addToRoadmapDialog.poolItem.featureName}</strong>
            </div>
            {addToRoadmapDialog.poolItem.summary && (
              <p className="pool-add-summary">{addToRoadmapDialog.poolItem.summary}</p>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pool-start-sprint">Start Sprint</label>
                <select
                  id="pool-start-sprint"
                  value={addToRoadmapDialog.startSprint}
                  onChange={(e) =>
                    setAddToRoadmapDialog({ ...addToRoadmapDialog, startSprint: Number(e.target.value) })
                  }
                >
                  {sprintOptions.map((s) => (
                    <option key={s} value={s}>
                      Sprint {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="pool-duration">Duration (sprints)</label>
                <input
                  id="pool-duration"
                  type="number"
                  min={1}
                  max={displaySprintCount}
                  value={addToRoadmapDialog.durationSprints}
                  onChange={(e) =>
                    setAddToRoadmapDialog({
                      ...addToRoadmapDialog,
                      durationSprints: Math.max(1, Number(e.target.value)),
                    })
                  }
                />
              </div>
            </div>

            <div className="pool-add-preview">
              Sprint {addToRoadmapDialog.startSprint} - Sprint{' '}
              {addToRoadmapDialog.startSprint + addToRoadmapDialog.durationSprints - 1} ({addToRoadmapDialog.durationSprints}{' '}
              {addToRoadmapDialog.durationSprints === 1 ? 'sprint' : 'sprints'})
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleConfirmAddToRoadmap}>
                Add to Roadmap
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setAddToRoadmapDialog(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Pool Item Form */}
      {formState.isOpen && (
        <div className="modal-overlay" onClick={handleCloseForm}>
          <div className="modal-content pool-form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{formState.editingItem ? 'Edit Backlog Item' : 'New Backlog Item'}</h3>

            <div className="form-group">
              <label htmlFor="pool-form-name">Feature Name *</label>
              <input
                id="pool-form-name"
                type="text"
                value={formState.featureName}
                onChange={(e) => setFormState({ ...formState, featureName: e.target.value })}
                placeholder="Enter feature name..."
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pool-form-category">Category</label>
                <select
                  id="pool-form-category"
                  value={formState.category}
                  onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="pool-form-priority">Priority</label>
                <select
                  id="pool-form-priority"
                  value={formState.priority}
                  onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="pool-form-complexity">Complexity</label>
                <select
                  id="pool-form-complexity"
                  value={formState.complexity}
                  onChange={(e) => setFormState({ ...formState, complexity: e.target.value })}
                >
                  {COMPLEXITIES.map((c) => (
                    <option key={c} value={c}>{c} ({getDefaultSprintDuration(c)}sp)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="pool-form-summary">Summary</label>
              <textarea
                id="pool-form-summary"
                value={formState.summary}
                onChange={(e) => setFormState({ ...formState, summary: e.target.value })}
                placeholder="Brief description of the feature..."
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pool-form-tag">Tag</label>
                <input
                  id="pool-form-tag"
                  type="text"
                  value={formState.tag}
                  onChange={(e) => setFormState({ ...formState, tag: e.target.value })}
                  placeholder="e.g., New Feature"
                />
              </div>

              <div className="form-group">
                <label htmlFor="pool-form-remarks">Remarks</label>
                <input
                  id="pool-form-remarks"
                  type="text"
                  value={formState.remarks}
                  onChange={(e) => setFormState({ ...formState, remarks: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formState.externalVisible}
                  onChange={(e) => setFormState({ ...formState, externalVisible: e.target.checked })}
                />
                <span>Show in External Roadmap</span>
              </label>
              <span className="form-hint">Include this item in the external/public roadmap view</span>
            </div>

            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={handleSaveForm}
                disabled={!formState.featureName.trim()}
              >
                {formState.editingItem ? 'Save Changes' : 'Create Item'}
              </button>
              <button className="btn btn-secondary" onClick={handleCloseForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
