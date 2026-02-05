import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import type { Subtask, SubtaskType, SprintConfig, SubtaskInfo } from '../types';
import {
  sprintStartDate,
  sprintEndDate,
  countWorkingDays,
  addWorkingDays,
  nextWorkingDay,
  toISODateString,
  fromISODateString,
} from './workingDays';

// Subtask distribution percentages
const SUBTASK_DISTRIBUTION: Record<SubtaskType, number> = {
  REQ_UX: 0.2,  // 20%
  DEV: 0.6,     // 60%
  QA: 0.2,      // 20%
};

// Subtask display info
export const SUBTASK_INFO: Record<SubtaskType, SubtaskInfo> = {
  REQ_UX: {
    type: 'REQ_UX',
    label: 'Requirements & UX',
    color: '#c4b5fd', // Light purple
    percentage: 20,
  },
  DEV: {
    type: 'DEV',
    label: 'Development',
    color: '#60a5fa', // Blue
    percentage: 60,
  },
  QA: {
    type: 'QA',
    label: 'QA',
    color: '#fcd34d', // Yellow
    percentage: 20,
  },
};

// Order of subtask execution
export const SUBTASK_ORDER: SubtaskType[] = ['REQ_UX', 'DEV', 'QA'];

/**
 * Allocate working days to each subtask.
 * Returns an object with days allocated to each subtask type.
 */
export function allocateWorkingDays(totalWorkingDays: number): Record<SubtaskType, number> {
  // Minimum 1 day per subtask if we have enough days
  const minDays = totalWorkingDays >= 3 ? 1 : 0;

  // Calculate raw allocations
  let reqDays = Math.max(minDays, Math.round(totalWorkingDays * SUBTASK_DISTRIBUTION.REQ_UX));
  let qaDays = Math.max(minDays, Math.round(totalWorkingDays * SUBTASK_DISTRIBUTION.QA));
  let devDays = totalWorkingDays - reqDays - qaDays;

  // Ensure dev has at least minimum days if possible
  if (devDays < minDays && totalWorkingDays >= 3) {
    devDays = minDays;
    // Reduce from req or qa
    const excess = reqDays + qaDays + devDays - totalWorkingDays;
    if (excess > 0) {
      if (reqDays > minDays) {
        reqDays = Math.max(minDays, reqDays - Math.ceil(excess / 2));
      }
      if (qaDays > minDays) {
        qaDays = Math.max(minDays, qaDays - Math.floor(excess / 2));
      }
      devDays = totalWorkingDays - reqDays - qaDays;
    }
  }

  // Handle very small ranges (< 3 days)
  if (totalWorkingDays < 3) {
    if (totalWorkingDays === 1) {
      return { REQ_UX: 0, DEV: 1, QA: 0 };
    }
    if (totalWorkingDays === 2) {
      return { REQ_UX: 0, DEV: 1, QA: 1 };
    }
    return { REQ_UX: 0, DEV: 0, QA: 0 };
  }

  return {
    REQ_UX: reqDays,
    DEV: devDays,
    QA: qaDays,
  };
}

/**
 * Generate subtasks for a roadmap item based on start and end sprints.
 */
export function generateSubtasks(
  startSprint: number,
  endSprint: number,
  config: SprintConfig
): Subtask[] {
  // Get item date range
  const itemStart = sprintStartDate(startSprint, config);
  const itemEnd = sprintEndDate(endSprint, config);

  // Count total working days
  const totalWorkingDays = countWorkingDays(itemStart, itemEnd);

  // Allocate days to each subtask
  const allocation = allocateWorkingDays(totalWorkingDays);

  // Build subtasks with contiguous date ranges
  const subtasks: Subtask[] = [];
  let currentStart = itemStart;

  for (const type of SUBTASK_ORDER) {
    const days = allocation[type];

    if (days > 0) {
      // Ensure we start on a working day
      const start = nextWorkingDay(currentStart);
      // End is (days - 1) working days after start
      const end = addWorkingDays(start, days - 1);

      subtasks.push({
        id: uuidv4(),
        type,
        autoStartDate: toISODateString(start),
        autoEndDate: toISODateString(end),
      });

      // Next subtask starts the next working day after this one ends
      currentStart = addDays(end, 1);
    } else {
      // Zero-day subtask - use item dates as placeholder
      subtasks.push({
        id: uuidv4(),
        type,
        autoStartDate: toISODateString(itemStart),
        autoEndDate: toISODateString(itemStart),
      });
    }
  }

  return subtasks;
}

/**
 * Get the effective dates for a subtask (considering overrides).
 */
export function getEffectiveDates(subtask: Subtask): { start: string; end: string } {
  return {
    start: subtask.overrideStartDate || subtask.autoStartDate,
    end: subtask.overrideEndDate || subtask.autoEndDate,
  };
}

/**
 * Validate subtask override dates.
 * Returns null if valid, or an error message if invalid.
 */
export function validateSubtaskOverride(
  subtask: Subtask,
  itemStartDate: string,
  itemEndDate: string
): string | null {
  const { start, end } = getEffectiveDates(subtask);

  if (new Date(end) < new Date(start)) {
    return 'End date must be on or after start date';
  }

  if (new Date(start) < new Date(itemStartDate)) {
    return 'Start date cannot be before item start date';
  }

  if (new Date(end) > new Date(itemEndDate)) {
    return 'End date cannot be after item end date';
  }

  return null;
}

/**
 * Generate subtasks for a roadmap item based on start and end dates (date mode).
 */
export function generateSubtasksFromDates(
  startDateStr: string,
  endDateStr: string
): Subtask[] {
  const itemStart = fromISODateString(startDateStr);
  const itemEnd = fromISODateString(endDateStr);

  // Count total working days
  const totalWorkingDays = countWorkingDays(itemStart, itemEnd);

  // Allocate days to each subtask
  const allocation = allocateWorkingDays(totalWorkingDays);

  // Build subtasks with contiguous date ranges
  const subtasks: Subtask[] = [];
  let currentStart = itemStart;

  for (const type of SUBTASK_ORDER) {
    const days = allocation[type];

    if (days > 0) {
      // Ensure we start on a working day
      const start = nextWorkingDay(currentStart);
      // End is (days - 1) working days after start
      const end = addWorkingDays(start, days - 1);

      subtasks.push({
        id: uuidv4(),
        type,
        autoStartDate: toISODateString(start),
        autoEndDate: toISODateString(end),
      });

      // Next subtask starts the next working day after this one ends
      currentStart = addDays(end, 1);
    } else {
      // Zero-day subtask - use item dates as placeholder
      subtasks.push({
        id: uuidv4(),
        type,
        autoStartDate: startDateStr,
        autoEndDate: startDateStr,
      });
    }
  }

  return subtasks;
}

/**
 * Recalculate subtasks when item sprints change.
 */
export function recalculateSubtasks(
  currentSubtasks: Subtask[],
  startSprint: number,
  endSprint: number,
  config: SprintConfig
): Subtask[] {
  const newSubtasks = generateSubtasks(startSprint, endSprint, config);

  // Preserve overrides if they're still valid
  return newSubtasks.map((newSubtask) => {
    const existing = currentSubtasks.find((s) => s.type === newSubtask.type);
    if (existing && (existing.overrideStartDate || existing.overrideEndDate)) {
      const itemStart = toISODateString(sprintStartDate(startSprint, config));
      const itemEnd = toISODateString(sprintEndDate(endSprint, config));

      const validation = validateSubtaskOverride(
        { ...newSubtask, overrideStartDate: existing.overrideStartDate, overrideEndDate: existing.overrideEndDate },
        itemStart,
        itemEnd
      );

      // Keep overrides only if they're still valid
      if (!validation) {
        return {
          ...newSubtask,
          overrideStartDate: existing.overrideStartDate,
          overrideEndDate: existing.overrideEndDate,
        };
      }
    }
    return newSubtask;
  });
}
