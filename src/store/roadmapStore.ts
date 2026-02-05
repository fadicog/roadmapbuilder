import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, RoadmapItem, ReleaseMarker, CodeFreezeMarker, SprintConfig, TimingUnit, PoolItem } from '../types';
import { generateSubtasks, recalculateSubtasks, generateSubtasksFromDates } from '../utils/subtaskAllocation';
import { POOL_ITEMS as DEFAULT_POOL_ITEMS, type CategoryType } from '../data/poolItems';

// Default sprint configuration
const DEFAULT_CONFIG: SprintConfig = {
  firstSprintNumber: 71,
  firstSprintStartDate: '2026-01-01',
  workingDaysPerSprint: 10,
  weekendDays: [0, 6], // Sunday, Saturday
};

// Number of sprints to display (26 sprints covers full year 2026: Jan through Dec)
const DEFAULT_SPRINT_COUNT = 26;

// Default timing unit
const DEFAULT_TIMING_UNIT: TimingUnit = 'sprints';

interface RoadmapStore extends AppState {
  // Sprint count for display
  displaySprintCount: number;
  // Timing unit setting
  timingUnit: TimingUnit;
  // Backlog pool items (editable)
  poolItems: PoolItem[];
  // Show/hide sprint activities (subtasks) in timeline
  showSprintActivities: boolean;
  // Category filter - which categories to show (empty = show all)
  selectedCategories: CategoryType[];
  // External roadmap filter - show only items marked for external/public visibility
  showExternalOnly: boolean;

  // Actions - Pool Items
  addPoolItem: (item: Omit<PoolItem, 'number'>) => void;
  updatePoolItem: (number: number, updates: Partial<Omit<PoolItem, 'number'>>) => void;
  deletePoolItem: (number: number) => void;
  resetPoolItems: () => void;

  // Actions - Items
  addItemBySprint: (name: string, startSprint: number, endSprint: number) => void;
  addItemByDate: (name: string, startDate: string, endDate: string) => void;
  addFromPool: (
    name: string,
    startSprint: number,
    durationSprints: number,
    poolItemNumber: number,
    category: string,
    priority: string,
    complexity: string,
    ddaItem: boolean
  ) => void;
  updateItem: (id: string, updates: Partial<Pick<RoadmapItem, 'name' | 'startSprint' | 'endSprint' | 'startDate' | 'endDate' | 'externalVisible'>>) => void;
  deleteItem: (id: string) => void;

  // Actions - Subtasks
  updateSubtaskOverride: (itemId: string, subtaskId: string, startDate?: string, endDate?: string) => void;
  resetSubtaskOverride: (itemId: string, subtaskId: string) => void;

  // Actions - Release Markers
  addReleaseMarker: (name: string, date: string) => void;
  updateReleaseMarker: (id: string, updates: Partial<Pick<ReleaseMarker, 'name' | 'date'>>) => void;
  deleteReleaseMarker: (id: string) => void;

  // Actions - Code Freeze Markers
  addCodeFreezeMarker: (name: string, afterSprint: number) => void;
  updateCodeFreezeMarker: (id: string, updates: Partial<Pick<CodeFreezeMarker, 'name' | 'afterSprint'>>) => void;
  deleteCodeFreezeMarker: (id: string) => void;

  // Actions - Config
  updateSprintConfig: (updates: Partial<SprintConfig>) => void;
  setDisplaySprintCount: (count: number) => void;
  setTimingUnit: (unit: TimingUnit) => void;
  setShowSprintActivities: (show: boolean) => void;
  setSelectedCategories: (categories: CategoryType[]) => void;
  toggleCategory: (category: CategoryType) => void;
  setShowExternalOnly: (show: boolean) => void;

  // Actions - Import/Export
  exportData: () => string;
  importData: (jsonString: string) => boolean;
  clearAllData: () => void;
}

export const useRoadmapStore = create<RoadmapStore>()(
  persist(
    (set, get) => ({
      // Initial state
      sprintConfig: DEFAULT_CONFIG,
      items: [],
      releaseMarkers: [],
      codeFreezeMarkers: [],
      displaySprintCount: DEFAULT_SPRINT_COUNT,
      timingUnit: DEFAULT_TIMING_UNIT,
      poolItems: DEFAULT_POOL_ITEMS,
      showSprintActivities: false, // Hidden by default
      selectedCategories: [], // Empty = show all categories
      showExternalOnly: false, // Show all items by default

      // Add a new pool item
      addPoolItem: (item: Omit<PoolItem, 'number'>) => {
        set((state) => {
          // Find the next available number
          const maxNumber = state.poolItems.reduce((max, p) => Math.max(max, p.number), 0);
          const newItem: PoolItem = {
            ...item,
            number: maxNumber + 1,
          };
          return {
            poolItems: [...state.poolItems, newItem],
          };
        });
      },

      // Update an existing pool item
      updatePoolItem: (number: number, updates: Partial<Omit<PoolItem, 'number'>>) => {
        set((state) => ({
          poolItems: state.poolItems.map((item) =>
            item.number === number ? { ...item, ...updates } : item
          ),
        }));
      },

      // Delete a pool item
      deletePoolItem: (number: number) => {
        set((state) => ({
          poolItems: state.poolItems.filter((item) => item.number !== number),
        }));
      },

      // Reset pool items to defaults
      resetPoolItems: () => {
        set({ poolItems: DEFAULT_POOL_ITEMS });
      },

      // Add a new roadmap item by sprint
      addItemBySprint: (name: string, startSprint: number, endSprint: number) => {
        const { sprintConfig } = get();
        const now = new Date().toISOString();

        const newItem: RoadmapItem = {
          id: uuidv4(),
          name,
          startSprint,
          endSprint,
          subtasks: generateSubtasks(startSprint, endSprint, sprintConfig),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          items: [...state.items, newItem],
        }));
      },

      // Add a new roadmap item by date
      addItemByDate: (name: string, startDate: string, endDate: string) => {
        const now = new Date().toISOString();

        const newItem: RoadmapItem = {
          id: uuidv4(),
          name,
          startDate,
          endDate,
          subtasks: generateSubtasksFromDates(startDate, endDate),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          items: [...state.items, newItem],
        }));
      },

      // Add a roadmap item from the pool
      addFromPool: (
        name: string,
        startSprint: number,
        durationSprints: number,
        poolItemNumber: number,
        category: string,
        priority: string,
        complexity: string,
        ddaItem: boolean,
        externalVisible?: boolean
      ) => {
        const { sprintConfig, poolItems } = get();
        const endSprint = startSprint + durationSprints - 1;
        const now = new Date().toISOString();

        // Get externalVisible from pool item if not explicitly provided
        const poolItem = poolItems.find(p => p.number === poolItemNumber);
        const isExternalVisible = externalVisible ?? poolItem?.externalVisible ?? false;

        const newItem: RoadmapItem = {
          id: uuidv4(),
          name,
          startSprint,
          endSprint,
          subtasks: generateSubtasks(startSprint, endSprint, sprintConfig),
          createdAt: now,
          updatedAt: now,
          poolItemNumber,
          category,
          poolPriority: priority,
          poolComplexity: complexity,
          ddaItem,
          externalVisible: isExternalVisible,
        };

        set((state) => ({
          items: [...state.items, newItem],
        }));
      },

      // Update an existing item
      updateItem: (id: string, updates: Partial<Pick<RoadmapItem, 'name' | 'startSprint' | 'endSprint' | 'startDate' | 'endDate' | 'externalVisible'>>) => {
        const { sprintConfig, items } = get();
        const item = items.find((i) => i.id === id);

        if (!item) return;

        // Check if this is a sprint-based or date-based item
        const isSprintBased = item.startSprint !== undefined;

        let newSubtasks = item.subtasks;

        if (isSprintBased && (updates.startSprint !== undefined || updates.endSprint !== undefined)) {
          const newStartSprint = updates.startSprint ?? item.startSprint!;
          const newEndSprint = updates.endSprint ?? item.endSprint!;

          // Recalculate subtasks if sprints changed
          const sprintsChanged = newStartSprint !== item.startSprint || newEndSprint !== item.endSprint;
          if (sprintsChanged) {
            newSubtasks = recalculateSubtasks(item.subtasks, newStartSprint, newEndSprint, sprintConfig);
          }
        } else if (!isSprintBased && (updates.startDate !== undefined || updates.endDate !== undefined)) {
          const newStartDate = updates.startDate ?? item.startDate!;
          const newEndDate = updates.endDate ?? item.endDate!;

          // Recalculate subtasks if dates changed
          const datesChanged = newStartDate !== item.startDate || newEndDate !== item.endDate;
          if (datesChanged) {
            newSubtasks = generateSubtasksFromDates(newStartDate, newEndDate);
          }
        }

        set((state) => ({
          items: state.items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  ...updates,
                  subtasks: newSubtasks,
                  updatedAt: new Date().toISOString(),
                }
              : i
          ),
        }));
      },

      // Delete an item
      deleteItem: (id: string) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));
      },

      // Update subtask override dates
      updateSubtaskOverride: (itemId: string, subtaskId: string, startDate?: string, endDate?: string) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  subtasks: item.subtasks.map((st) =>
                    st.id === subtaskId
                      ? {
                          ...st,
                          overrideStartDate: startDate,
                          overrideEndDate: endDate,
                        }
                      : st
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : item
          ),
        }));
      },

      // Reset subtask override to auto dates
      resetSubtaskOverride: (itemId: string, subtaskId: string) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  subtasks: item.subtasks.map((st) =>
                    st.id === subtaskId
                      ? {
                          ...st,
                          overrideStartDate: undefined,
                          overrideEndDate: undefined,
                        }
                      : st
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : item
          ),
        }));
      },

      // Add a release marker
      addReleaseMarker: (name: string, date: string) => {
        const newMarker: ReleaseMarker = {
          id: uuidv4(),
          name,
          date,
        };

        set((state) => ({
          releaseMarkers: [...state.releaseMarkers, newMarker],
        }));
      },

      // Update a release marker
      updateReleaseMarker: (id: string, updates: Partial<Pick<ReleaseMarker, 'name' | 'date'>>) => {
        set((state) => ({
          releaseMarkers: state.releaseMarkers.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }));
      },

      // Delete a release marker
      deleteReleaseMarker: (id: string) => {
        set((state) => ({
          releaseMarkers: state.releaseMarkers.filter((m) => m.id !== id),
        }));
      },

      // Add a code freeze marker
      addCodeFreezeMarker: (name: string, afterSprint: number) => {
        const newMarker: CodeFreezeMarker = {
          id: uuidv4(),
          name,
          afterSprint,
        };

        set((state) => ({
          codeFreezeMarkers: [...state.codeFreezeMarkers, newMarker],
        }));
      },

      // Update a code freeze marker
      updateCodeFreezeMarker: (id: string, updates: Partial<Pick<CodeFreezeMarker, 'name' | 'afterSprint'>>) => {
        set((state) => ({
          codeFreezeMarkers: state.codeFreezeMarkers.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }));
      },

      // Delete a code freeze marker
      deleteCodeFreezeMarker: (id: string) => {
        set((state) => ({
          codeFreezeMarkers: state.codeFreezeMarkers.filter((m) => m.id !== id),
        }));
      },

      // Update sprint config
      updateSprintConfig: (updates: Partial<SprintConfig>) => {
        set((state) => ({
          sprintConfig: { ...state.sprintConfig, ...updates },
        }));
      },

      // Set display sprint count
      setDisplaySprintCount: (count: number) => {
        set({ displaySprintCount: count });
      },

      // Set timing unit
      setTimingUnit: (unit: TimingUnit) => {
        set({ timingUnit: unit });
      },

      // Set show/hide sprint activities
      setShowSprintActivities: (show: boolean) => {
        set({ showSprintActivities: show });
      },

      // Set selected categories for filtering
      setSelectedCategories: (categories: CategoryType[]) => {
        set({ selectedCategories: categories });
      },

      // Toggle a single category in the filter
      toggleCategory: (category: CategoryType) => {
        set((state) => {
          const current = state.selectedCategories;
          if (current.includes(category)) {
            // Remove category
            return { selectedCategories: current.filter((c) => c !== category) };
          } else {
            // Add category
            return { selectedCategories: [...current, category] };
          }
        });
      },

      // Set external roadmap filter
      setShowExternalOnly: (show: boolean) => {
        set({ showExternalOnly: show });
      },

      // Export data as JSON string
      exportData: () => {
        const { sprintConfig, items, releaseMarkers, codeFreezeMarkers, displaySprintCount, timingUnit, poolItems, showSprintActivities, selectedCategories, showExternalOnly } = get();
        const exportObj = {
          version: '1.6',
          exportedAt: new Date().toISOString(),
          sprintConfig,
          items,
          releaseMarkers,
          codeFreezeMarkers,
          displaySprintCount,
          timingUnit,
          poolItems,
          showSprintActivities,
          selectedCategories,
          showExternalOnly,
        };
        return JSON.stringify(exportObj, null, 2);
      },

      // Import data from JSON string
      importData: (jsonString: string) => {
        try {
          const data = JSON.parse(jsonString);

          // Validate basic structure
          if (!data.sprintConfig || !Array.isArray(data.items)) {
            console.error('Invalid import data structure');
            return false;
          }

          set({
            sprintConfig: data.sprintConfig,
            items: data.items,
            releaseMarkers: data.releaseMarkers || [],
            codeFreezeMarkers: data.codeFreezeMarkers || [],
            displaySprintCount: data.displaySprintCount || DEFAULT_SPRINT_COUNT,
            timingUnit: data.timingUnit || DEFAULT_TIMING_UNIT,
            poolItems: data.poolItems || DEFAULT_POOL_ITEMS,
            showSprintActivities: data.showSprintActivities ?? false,
            selectedCategories: data.selectedCategories || [],
            showExternalOnly: data.showExternalOnly ?? false,
          });

          return true;
        } catch (error) {
          console.error('Failed to import data:', error);
          return false;
        }
      },

      // Clear all data
      clearAllData: () => {
        set({
          sprintConfig: DEFAULT_CONFIG,
          items: [],
          releaseMarkers: [],
          codeFreezeMarkers: [],
          displaySprintCount: DEFAULT_SPRINT_COUNT,
          timingUnit: DEFAULT_TIMING_UNIT,
          poolItems: DEFAULT_POOL_ITEMS,
          showSprintActivities: false,
          selectedCategories: [],
          showExternalOnly: false,
        });
      },
    }),
    {
      name: 'roadmap-builder-storage',
    }
  )
);

// Selector hooks for common computed values
export const useSprintConfig = () => useRoadmapStore((state) => state.sprintConfig);
export const useItems = () => useRoadmapStore((state) => state.items);
export const useReleaseMarkers = () => useRoadmapStore((state) => state.releaseMarkers);
export const useCodeFreezeMarkers = () => useRoadmapStore((state) => state.codeFreezeMarkers || []);
export const useDisplaySprintCount = () => useRoadmapStore((state) => state.displaySprintCount);
// Ensure timingUnit defaults to 'sprints' even if undefined in persisted state
export const useTimingUnit = () => useRoadmapStore((state) => state.timingUnit || 'sprints');
// Pool item numbers already added to the roadmap
export const useAddedPoolNumbers = () =>
  useRoadmapStore((state) =>
    new Set(state.items.filter((i) => i.poolItemNumber !== undefined).map((i) => i.poolItemNumber!))
  );
// All pool items (editable backlog)
export const usePoolItems = () => useRoadmapStore((state) => state.poolItems);
// Show/hide sprint activities setting
export const useShowSprintActivities = () => useRoadmapStore((state) => state.showSprintActivities ?? false);
// Selected categories for filtering
export const useSelectedCategories = () => useRoadmapStore((state) => state.selectedCategories || []);
// Show external roadmap only filter
export const useShowExternalOnly = () => useRoadmapStore((state) => state.showExternalOnly ?? false);
