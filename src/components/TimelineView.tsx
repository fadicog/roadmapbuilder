import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Timeline, DataSet } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';
import html2canvas from 'html2canvas';
import { useItems, useReleaseMarkers, useCodeFreezeMarkers, useSprintConfig, useDisplaySprintCount, useRoadmapStore, useShowSprintActivities, useSelectedCategories, useShowExternalOnly } from '../store/roadmapStore';
import { SUBTASK_INFO, SUBTASK_ORDER, getEffectiveDates } from '../utils/subtaskAllocation';
import {
  generateSprints,
  formatDate,
  fromISODateString,
  countWorkingDays,
  toISODateString,
  sprintEndDate,
} from '../utils/workingDays';
import { addDays, subDays, isBefore, isAfter, format } from 'date-fns';
import type { TimelineTimeAxisScaleType } from 'vis-timeline';
import { CATEGORY_BAR_COLORS, getDefaultSprintDuration, ALL_CATEGORIES, type CategoryType } from '../data/poolItems';
import type { PoolItem } from '../types';

// Export timeline display options
type TimelineDisplayOption = 'sprints' | 'months' | 'both' | 'powerpoint';

interface TimelineItemData {
  id: string;
  group: string;
  content: string;
  start: Date;
  end: Date;
  className: string;
  title: string;
  type?: string;
  style?: string;
  editable?: boolean | { updateTime: boolean; updateGroup: boolean; remove: boolean };
  itemId?: string; // Reference to parent RoadmapItem
  subtaskId?: string; // Reference to subtask (if this is a subtask bar)
  isParentBar?: boolean; // True if this is the parent item bar
}

interface TimelineGroup {
  id: string;
  content: string;
  nestedGroups?: string[];
  className?: string;
  treeLevel?: number;
  style?: string;
}

interface AddItemModalProps {
  isOpen: boolean;
  startDate: Date;
  endDate: Date;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function AddItemModal({ isOpen, startDate, endDate, onConfirm, onCancel }: AddItemModalProps) {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
      setName('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Add New Item</h3>
        <p className="modal-dates">
          {formatDate(startDate)} - {formatDate(endDate)}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-item-name">Item Name</label>
            <input
              id="new-item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Feature"
              autoFocus
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              Add Item
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Export Options Modal
interface ExportModalProps {
  isOpen: boolean;
  onConfirm: (option: TimelineDisplayOption, exportCategories: CategoryType[], exportExternalOnly: boolean) => void;
  onCancel: () => void;
}

function ExportModal({ isOpen, onConfirm, onCancel }: ExportModalProps) {
  const [selectedOption, setSelectedOption] = useState<TimelineDisplayOption>('both');
  const [exportCategories, setExportCategories] = useState<CategoryType[]>([...ALL_CATEGORIES]);
  const [exportExternalOnly, setExportExternalOnly] = useState(false);

  if (!isOpen) return null;

  const handleToggleCategory = (category: CategoryType) => {
    if (exportCategories.includes(category)) {
      setExportCategories(exportCategories.filter(c => c !== category));
    } else {
      setExportCategories([...exportCategories, category]);
    }
  };

  const handleSelectAll = () => {
    setExportCategories([...ALL_CATEGORIES]);
  };

  const handleDeselectAll = () => {
    setExportCategories([]);
  };

  const allSelected = exportCategories.length === ALL_CATEGORIES.length;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content export-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Export Roadmap</h3>
        <p className="export-description">
          Export the roadmap as a high-quality PNG image suitable for PowerPoint presentations.
        </p>
        <div className="form-group">
          <label>Timeline Display</label>
          <div className="export-options">
            <label className="export-option">
              <input
                type="radio"
                name="timeline-display"
                value="sprints"
                checked={selectedOption === 'sprints'}
                onChange={() => setSelectedOption('sprints')}
              />
              <span className="export-option-label">Sprints only</span>
              <span className="export-option-desc">Show sprint numbers (Sprint 71, Sprint 72, ...)</span>
            </label>
            <label className="export-option">
              <input
                type="radio"
                name="timeline-display"
                value="months"
                checked={selectedOption === 'months'}
                onChange={() => setSelectedOption('months')}
              />
              <span className="export-option-label">Months only</span>
              <span className="export-option-desc">Show calendar months (Jan 2026, Feb 2026, ...)</span>
            </label>
            <label className="export-option">
              <input
                type="radio"
                name="timeline-display"
                value="both"
                checked={selectedOption === 'both'}
                onChange={() => setSelectedOption('both')}
              />
              <span className="export-option-label">Both Sprints and Months</span>
              <span className="export-option-desc">Show sprint numbers with month labels</span>
            </label>
            <label className="export-option">
              <input
                type="radio"
                name="timeline-display"
                value="powerpoint"
                checked={selectedOption === 'powerpoint'}
                onChange={() => setSelectedOption('powerpoint')}
              />
              <span className="export-option-label">PowerPoint (Recommended)</span>
              <span className="export-option-desc">Clean one-page layout optimized for presentations</span>
            </label>
          </div>
        </div>
        <div className="form-group">
          <div className="export-category-header">
            <label>Categories to Include</label>
            <button
              type="button"
              className="btn btn-text btn-small"
              onClick={allSelected ? handleDeselectAll : handleSelectAll}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="export-category-checkboxes">
            {ALL_CATEGORIES.map((category) => {
              const color = CATEGORY_BAR_COLORS[category];
              const isChecked = exportCategories.includes(category);
              return (
                <label key={category} className="export-category-checkbox">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleCategory(category)}
                  />
                  <span
                    className="export-category-color"
                    style={{ backgroundColor: color }}
                  />
                  <span className="export-category-name">{category}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="form-group">
          <label className="export-external-checkbox">
            <input
              type="checkbox"
              checked={exportExternalOnly}
              onChange={(e) => setExportExternalOnly(e.target.checked)}
            />
            <span>Export External Roadmap Only</span>
          </label>
          <span className="export-hint">Only include items marked for external/public visibility</span>
        </div>
        <div className="export-info">
          <span>Output: 1920 x 1080 PNG (16:9)</span>
        </div>
        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={() => onConfirm(selectedOption, exportCategories, exportExternalOnly)}
            disabled={exportCategories.length === 0}
          >
            Export Image
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Category Filter Component
interface CategoryFilterProps {
  selectedCategories: CategoryType[];
  onToggleCategory: (category: CategoryType) => void;
  onClearAll: () => void;
}

function CategoryFilter({ selectedCategories, onToggleCategory, onClearAll }: CategoryFilterProps) {
  const allSelected = selectedCategories.length === 0;

  return (
    <div className="category-filter">
      <div className="category-filter-header">
        <span className="category-filter-label">Filter by Category:</span>
        <div className="category-filter-actions">
          <button
            className={`btn btn-text btn-small ${allSelected ? 'active' : ''}`}
            onClick={onClearAll}
          >
            All
          </button>
        </div>
      </div>
      <div className="category-filter-chips">
        {ALL_CATEGORIES.map((category) => {
          const isSelected = allSelected || selectedCategories.includes(category);
          const color = CATEGORY_BAR_COLORS[category];
          return (
            <button
              key={category}
              className={`category-chip ${isSelected ? 'selected' : ''}`}
              onClick={() => onToggleCategory(category)}
              style={{
                '--chip-color': color,
                '--chip-bg': isSelected ? color : 'transparent',
              } as React.CSSProperties}
            >
              <span className="category-chip-dot" style={{ backgroundColor: color }} />
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimelineView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const sprintBandsContentRef = useRef<HTMLDivElement>(null);

  const allItems = useItems();
  const releaseMarkers = useReleaseMarkers();
  const codeFreezeMarkers = useCodeFreezeMarkers();
  const sprintConfig = useSprintConfig();
  const displaySprintCount = useDisplaySprintCount();
  const { updateSubtaskOverride, updateItem, addItemByDate, addFromPool, setShowSprintActivities, toggleCategory, setSelectedCategories, setShowExternalOnly } = useRoadmapStore();
  const showSprintActivities = useShowSprintActivities();
  const selectedCategories = useSelectedCategories();
  const showExternalOnly = useShowExternalOnly();

  // Track which item is in edit mode
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Modal state for adding new items
  const [addModalState, setAddModalState] = useState<{
    isOpen: boolean;
    startDate: Date;
    endDate: Date;
  }>({
    isOpen: false,
    startDate: new Date(),
    endDate: new Date(),
  });

  // Pool drop state
  const [poolDropState, setPoolDropState] = useState<{
    isOpen: boolean;
    poolItem: PoolItem | null;
    startSprint: number;
    durationSprints: number;
  }>({
    isOpen: false,
    poolItem: null,
    startSprint: sprintConfig.firstSprintNumber,
    durationSprints: 2,
  });

  const [isDragOver, setIsDragOver] = useState(false);

  // Filter items by selected categories and external visibility
  const items = useMemo(() => {
    let filteredItems = allItems;

    // Filter by external visibility if enabled
    if (showExternalOnly) {
      filteredItems = filteredItems.filter((item) => item.externalVisible === true);
    }

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      filteredItems = filteredItems.filter((item) => {
        if (!item.category) return true; // Show items without category
        return selectedCategories.includes(item.category as CategoryType);
      });
    }

    return filteredItems;
  }, [allItems, selectedCategories, showExternalOnly]);

  // Generate sprint data
  const sprints = useMemo(
    () => generateSprints(sprintConfig.firstSprintNumber, displaySprintCount, sprintConfig),
    [sprintConfig, displaySprintCount]
  );

  // Calculate timeline range
  const timelineRange = useMemo(() => {
    if (sprints.length === 0) return { start: new Date(), end: new Date() };
    const start = addDays(sprints[0].startDate, -2);
    const end = addDays(sprints[sprints.length - 1].endDate, 2);
    return { start, end };
  }, [sprints]);

  // Build timeline groups
  const groups = useMemo(() => {
    const result: TimelineGroup[] = [];

    items.forEach((item) => {
      // Parent group for the item (with its own bar)
      result.push({
        id: `parent-${item.id}`,
        content: `<div class="group-label" title="${item.name}">${item.name}</div>`,
        className: 'item-group parent-item-group',
      });

      // Only add subtask groups if showSprintActivities is true
      if (showSprintActivities) {
        const orderedSubtasks = SUBTASK_ORDER.map(type =>
          item.subtasks.find(st => st.type === type)
        ).filter(Boolean);

        // Nested groups for subtasks
        orderedSubtasks.forEach((subtask) => {
          if (!subtask) return;
          const info = SUBTASK_INFO[subtask.type];
          result.push({
            id: `${item.id}-${subtask.id}`,
            content: `<span class="subtask-group-label">${info.label}</span>`,
            className: 'subtask-group',
          });
        });
      }
    });

    return result;
  }, [items, showSprintActivities]);

  // Build timeline items (parent bars + subtask bars)
  const timelineItems = useMemo(() => {
    const result: TimelineItemData[] = [];

    items.forEach((item) => {
      // Get item date range
      let itemStartDate: Date;
      let itemEndDate: Date;

      if (item.startSprint !== undefined && item.endSprint !== undefined) {
        const sprintStart = sprints.find(s => s.number === item.startSprint);
        const sprintEnd = sprints.find(s => s.number === item.endSprint);
        itemStartDate = sprintStart?.startDate || new Date();
        itemEndDate = sprintEnd?.endDate || new Date();
      } else if (item.startDate && item.endDate) {
        itemStartDate = fromISODateString(item.startDate);
        itemEndDate = fromISODateString(item.endDate);
      } else {
        itemStartDate = new Date();
        itemEndDate = new Date();
      }

      const isEditing = editingItemId === item.id || editingItemId === `parent-${item.id}`;
      const isDdaItem = item.ddaItem === true;

      // Parent item bar (shows the overall item duration) with category color
      const categoryColor = item.category ? CATEGORY_BAR_COLORS[item.category] || '#94a3b8' : '#94a3b8';
      const categoryDarker = item.category ? categoryColor : '#64748b';

      // Build class list including DDA indicator
      const parentBarClasses = [
        'parent-bar',
        isEditing ? 'editing' : '',
        isDdaItem ? 'dda-item' : '',
      ].filter(Boolean).join(' ');

      result.push({
        id: `parent-${item.id}`,
        group: `parent-${item.id}`,
        content: `<span class="parent-bar-content">${isDdaItem ? '<span class="dda-badge">DDA</span>' : ''}${item.name}</span>`,
        start: itemStartDate,
        end: addDays(itemEndDate, 1),
        className: parentBarClasses,
        title: `
          <strong>${item.name}</strong><br/>
          ${item.category ? `<em>${item.category}</em><br/>` : ''}
          ${isDdaItem ? '<strong style="color: #f97316;">DDA related</strong><br/>' : ''}
          ${formatDate(itemStartDate)} - ${formatDate(itemEndDate)}<br/>
          <em>Double-click to edit</em>
        `,
        style: `background-color: ${categoryColor}; border-color: ${categoryDarker};`,
        editable: isEditing ? {
          updateTime: true,
          updateGroup: false,
          remove: false,
        } : false,
        itemId: item.id,
        isParentBar: true,
      });

      // Subtask bars (only if showSprintActivities is true)
      if (showSprintActivities) {
        SUBTASK_ORDER.forEach((subtaskType) => {
          const subtask = item.subtasks.find(st => st.type === subtaskType);
          if (!subtask) return;

          const info = SUBTASK_INFO[subtask.type];
          const { start, end } = getEffectiveDates(subtask);
          const startDate = fromISODateString(start);
          const endDate = fromISODateString(end);
          const workingDays = countWorkingDays(startDate, endDate);
          const displayEnd = addDays(endDate, 1);

          const subtaskIsEditing = editingItemId === `${item.id}-${subtask.id}`;

          result.push({
            id: `${item.id}-${subtask.id}`,
            group: `${item.id}-${subtask.id}`,
            content: '',
            start: startDate,
            end: displayEnd,
            className: `subtask-bar subtask-${subtask.type.toLowerCase()} ${subtaskIsEditing ? 'editing' : ''}`,
            title: `
              <strong>${item.name}</strong><br/>
              ${info.label}<br/>
              ${formatDate(start)} - ${formatDate(end)}<br/>
              ${workingDays} working days<br/>
              <em>Double-click to edit</em>
            `,
            style: `background-color: ${info.color}; border-color: ${info.color};`,
            editable: subtaskIsEditing ? {
              updateTime: true,
              updateGroup: false,
              remove: false,
            } : false,
            itemId: item.id,
            subtaskId: subtask.id,
          });
        });
      }
    });

    return result;
  }, [items, sprints, editingItemId, showSprintActivities]);

  // Build custom time markers for releases
  const customTimes = useMemo(() => {
    const times: { id: string; time: Date; title: string; type: 'release' | 'codefreeze' }[] = [];
    releaseMarkers.forEach((marker) => {
      times.push({
        id: marker.id,
        time: fromISODateString(marker.date),
        title: marker.name,
        type: 'release',
      });
    });
    return times;
  }, [releaseMarkers]);

  // Build custom time markers for code freezes (at the END of the sprint)
  const codeFreezeCustomTimes = useMemo(() => {
    const times: { id: string; time: Date; title: string }[] = [];
    codeFreezeMarkers.forEach((marker) => {
      // Get the end date of the sprint and add 1 day to position it right after the sprint
      const freezeDate = sprintEndDate(marker.afterSprint, sprintConfig);
      times.push({
        id: `codefreeze-${marker.id}`,
        time: freezeDate,
        title: marker.name,
      });
    });
    return times;
  }, [codeFreezeMarkers, sprintConfig]);

  // Handle double-click to enter edit mode
  const handleDoubleClick = useCallback((properties: any) => {
    if (properties.item) {
      setEditingItemId(properties.item);
    } else if (properties.time) {
      // Double-click on empty area - open add item modal
      const clickTime = new Date(properties.time);
      setAddModalState({
        isOpen: true,
        startDate: clickTime,
        endDate: addDays(clickTime, 13), // Default ~2 weeks
      });
    }
  }, []);

  // Handle click to exit edit mode
  const handleClick = useCallback((properties: any) => {
    // If clicking on a different item or empty space, exit edit mode
    if (editingItemId && properties.item !== editingItemId) {
      setEditingItemId(null);
    }
  }, [editingItemId]);

  // Handle item move/resize
  const handleItemMove = useCallback((itemData: any, callback: (item: any) => void) => {
    const timelineItem = timelineItems.find(ti => ti.id === itemData.id);
    if (!timelineItem) {
      callback(null);
      return;
    }

    const newStart = new Date(itemData.start);
    const newEnd = subDays(new Date(itemData.end), 1); // vis-timeline end is exclusive

    if (timelineItem.isParentBar) {
      // Moving/resizing parent bar - update item dates
      const roadmapItem = items.find(i => i.id === timelineItem.itemId);
      if (!roadmapItem) {
        callback(null);
        return;
      }

      // Update item with new dates
      updateItem(timelineItem.itemId!, {
        startDate: toISODateString(newStart),
        endDate: toISODateString(newEnd),
        // Clear sprint values since we're now using dates
        startSprint: undefined,
        endSprint: undefined,
      });

      callback(itemData);
    } else if (timelineItem.subtaskId) {
      // Moving/resizing subtask bar
      const roadmapItem = items.find(i => i.id === timelineItem.itemId);
      if (!roadmapItem) {
        callback(null);
        return;
      }

      // Get current parent item bounds
      let parentStart: Date;
      let parentEnd: Date;

      if (roadmapItem.startSprint !== undefined && roadmapItem.endSprint !== undefined) {
        const sprintStart = sprints.find(s => s.number === roadmapItem.startSprint);
        const sprintEnd = sprints.find(s => s.number === roadmapItem.endSprint);
        parentStart = sprintStart?.startDate || new Date();
        parentEnd = sprintEnd?.endDate || new Date();
      } else if (roadmapItem.startDate && roadmapItem.endDate) {
        parentStart = fromISODateString(roadmapItem.startDate);
        parentEnd = fromISODateString(roadmapItem.endDate);
      } else {
        callback(null);
        return;
      }

      // Check if subtask extends beyond parent - if so, expand parent
      let needsParentUpdate = false;
      let newParentStart = parentStart;
      let newParentEnd = parentEnd;

      if (isBefore(newStart, parentStart)) {
        newParentStart = newStart;
        needsParentUpdate = true;
      }

      if (isAfter(newEnd, parentEnd)) {
        newParentEnd = newEnd;
        needsParentUpdate = true;
      }

      // Update parent if needed
      if (needsParentUpdate) {
        updateItem(timelineItem.itemId!, {
          startDate: toISODateString(newParentStart),
          endDate: toISODateString(newParentEnd),
          startSprint: undefined,
          endSprint: undefined,
        });
      }

      // Update the subtask override
      updateSubtaskOverride(
        timelineItem.itemId!,
        timelineItem.subtaskId,
        toISODateString(newStart),
        toISODateString(newEnd)
      );

      callback(itemData);
    } else {
      callback(null);
    }
  }, [timelineItems, items, sprints, updateItem, updateSubtaskOverride]);

  // Handle adding new item from timeline
  const handleConfirmAddItem = useCallback((name: string) => {
    const { startDate, endDate } = addModalState;
    addItemByDate(name, toISODateString(startDate), toISODateString(endDate));
    setAddModalState({
      isOpen: false,
      startDate: new Date(),
      endDate: new Date(),
    });
  }, [addModalState, addItemByDate]);

  const handleCancelAddItem = useCallback(() => {
    setAddModalState({
      isOpen: false,
      startDate: new Date(),
      endDate: new Date(),
    });
  }, []);

  // Pool drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/pool-item')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const data = e.dataTransfer.getData('application/pool-item');
    if (!data) return;

    try {
      const poolItem: PoolItem = JSON.parse(data);
      setPoolDropState({
        isOpen: true,
        poolItem,
        startSprint: sprintConfig.firstSprintNumber,
        durationSprints: getDefaultSprintDuration(poolItem.complexity),
      });
    } catch {
      // Invalid data
    }
  }, [sprintConfig.firstSprintNumber]);

  const handleConfirmPoolDrop = useCallback(() => {
    if (!poolDropState.poolItem) return;

    addFromPool(
      poolDropState.poolItem.featureName,
      poolDropState.startSprint,
      poolDropState.durationSprints,
      poolDropState.poolItem.number,
      poolDropState.poolItem.category,
      poolDropState.poolItem.priority,
      poolDropState.poolItem.complexity,
      poolDropState.poolItem.ddaItem
    );

    setPoolDropState({
      isOpen: false,
      poolItem: null,
      startSprint: sprintConfig.firstSprintNumber,
      durationSprints: 2,
    });
  }, [poolDropState, addFromPool, sprintConfig.firstSprintNumber]);

  const handleCancelPoolDrop = useCallback(() => {
    setPoolDropState({
      isOpen: false,
      poolItem: null,
      startSprint: sprintConfig.firstSprintNumber,
      durationSprints: 2,
    });
  }, [sprintConfig.firstSprintNumber]);

  // Stable ref so the rangechange listener always calls the latest version
  // without needing to rebind the event.
  const updateSprintBandsRef = useRef<() => void>(() => {});

  // Update sprint band positions to match the timeline's visible range.
  // Uses direct DOM manipulation for performance (rangechange fires continuously).
  // The bands content is positioned to exactly overlay the vis-timeline center panel
  // so that percentage-based sprint positions map 1:1 to the date axis.
  const updateSprintBands = useCallback(() => {
    const timeline = timelineRef.current;
    const bandsContent = sprintBandsContentRef.current;
    if (!timeline || !bandsContent) return;

    const window = timeline.getWindow();
    const rangeStart = window.start.getTime();
    const rangeEnd = window.end.getTime();
    const rangeMs = rangeEnd - rangeStart;
    if (rangeMs <= 0) return;

    // Match the sprint bands container to the vis-timeline center panel exactly.
    // vis-timeline DOM: .vis-panel.vis-left (group labels) + .vis-panel.vis-center (date content)
    const centerPanel = containerRef.current?.querySelector('.vis-panel.vis-center');
    if (centerPanel) {
      const centerEl = centerPanel as HTMLElement;
      // Use the center panel's offset and width so sprint bands sit directly above the dates.
      bandsContent.style.left = `${centerEl.offsetLeft}px`;
      bandsContent.style.width = `${centerEl.offsetWidth}px`;
    } else {
      // Fallback: use left panel offset
      const leftPanel = containerRef.current?.querySelector('.vis-panel.vis-left');
      const leftWidth = leftPanel ? (leftPanel as HTMLElement).offsetWidth : 0;
      bandsContent.style.left = `${leftWidth}px`;
      bandsContent.style.width = `calc(100% - ${leftWidth}px)`;
    }

    const bands = bandsContent.children;
    for (let i = 0; i < bands.length && i < sprints.length; i++) {
      const sprint = sprints[i];
      const el = bands[i] as HTMLElement;

      const sprintStartMs = sprint.startDate.getTime();
      // Add 1 day (ms) so the band visually covers through the last calendar day
      const sprintEndMs = sprint.endDate.getTime() + 86400000;

      const leftPct = ((sprintStartMs - rangeStart) / rangeMs) * 100;
      const widthPct = ((sprintEndMs - sprintStartMs) / rangeMs) * 100;

      el.style.left = `${leftPct}%`;
      el.style.width = `${widthPct}%`;

      // Hide if completely out of view
      if (leftPct + widthPct < -5 || leftPct > 105) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }

      // Collapse label when band is too narrow
      const label = `Sprint ${sprint.number}`;
      const shortLabel = `S${sprint.number}`;
      if (widthPct < 1.5) {
        el.textContent = '';
      } else if (widthPct < 4) {
        el.textContent = shortLabel;
      } else {
        el.textContent = label;
      }
    }
  }, [sprints]);

  // Keep the ref current
  updateSprintBandsRef.current = updateSprintBands;

  // Initialize timeline
  useEffect(() => {
    if (!containerRef.current) return;

    const groupsDataSet = new DataSet(groups);
    const itemsDataSet = new DataSet(timelineItems);

    const options = {
      start: timelineRange.start,
      end: timelineRange.end,
      min: addDays(timelineRange.start, -30),
      max: addDays(timelineRange.end, 30),
      stack: false,
      showCurrentTime: true,
      orientation: { axis: 'top', item: 'top' },
      margin: {
        item: { horizontal: 0, vertical: 3 },
      },
      zoomMin: 1000 * 60 * 60 * 24 * 7,
      zoomMax: 1000 * 60 * 60 * 24 * 365,
      tooltip: {
        followMouse: true,
        overflowMethod: 'cap' as const,
      },
      format: {
        minorLabels: {
          day: 'D',
          weekday: 'ddd D',
          month: 'MMM',
        },
        majorLabels: {
          day: 'MMMM YYYY',
          week: 'MMMM YYYY',
          month: 'YYYY',
        },
      },
      timeAxis: { scale: 'day' as TimelineTimeAxisScaleType, step: 1 },
      editable: {
        add: false,
        updateTime: true,
        updateGroup: false,
        remove: false,
        overrideItems: true, // Allow per-item editable settings
      },
      snap: (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      },
      onMove: handleItemMove,
    };

    const timeline = new Timeline(containerRef.current, itemsDataSet, groupsDataSet, options);
    timelineRef.current = timeline;

    // Add event listeners
    timeline.on('doubleClick', handleDoubleClick);
    timeline.on('click', handleClick);

    // Sync sprint bands on every range change (zoom/pan).
    // Uses ref so the handler always calls the latest version of updateSprintBands.
    const onRangeChange = () => updateSprintBandsRef.current();
    timeline.on('rangechange', onRangeChange);
    timeline.on('rangechanged', onRangeChange);

    // Add custom times for release markers
    customTimes.forEach((ct) => {
      try {
        timeline.addCustomTime(ct.time, ct.id);
        timeline.setCustomTimeTitle(ct.title, ct.id);
      } catch (e) {
        // Custom time might already exist
      }
    });

    // Add custom times for code freeze markers
    codeFreezeCustomTimes.forEach((ct) => {
      try {
        timeline.addCustomTime(ct.time, ct.id);
        timeline.setCustomTimeTitle(ct.title, ct.id);
      } catch (e) {
        // Custom time might already exist
      }
    });

    // Apply code freeze styling to custom time elements
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (container) {
        // Find all custom time elements and style the code freeze ones
        const customTimeElements = container.querySelectorAll('.vis-custom-time');
        customTimeElements.forEach((el) => {
          const marker = el.querySelector('.vis-custom-time-marker');
          if (marker) {
            const title = marker.textContent || '';
            const isCodeFreeze = codeFreezeCustomTimes.some((ct) => ct.title === title);
            if (isCodeFreeze) {
              el.classList.add('vis-custom-time-codefreeze');
            }
          }
        });
      }
    });

    // Initial sprint band position
    requestAnimationFrame(() => updateSprintBandsRef.current());

    // Re-sync sprint bands on container resize (handles window/panel resize)
    const resizeObserver = new ResizeObserver(() => {
      updateSprintBandsRef.current();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      timeline.off('doubleClick', handleDoubleClick);
      timeline.off('click', handleClick);
      timeline.off('rangechange', onRangeChange);
      timeline.off('rangechanged', onRangeChange);
      timeline.destroy();
      timelineRef.current = null;
    };
  }, []);

  // Update timeline when data changes
  useEffect(() => {
    if (!timelineRef.current) return;

    const timeline = timelineRef.current;

    const groupsDataSet = new DataSet(groups);
    timeline.setGroups(groupsDataSet);

    const itemsDataSet = new DataSet(timelineItems);
    timeline.setItems(itemsDataSet);

    timeline.setOptions({
      min: addDays(timelineRange.start, -30),
      max: addDays(timelineRange.end, 30),
      onMove: handleItemMove,
    });

    // Update event listeners
    timeline.off('doubleClick', handleDoubleClick);
    timeline.off('click', handleClick);
    timeline.on('doubleClick', handleDoubleClick);
    timeline.on('click', handleClick);

    // Update custom times for releases
    releaseMarkers.forEach((marker) => {
      try {
        timeline.removeCustomTime(marker.id);
      } catch (e) {}
    });

    customTimes.forEach((ct) => {
      try {
        timeline.addCustomTime(ct.time, ct.id);
        timeline.setCustomTimeTitle(ct.title, ct.id);
      } catch (e) {}
    });

    // Update custom times for code freezes
    codeFreezeMarkers.forEach((marker) => {
      try {
        timeline.removeCustomTime(`codefreeze-${marker.id}`);
      } catch (e) {}
    });

    codeFreezeCustomTimes.forEach((ct) => {
      try {
        timeline.addCustomTime(ct.time, ct.id);
        timeline.setCustomTimeTitle(ct.title, ct.id);
      } catch (e) {}
    });

    // Apply code freeze styling to custom time elements
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (container) {
        // Find all custom time elements and style the code freeze ones
        const customTimeElements = container.querySelectorAll('.vis-custom-time');
        customTimeElements.forEach((el) => {
          const marker = el.querySelector('.vis-custom-time-marker');
          if (marker) {
            const title = marker.textContent || '';
            const isCodeFreeze = codeFreezeCustomTimes.some((ct) => ct.title === title);
            if (isCodeFreeze) {
              el.classList.add('vis-custom-time-codefreeze');
            } else {
              el.classList.remove('vis-custom-time-codefreeze');
            }
          }
        });
      }
    });

    if (items.length > 0) {
      timeline.fit();
    } else {
      timeline.setWindow(timelineRange.start, timelineRange.end);
    }

    // Re-sync sprint bands after data update
    requestAnimationFrame(() => updateSprintBands());
  }, [groups, timelineItems, customTimes, codeFreezeMarkers, codeFreezeCustomTimes, timelineRange, items.length, handleItemMove, handleDoubleClick, handleClick, updateSprintBands]);

  // Handle export
  const handleExport = useCallback(async (option: TimelineDisplayOption, exportCategories: CategoryType[], exportExternalOnly: boolean) => {
    setExportModalOpen(false);
    setIsExporting(true);

    try {
      // Filter items by selected export categories and external visibility (use allItems, not filtered items)
      let exportItems = allItems;

      // Filter by external visibility if enabled
      if (exportExternalOnly) {
        exportItems = exportItems.filter((item) => item.externalVisible === true);
      }

      // Filter by selected categories
      exportItems = exportItems.filter((item) => {
        if (!item.category) return true; // Include items without category
        return exportCategories.includes(item.category as CategoryType);
      });

      // Create a temporary container for export
      const exportContainer = document.createElement('div');
      exportContainer.className = 'export-container';
      exportContainer.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: 1920px;
        height: 1080px;
        background: white;
        padding: 40px 48px 48px 48px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      `;
      document.body.appendChild(exportContainer);

      // PowerPoint export - optimized for one-page presentation
      if (option === 'powerpoint') {
        // Build PowerPoint-friendly layout
        const title = document.createElement('div');
        title.style.cssText = `
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 20px;
          color: #1e293b;
        `;
        title.textContent = 'Sprint Roadmap';
        exportContainer.appendChild(title);

        // Build month-only timeline header
        const timelineHeader = document.createElement('div');
        timelineHeader.style.cssText = `
          display: flex;
          align-items: center;
          height: 32px;
          border-bottom: 2px solid #e2e8f0;
          margin-bottom: 4px;
        `;

        // Labels column spacer with right border separator
        const labelSpacer = document.createElement('div');
        labelSpacer.style.cssText = `
          width: 220px;
          flex-shrink: 0;
          border-right: 2px solid #cbd5e1;
          margin-right: 8px;
        `;
        timelineHeader.appendChild(labelSpacer);

        // Group sprints by month
        const monthGroups: { month: string; count: number; startIdx: number }[] = [];
        let currentMonth = '';
        sprints.forEach((sprint, idx) => {
          const monthLabel = format(sprint.startDate, 'MMM yyyy');
          if (monthLabel !== currentMonth) {
            monthGroups.push({ month: monthLabel, count: 1, startIdx: idx });
            currentMonth = monthLabel;
          } else {
            monthGroups[monthGroups.length - 1].count++;
          }
        });

        // Calculate width per sprint for timeline area
        const timelineWidth = 1920 - 96 - 220 - 10; // Total - padding(96) - labels column - separator margin
        const sprintWidth = timelineWidth / sprints.length;

        // Month cells
        const monthsContainer = document.createElement('div');
        monthsContainer.style.cssText = `
          display: flex;
          flex: 1;
        `;
        monthGroups.forEach((group, idx) => {
          const monthCell = document.createElement('div');
          monthCell.style.cssText = `
            width: ${group.count * sprintWidth}px;
            text-align: center;
            font-size: 13px;
            font-weight: 600;
            color: #475569;
            padding: 4px 0;
            ${idx < monthGroups.length - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}
          `;
          monthCell.textContent = group.month;
          monthsContainer.appendChild(monthCell);
        });
        timelineHeader.appendChild(monthsContainer);
        exportContainer.appendChild(timelineHeader);

        // Calculate row height based on item count (max 30 items fit comfortably)
        const maxItems = 30;
        const availableHeight = 1080 - 48 - 32 - 20 - 32 - 4 - 60 - 48; // Total - padding(48) - title - margin - header - headerMargin - legend - bottomPadding(48)
        const rowHeight = Math.min(36, Math.max(28, Math.floor(availableHeight / Math.min(exportItems.length, maxItems))));

        // Build roadmap items with a wrapper for the single vertical separator line
        const itemsWrapper = document.createElement('div');
        itemsWrapper.style.cssText = `
          flex: 1;
          overflow: hidden;
          display: flex;
          position: relative;
        `;

        // Labels column container
        const labelsColumn = document.createElement('div');
        labelsColumn.style.cssText = `
          width: 220px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          border-right: 2px solid #cbd5e1;
        `;

        // Roadmap bars container
        const barsColumn = document.createElement('div');
        barsColumn.style.cssText = `
          flex: 1;
          display: flex;
          flex-direction: column;
          margin-left: 8px;
        `;

        exportItems.forEach((item) => {
          // Item label
          const label = document.createElement('div');
          label.style.cssText = `
            min-height: ${rowHeight}px;
            padding: 2px 12px 2px 0;
            font-size: 12px;
            font-weight: 500;
            color: #334155;
            display: flex;
            align-items: center;
            border-bottom: 1px solid #f1f5f9;
          `;
          const labelText = document.createElement('span');
          labelText.style.cssText = `
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.3;
          `;
          labelText.textContent = item.name;
          label.appendChild(labelText);
          labelsColumn.appendChild(label);

          // Item bar row
          const barRow = document.createElement('div');
          barRow.style.cssText = `
            min-height: ${rowHeight}px;
            position: relative;
            border-bottom: 1px solid #f1f5f9;
          `;

          // Calculate bar position
          let startSprintIdx = 0;
          let endSprintIdx = sprints.length - 1;

          if (item.startSprint !== undefined && item.endSprint !== undefined) {
            startSprintIdx = Math.max(0, item.startSprint - sprintConfig.firstSprintNumber);
            endSprintIdx = Math.min(sprints.length - 1, item.endSprint - sprintConfig.firstSprintNumber);
          } else if (item.startDate && item.endDate) {
            const itemStart = fromISODateString(item.startDate);
            const itemEnd = fromISODateString(item.endDate);
            for (let i = 0; i < sprints.length; i++) {
              if (sprints[i].startDate <= itemStart) startSprintIdx = i;
              if (sprints[i].endDate >= itemEnd) {
                endSprintIdx = i;
                break;
              }
            }
          }

          const barLeft = startSprintIdx * sprintWidth;
          const barWidth = Math.max(20, (endSprintIdx - startSprintIdx + 1) * sprintWidth - 4);
          const categoryColor = item.category ? CATEGORY_BAR_COLORS[item.category] || '#94a3b8' : '#94a3b8';
          const barHeight = Math.min(22, rowHeight - 6);
          const barTop = (rowHeight - barHeight) / 2;

          const bar = document.createElement('div');
          bar.style.cssText = `
            position: absolute;
            left: ${barLeft + 2}px;
            top: ${barTop}px;
            width: ${barWidth}px;
            height: ${barHeight}px;
            background: ${categoryColor};
            border-radius: 3px;
            display: flex;
            align-items: center;
            padding: 0 6px;
            font-size: 9px;
            font-weight: 600;
            color: white;
            text-shadow: 0 1px 1px rgba(0,0,0,0.2);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            ${item.ddaItem ? 'border: 2px dashed #f97316;' : ''}
          `;
          bar.textContent = item.name;
          barRow.appendChild(bar);

          barsColumn.appendChild(barRow);
        });

        itemsWrapper.appendChild(labelsColumn);
        itemsWrapper.appendChild(barsColumn);
        exportContainer.appendChild(itemsWrapper);

        // Build compact legend
        const legend = document.createElement('div');
        legend.style.cssText = `
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-top: auto;
          padding-top: 12px;
        `;

        exportCategories.forEach((cat) => {
          const color = CATEGORY_BAR_COLORS[cat];
          if (!color) return;
          const legendItem = document.createElement('div');
          legendItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #475569;
          `;
          const colorBox = document.createElement('span');
          colorBox.style.cssText = `
            width: 16px;
            height: 16px;
            border-radius: 3px;
            background: ${color};
          `;
          legendItem.appendChild(colorBox);
          legendItem.appendChild(document.createTextNode(cat));
          legend.appendChild(legendItem);
        });

        // DDA indicator
        const ddaLegendItem = document.createElement('div');
        ddaLegendItem.style.cssText = `
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #475569;
        `;
        const ddaIndicator = document.createElement('span');
        ddaIndicator.style.cssText = `
          width: 16px;
          height: 12px;
          border: 2px dashed #f97316;
          border-radius: 2px;
          background: #fff7ed;
        `;
        ddaLegendItem.appendChild(ddaIndicator);
        ddaLegendItem.appendChild(document.createTextNode('DDA related'));
        legend.appendChild(ddaLegendItem);

        exportContainer.appendChild(legend);
      } else {
        // Standard export (sprints/months/both)
        const title = document.createElement('div');
        title.style.cssText = `
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #1e293b;
        `;
        title.textContent = 'Sprint Roadmap';
        exportContainer.appendChild(title);

        // Build timeline header with sprint/month labels
        const timelineHeader = document.createElement('div');
        timelineHeader.style.cssText = `
          display: flex;
          background: #f1f5f9;
          border-radius: 4px;
          margin-bottom: 8px;
          overflow: hidden;
        `;

        // Calculate width per sprint (account for separator margin)
        const sprintWidth = (1920 - 96 - 200 - 10) / sprints.length; // Total - padding(96) - labels column - separator margin

        if (option === 'months' || option === 'both') {
          // Group sprints by month
          const monthGroups: { month: string; count: number }[] = [];
          let currentMonth = '';
          sprints.forEach((sprint) => {
            const monthLabel = format(sprint.startDate, 'MMM yyyy');
            if (monthLabel !== currentMonth) {
              monthGroups.push({ month: monthLabel, count: 1 });
              currentMonth = monthLabel;
            } else {
              monthGroups[monthGroups.length - 1].count++;
            }
          });

          const monthsRow = document.createElement('div');
          monthsRow.style.cssText = `
            display: flex;
            margin-left: 210px;
          `;
          monthGroups.forEach((group) => {
            const monthCell = document.createElement('div');
            monthCell.style.cssText = `
              width: ${group.count * sprintWidth}px;
              text-align: center;
              font-size: 12px;
              font-weight: 600;
              color: #64748b;
              padding: 6px 0;
              border-right: 1px solid #e2e8f0;
            `;
            monthCell.textContent = group.month;
            monthsRow.appendChild(monthCell);
          });
          timelineHeader.appendChild(monthsRow);
        }

        if (option === 'sprints' || option === 'both') {
          const sprintsRow = document.createElement('div');
          sprintsRow.style.cssText = `
            display: flex;
            margin-left: 210px;
            background: ${option === 'both' ? '#e2e8f0' : 'transparent'};
          `;
          sprints.forEach((sprint, idx) => {
            const sprintCell = document.createElement('div');
            sprintCell.style.cssText = `
              width: ${sprintWidth}px;
              text-align: center;
              font-size: 11px;
              font-weight: 500;
              color: #64748b;
              padding: 4px 0;
              background: ${idx % 2 === 0 ? '#f8fafc' : 'transparent'};
              border-right: 1px solid #e2e8f0;
            `;
            sprintCell.textContent = `S${sprint.number}`;
            sprintsRow.appendChild(sprintCell);
          });
          timelineHeader.appendChild(sprintsRow);
        }

        exportContainer.appendChild(timelineHeader);

        // Build roadmap items with a wrapper for the single vertical separator line
        const itemsWrapper = document.createElement('div');
        itemsWrapper.style.cssText = `
          flex: 1;
          overflow: hidden;
          display: flex;
          position: relative;
        `;

        // Labels column container with single vertical line
        const labelsColumn = document.createElement('div');
        labelsColumn.style.cssText = `
          width: 200px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          border-right: 2px solid #cbd5e1;
        `;

        // Roadmap bars container
        const barsColumn = document.createElement('div');
        barsColumn.style.cssText = `
          flex: 1;
          display: flex;
          flex-direction: column;
          margin-left: 8px;
        `;

        exportItems.forEach((item) => {
          // Item label
          const label = document.createElement('div');
          label.style.cssText = `
            min-height: 36px;
            padding: 4px 12px 4px 8px;
            font-size: 13px;
            font-weight: 500;
            color: #1e293b;
            display: flex;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
          `;
          const labelText = document.createElement('span');
          labelText.style.cssText = `
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.3;
          `;
          labelText.textContent = item.name;
          label.appendChild(labelText);
          labelsColumn.appendChild(label);

          // Item bar row
          const barRow = document.createElement('div');
          barRow.style.cssText = `
            min-height: 36px;
            position: relative;
            border-bottom: 1px solid #e2e8f0;
          `;

          // Calculate bar position
          let startSprintIdx = 0;
          let endSprintIdx = sprints.length - 1;

          if (item.startSprint !== undefined && item.endSprint !== undefined) {
            startSprintIdx = Math.max(0, item.startSprint - sprintConfig.firstSprintNumber);
            endSprintIdx = Math.min(sprints.length - 1, item.endSprint - sprintConfig.firstSprintNumber);
          } else if (item.startDate && item.endDate) {
            const itemStart = fromISODateString(item.startDate);
            const itemEnd = fromISODateString(item.endDate);
            for (let i = 0; i < sprints.length; i++) {
              if (sprints[i].startDate <= itemStart) startSprintIdx = i;
              if (sprints[i].endDate >= itemEnd) {
                endSprintIdx = i;
                break;
              }
            }
          }

          const barLeft = startSprintIdx * sprintWidth;
          const barWidth = (endSprintIdx - startSprintIdx + 1) * sprintWidth - 4;
          const categoryColor = item.category ? CATEGORY_BAR_COLORS[item.category] || '#94a3b8' : '#94a3b8';

          const bar = document.createElement('div');
          bar.style.cssText = `
            position: absolute;
            left: ${barLeft + 2}px;
            top: 6px;
            width: ${barWidth}px;
            height: 24px;
            background: ${categoryColor};
            border-radius: 4px;
            display: flex;
            align-items: center;
            padding: 0 8px;
            font-size: 10px;
            font-weight: 600;
            color: white;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            ${item.ddaItem ? 'border: 2px dashed #f97316;' : ''}
          `;
          bar.textContent = item.name;
          barRow.appendChild(bar);

          barsColumn.appendChild(barRow);
        });

        itemsWrapper.appendChild(labelsColumn);
        itemsWrapper.appendChild(barsColumn);
        exportContainer.appendChild(itemsWrapper);

        // Build legend
        const legend = document.createElement('div');
        legend.style.cssText = `
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        `;

        // Only show legend items for selected categories
        exportCategories.forEach((cat) => {
          const color = CATEGORY_BAR_COLORS[cat];
          if (!color) return;
          const legendItem = document.createElement('div');
          legendItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: #64748b;
          `;
          const colorBox = document.createElement('span');
          colorBox.style.cssText = `
            width: 14px;
            height: 14px;
            border-radius: 3px;
            background: ${color};
          `;
          legendItem.appendChild(colorBox);
          legendItem.appendChild(document.createTextNode(cat));
          legend.appendChild(legendItem);
        });

        // DDA indicator in legend
        const ddaLegendItem = document.createElement('div');
        ddaLegendItem.style.cssText = `
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #64748b;
        `;
        const ddaIndicator = document.createElement('span');
        ddaIndicator.style.cssText = `
          width: 14px;
          height: 10px;
          border: 2px dashed #f97316;
          border-radius: 2px;
          background: #f8fafc;
        `;
        ddaLegendItem.appendChild(ddaIndicator);
        ddaLegendItem.appendChild(document.createTextNode('DDA related'));
        legend.appendChild(ddaLegendItem);

        exportContainer.appendChild(legend);
      }

      // Use html2canvas to capture
      const canvas = await html2canvas(exportContainer, {
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      } as Parameters<typeof html2canvas>[1]);

      // Clean up
      document.body.removeChild(exportContainer);

      // Download the image
      const link = document.createElement('a');
      link.download = `roadmap-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export roadmap. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [allItems, sprints, sprintConfig.firstSprintNumber]);

  const handleToggleCategory = useCallback((category: CategoryType) => {
    toggleCategory(category);
  }, [toggleCategory]);

  const handleClearAllCategories = useCallback(() => {
    setSelectedCategories([]);
  }, [setSelectedCategories]);

  return (
    <div className="timeline-view">
      <div className="timeline-header">
        <div className="timeline-header-top">
          <h2>Roadmap Timeline</h2>
          <div className="timeline-controls">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showSprintActivities}
                onChange={(e) => setShowSprintActivities(e.target.checked)}
              />
              <span>Show Sprint Activities</span>
            </label>
            <label className="toggle-label toggle-label-highlight">
              <input
                type="checkbox"
                checked={showExternalOnly}
                onChange={(e) => setShowExternalOnly(e.target.checked)}
              />
              <span>External Roadmap Only</span>
            </label>
            <button
              className="btn btn-primary btn-small"
              onClick={() => setExportModalOpen(true)}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
        <CategoryFilter
          selectedCategories={selectedCategories}
          onToggleCategory={handleToggleCategory}
          onClearAll={handleClearAllCategories}
        />
        <div className="timeline-legend">
          {Object.entries(CATEGORY_BAR_COLORS).map(([cat, color]) => (
            <div key={cat} className="legend-item">
              <span className="legend-color" style={{ backgroundColor: color }} />
              <span className="legend-label">{cat}</span>
            </div>
          ))}
          {showSprintActivities && SUBTASK_ORDER.map((type) => {
            const info = SUBTASK_INFO[type];
            return (
              <div key={info.type} className="legend-item">
                <span className="legend-color" style={{ backgroundColor: info.color }} />
                <span className="legend-label">{info.label}</span>
              </div>
            );
          })}
          <div className="legend-item">
            <span className="legend-line legend-line-release" />
            <span className="legend-label">Release</span>
          </div>
          <div className="legend-item">
            <span className="legend-line legend-line-codefreeze" />
            <span className="legend-label">Code Freeze</span>
          </div>
          <div className="legend-item">
            <span className="legend-dda-indicator" />
            <span className="legend-label">DDA related</span>
          </div>
        </div>
      </div>

      <div className="timeline-instructions">
        <span>Double-click bar to edit</span>
        <span>Drag to move, drag edges to resize</span>
        <span>Double-click empty area to add item</span>
        {editingItemId && <span className="editing-indicator">Editing mode - click outside to exit</span>}
      </div>

      <div className="sprint-bands">
        <div className="sprint-bands-content" ref={sprintBandsContentRef}>
          {sprints.map((sprint, index) => (
            <div
              key={sprint.number}
              className={`sprint-band ${index % 2 === 0 ? 'even' : 'odd'}`}
              title={`Sprint ${sprint.number}: ${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}`}
            >
              Sprint {sprint.number}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className={`timeline-container ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {isDragOver && (
        <div className="timeline-drop-indicator">
          Drop here to add to roadmap
        </div>
      )}

      {items.length === 0 && !isDragOver && (
        <div className="timeline-empty">
          <p>Double-click on the timeline to add your first item, drag from the pool, or use the editor panel.</p>
        </div>
      )}

      <AddItemModal
        isOpen={addModalState.isOpen}
        startDate={addModalState.startDate}
        endDate={addModalState.endDate}
        onConfirm={handleConfirmAddItem}
        onCancel={handleCancelAddItem}
      />

      {/* Pool Drop Confirmation Dialog */}
      {poolDropState.isOpen && poolDropState.poolItem && (
        <div className="modal-overlay" onClick={handleCancelPoolDrop}>
          <div className="modal-content pool-add-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add to Roadmap</h3>
            <div className="pool-add-item-info">
              <span
                className="pool-category-badge"
                style={{
                  backgroundColor:
                    poolDropState.poolItem.category === 'Product' ? '#dbeafe' :
                    poolDropState.poolItem.category === 'Technical' ? '#ffedd5' :
                    poolDropState.poolItem.category === 'UX' ? '#ede9fe' :
                    poolDropState.poolItem.category === 'Design' ? '#fce7f3' :
                    poolDropState.poolItem.category === 'SP' ? '#d1fae5' :
                    '#fef3c7',
                  color:
                    poolDropState.poolItem.category === 'Product' ? '#1e40af' :
                    poolDropState.poolItem.category === 'Technical' ? '#9a3412' :
                    poolDropState.poolItem.category === 'UX' ? '#5b21b6' :
                    poolDropState.poolItem.category === 'Design' ? '#9d174d' :
                    poolDropState.poolItem.category === 'SP' ? '#065f46' :
                    '#92400e',
                }}
              >
                {poolDropState.poolItem.category}
              </span>
              <strong>{poolDropState.poolItem.featureName}</strong>
            </div>
            {poolDropState.poolItem.summary && (
              <p className="pool-add-summary">{poolDropState.poolItem.summary}</p>
            )}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pool-drop-start">Start Sprint</label>
                <select
                  id="pool-drop-start"
                  value={poolDropState.startSprint}
                  onChange={(e) =>
                    setPoolDropState({ ...poolDropState, startSprint: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: displaySprintCount }, (_, i) => sprintConfig.firstSprintNumber + i).map((s) => (
                    <option key={s} value={s}>
                      Sprint {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="pool-drop-duration">Duration (sprints)</label>
                <input
                  id="pool-drop-duration"
                  type="number"
                  min={1}
                  max={displaySprintCount}
                  value={poolDropState.durationSprints}
                  onChange={(e) =>
                    setPoolDropState({
                      ...poolDropState,
                      durationSprints: Math.max(1, Number(e.target.value)),
                    })
                  }
                />
              </div>
            </div>
            <div className="pool-add-preview">
              Sprint {poolDropState.startSprint} - Sprint{' '}
              {poolDropState.startSprint + poolDropState.durationSprints - 1} ({poolDropState.durationSprints}{' '}
              {poolDropState.durationSprints === 1 ? 'sprint' : 'sprints'})
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleConfirmPoolDrop}>
                Add to Roadmap
              </button>
              <button className="btn btn-secondary" onClick={handleCancelPoolDrop}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onConfirm={handleExport}
        onCancel={() => setExportModalOpen(false)}
      />
    </div>
  );
}
