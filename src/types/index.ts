// Timing unit for entering item dates
export type TimingUnit = 'sprints' | 'dates';

// Pool item category
export type PoolCategory = 'Product' | 'Technical' | 'UX' | 'Design' | 'SP';

// Pool item priority
export type PoolPriority = 'High' | 'Medium' | 'Low' | 'TBD' | 'TBC' | '';

// Pool item complexity
export type PoolComplexity = 'High' | 'Medium' | 'Low' | 'TBD' | 'TBC' | '';

// Backlog pool item (from CSV)
export interface PoolItem {
  number: number;
  category: string;
  tag: string;
  priority: string;
  priorityScore: number;
  relatesTo: string;
  complexity: string;
  complexityScore: number;
  totalScore: number;
  track: string;
  ddaItem: boolean;
  featureName: string;
  summary: string;
  toBePickedUp: boolean | null;
  remarks: string;
  alreadyPickedUp: boolean;
  startSprint: number | null;
  endSprint?: number | null;
  externalVisible: boolean; // Whether this item should appear in external/public roadmap
  // Epic detail fields (from PPT roadmap)
  epicName?: string;
  objectives?: string[];
  description?: string;
  acceptanceCriteria?: string[];
  owners?: string[];
  dependencies?: string[];
  targetAudience?: string[];
}

// Sprint configuration
export interface SprintConfig {
  firstSprintNumber: number;
  firstSprintStartDate: string; // ISO date string
  workingDaysPerSprint: number;
  weekendDays: number[]; // 0=Sun, 6=Sat
}

// App settings
export interface AppSettings {
  timingUnit: TimingUnit;
  displaySprintCount: number;
}

// Subtask types
export type SubtaskType = 'REQ_UX' | 'DEV' | 'QA';

// Subtask entity
export interface Subtask {
  id: string;
  type: SubtaskType;
  autoStartDate: string; // ISO date
  autoEndDate: string; // ISO date
  overrideStartDate?: string; // ISO date
  overrideEndDate?: string; // ISO date
}

// Roadmap item
export interface RoadmapItem {
  id: string;
  name: string;
  // Sprint-based timing (used when timingUnit is 'sprints')
  startSprint?: number;
  endSprint?: number;
  // Date-based timing (used when timingUnit is 'dates')
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
  // Pool item metadata (set when added from pool)
  poolItemNumber?: number;
  category?: string;
  poolPriority?: string;
  poolComplexity?: string;
  ddaItem?: boolean; // True if this requires DDA approval
  externalVisible?: boolean; // True if this item should appear in external/public roadmap
  // Extended epic fields
  epicName?: string;
  objectives?: string[];
  description?: string;
  acceptanceCriteria?: string[];
  owners?: string[];
  dependencies?: string[];
  targetAudience?: string[];
}

// Release marker
export interface ReleaseMarker {
  id: string;
  name: string;
  date: string; // ISO date
}

// Code freeze marker (sprint-based)
export interface CodeFreezeMarker {
  id: string;
  name: string;
  afterSprint: number; // Code freeze happens at the END of this sprint
}

// Application state
export interface AppState {
  sprintConfig: SprintConfig;
  items: RoadmapItem[];
  releaseMarkers: ReleaseMarker[];
  codeFreezeMarkers: CodeFreezeMarker[];
}

// Subtask display info
export interface SubtaskInfo {
  type: SubtaskType;
  label: string;
  color: string;
  percentage: number;
}

// Computed sprint info
export interface SprintInfo {
  number: number;
  startDate: Date;
  endDate: Date;
}

// Timeline item for vis-timeline
export interface TimelineItem {
  id: string;
  group: string;
  content: string;
  start: Date;
  end: Date;
  className: string;
  title?: string;
  type?: string;
}

// Timeline group for vis-timeline
export interface TimelineGroup {
  id: string;
  content: string;
  nestedGroups?: string[];
  className?: string;
  treeLevel?: number;
}
