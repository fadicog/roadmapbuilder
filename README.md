# Sprint Roadmap Builder

A web-based tool for creating and visualizing sprint-based roadmaps with automatic subtask distribution and timeline visualization.

## Features

- **Sprint-based planning**: Define roadmap items by start and end sprints (10 working days per sprint)
- **Automatic subtask generation**: Each item auto-generates 3 subtasks:
  - Requirements & UX (20% of duration)
  - Development (60% of duration)
  - QA (20% of duration)
- **Manual override**: Override auto-calculated subtask dates when needed
- **Timeline visualization**: Interactive Gantt-like view with zoom and scroll
- **Release markers**: Add vertical milestone markers on the timeline
- **Data persistence**: Auto-saves to localStorage
- **Import/Export**: Export and import roadmap data as JSON

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Open http://localhost:5173 in your browser.

## Sprint Configuration

Default configuration (can be changed in Settings):

- **First Sprint**: Sprint 71
- **Sprint Start Date**: January 1, 2026
- **Sprint Duration**: 10 working days
- **Weekends**: Saturday and Sunday (non-working)

### Sprint Date Calculation Example

Sprint 71:
- Start: January 1, 2026 (Thursday)
- End: January 14, 2026 (Wednesday)
- 10 working days (excluding weekends Jan 4-5 and Jan 11-12)

## Usage

### Adding Roadmap Items

1. Click "+ Add Item" in the left panel
2. Enter the item name (e.g., "Documents tab refresh")
3. Select start and end sprints
4. Click "Add Item"

The app automatically calculates:
- Item start/end dates based on sprints
- Subtask dates based on the 20/60/20 distribution

### Editing Subtask Dates

1. Click the expand arrow (>) next to an item
2. Use the date pickers to override Start/End dates for any subtask
3. Click "Reset" to restore auto-calculated dates

### Adding Release Markers

1. Scroll to "Release Markers" section
2. Click "+ Add Release"
3. Enter name and date
4. The marker appears as a vertical line on the timeline

### Exporting/Importing Data

- **Export**: Click "Export JSON" to download your roadmap data
- **Import**: Click "Import JSON" to load a previously exported file
- **Clear**: Click "Clear All" to reset (with confirmation)

## Data Model

### RoadmapItem
```typescript
{
  id: string;
  name: string;
  startSprint: number;
  endSprint: number;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
}
```

### Subtask
```typescript
{
  id: string;
  type: 'REQ_UX' | 'DEV' | 'QA';
  autoStartDate: string;  // ISO date
  autoEndDate: string;    // ISO date
  overrideStartDate?: string;
  overrideEndDate?: string;
}
```

### ReleaseMarker
```typescript
{
  id: string;
  name: string;
  date: string;  // ISO date
}
```

## Color Coding

| Phase | Color | Hex |
|-------|-------|-----|
| Requirements & UX | Light Purple | #c4b5fd |
| Development | Blue | #60a5fa |
| QA | Yellow | #fcd34d |
| Release Marker | Red | #ef4444 |

## Technology Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **vis-timeline** for Gantt visualization
- **Zustand** for state management
- **date-fns** for date calculations

## Project Structure

```
roadmap-builder/
├── src/
│   ├── components/
│   │   ├── DataControls.tsx     # Settings and import/export
│   │   ├── EditorPanel.tsx      # Left panel container
│   │   ├── ItemForm.tsx         # Add/edit item form
│   │   ├── ItemList.tsx         # List of roadmap items
│   │   ├── ReleaseMarkerList.tsx # Release marker management
│   │   ├── SubtaskEditor.tsx    # Subtask date override UI
│   │   └── TimelineView.tsx     # vis-timeline visualization
│   ├── store/
│   │   └── roadmapStore.ts      # Zustand store with persistence
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   ├── utils/
│   │   ├── subtaskAllocation.ts # Subtask date calculation
│   │   └── workingDays.ts       # Working day utilities
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Working Day Utilities

The app includes utilities for working day calculations:

- `isWeekend(date)` - Check if date is Saturday or Sunday
- `nextWorkingDay(date)` - Get next working day from date
- `addWorkingDays(date, n)` - Add n working days to date
- `countWorkingDays(start, end)` - Count working days in range
- `sprintStartDate(sprintNumber, config)` - Get sprint start date
- `sprintEndDate(sprintNumber, config)` - Get sprint end date

## Portability

This is a fully self-contained application. To deploy:

1. Copy the entire `roadmap-builder` folder to any machine with Node.js
2. Run `npm install && npm run dev`
3. Or build for production with `npm run build` and serve the `dist` folder

## Browser Support

Modern browsers with ES2020 support:
- Chrome 80+
- Firefox 72+
- Safari 14+
- Edge 80+
