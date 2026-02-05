# Roadmap Builder - Project Updates

This file documents all updates and changes made to the project for reference in future sessions.

---

## Session: 2026-01-21

### Initial Build
Created a complete Sprint Roadmap Builder application based on requirements in `requirements-roadmap-vis.md`.

**Technology Stack:**
- React + TypeScript + Vite
- vis-timeline for Gantt visualization
- Zustand for state management with localStorage persistence
- date-fns for date utilities

**Core Files Created:**
| File | Purpose |
|------|---------|
| `src/utils/workingDays.ts` | Working day calculations (isWeekend, addWorkingDays, sprintStartDate, etc.) |
| `src/utils/subtaskAllocation.ts` | Auto-generates 3 subtasks with 20/60/20 distribution |
| `src/types/index.ts` | TypeScript interfaces (SprintConfig, RoadmapItem, Subtask, etc.) |
| `src/store/roadmapStore.ts` | Zustand store with localStorage persistence |
| `src/components/EditorPanel.tsx` | Left panel container |
| `src/components/ItemList.tsx` | Roadmap item list with expand/collapse |
| `src/components/ItemForm.tsx` | Add/edit item form |
| `src/components/SubtaskEditor.tsx` | Override subtask dates with validation |
| `src/components/ReleaseMarkerList.tsx` | Add release milestone markers |
| `src/components/DataControls.tsx` | Settings, JSON export/import, clear data |
| `src/components/TimelineView.tsx` | vis-timeline Gantt visualization |
| `src/App.css` | Complete styling with CSS variables |

---

### Update 1: Subtask Ordering Fix

**Issue:** Subtasks were not displaying in the correct natural order.

**Fix:**
- Subtasks now always display in order: **Requirements & UX → Development → QA**
- Updated `SubtaskEditor.tsx` to use `SUBTASK_ORDER` array for consistent ordering
- Updated `TimelineView.tsx` to use `SUBTASK_ORDER` for groups and items

**Files Modified:**
- `src/components/SubtaskEditor.tsx`
- `src/components/TimelineView.tsx`

---

### Update 2: Timing Unit Setting (Sprints vs Dates)

**Feature:** Allow users to choose between sprints or dates as the input mode for item timing.

**Changes:**
1. Added `TimingUnit` type (`'sprints' | 'dates'`) to types
2. Added `timingUnit` state to store with default `'sprints'`
3. Updated `ItemForm.tsx` to show sprint dropdowns or date pickers based on mode
4. Added `addItemBySprint` and `addItemByDate` methods to store
5. Updated `RoadmapItem` type to support both `startSprint/endSprint` and `startDate/endDate`

**Files Modified:**
- `src/types/index.ts` - Added `TimingUnit` type and `AppSettings` interface
- `src/store/roadmapStore.ts` - Added timing unit state and methods
- `src/components/ItemForm.tsx` - Conditional form based on timing mode
- `src/components/ItemList.tsx` - Display both sprint-based and date-based items
- `src/components/SubtaskEditor.tsx` - Handle both item types
- `src/utils/subtaskAllocation.ts` - Added `generateSubtasksFromDates` function

---

### Update 3: Improved Settings Menu

**Feature:** Better organized settings panel with grouped sections.

**Changes:**
- Added collapsible Settings section
- Organized into groups: Input Mode, Sprint Configuration, Display, Data Management
- Added toggle buttons for Sprints/Dates selection
- Added Working Days per Sprint setting
- Visual improvements with better spacing and labels

**Files Modified:**
- `src/components/DataControls.tsx` - Complete rewrite of settings UI
- `src/App.css` - Added styles for settings groups, toggle buttons, collapsible sections

---

### Update 4: Interactive Timeline Editing

**Feature:** Consistent editing experience on the timeline visualization.

**Interaction Model:**
1. **Double-click to enter edit mode** - Select any bar for editing
2. **Drag to move** - Move the bar to a new time position (snaps to days)
3. **Drag edges to resize** - Hover on edges shows ↔ cursor, drag to resize
4. **Parent auto-expansion** - If subtask extends beyond parent, parent expands automatically
5. **Click outside to exit** - Click empty space or different bar to exit edit mode
6. **Double-click empty area** - Opens modal to add new item at that position

**Visual Feedback:**
- Parent item bars now visible (gray) showing overall item duration
- Editing bars have blue glow/shadow effect
- Resize handles become visible and blue when editing
- Instructions bar shows "Editing mode" indicator with pulsing dot
- Tooltips show "Double-click to edit" hint

**Technical Implementation:**
- Track `editingItemId` state to manage which item is editable
- Per-item `editable` setting based on editing state
- `onMove` callback updates store (subtask overrides or item dates)
- `isBefore`/`isAfter` checks for parent expansion logic
- When subtask moves beyond parent bounds, parent dates are updated

**Files Modified:**
- `src/components/TimelineView.tsx` - Complete rewrite with editing mode
- `src/App.css` - Added styles for editing mode, parent bars, animations

**Key Code Sections:**
```typescript
// Track editing state
const [editingItemId, setEditingItemId] = useState<string | null>(null);

// Double-click to enter edit mode
timeline.on('doubleClick', (properties) => {
  if (properties.item) {
    setEditingItemId(properties.item);
  }
});

// Click outside to exit
timeline.on('click', (properties) => {
  if (editingItemId && properties.item !== editingItemId) {
    setEditingItemId(null);
  }
});

// Parent auto-expansion on subtask move
if (isBefore(newStart, parentStart)) {
  newParentStart = newStart;
  needsParentUpdate = true;
}
if (isAfter(newEnd, parentEnd)) {
  newParentEnd = newEnd;
  needsParentUpdate = true;
}
```

---

## Configuration Defaults

| Setting | Default Value |
|---------|---------------|
| First Sprint Number | 71 |
| First Sprint Start Date | 2026-01-01 |
| Working Days per Sprint | 10 |
| Weekend Days | Saturday, Sunday |
| Display Sprint Count | 12 (~6 months) |
| Timing Unit | Sprints |

## Subtask Distribution

| Subtask | Percentage | Color |
|---------|------------|-------|
| Requirements & UX | 20% | Light Purple (#c4b5fd) |
| Development | 60% | Blue (#60a5fa) |
| QA | 20% | Yellow (#fcd34d) |

---

## Known Issues / Future Improvements

1. **Bundle size warning** - vis-timeline adds significant size (~500KB). Could use code-splitting.
2. **Sprint-to-date conversion** - When editing on timeline, sprint-based items convert to date-based.
3. **Undo/Redo** - Not implemented yet.
4. **Drag entire item group** - Currently only individual subtasks or parent bars can be moved.

---

## How to Run

```bash
cd D:\claude\roadmap-builder
npm install
npm run dev
```

Open http://localhost:5173 in browser.

## How to Build for Production

```bash
npm run build
```

Output in `dist/` folder.

## Portability

To move to another machine:
1. Copy entire `roadmap-builder` folder
2. Run `npm install`
3. Run `npm run dev`
4. Use Export JSON to save data, Import JSON to restore on new machine
