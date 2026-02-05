import { addDays, format, parseISO } from 'date-fns';
import type { SprintConfig, SprintInfo } from '../types';

/**
 * Check if a date is a weekend (Saturday=6 or Sunday=0)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Get the next working day from a given date.
 * If the date is already a working day, returns the same date.
 */
export function nextWorkingDay(date: Date): Date {
  let current = new Date(date);
  while (isWeekend(current)) {
    current = addDays(current, 1);
  }
  return current;
}

/**
 * Add N working days to a date (skipping weekends).
 * If n=0, returns the same date (adjusted to working day if needed).
 */
export function addWorkingDays(date: Date, n: number): Date {
  let current = nextWorkingDay(new Date(date));
  let daysAdded = 0;

  while (daysAdded < n) {
    current = addDays(current, 1);
    if (!isWeekend(current)) {
      daysAdded++;
    }
  }

  return current;
}

/**
 * Count working days between two dates (inclusive of both start and end).
 */
export function countWorkingDays(start: Date, end: Date): number {
  if (end < start) return 0;

  let count = 0;
  let current = new Date(start);

  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current = addDays(current, 1);
  }

  return count;
}

/**
 * Get the start date of a sprint given the sprint config.
 */
export function sprintStartDate(sprintNumber: number, config: SprintConfig): Date {
  const firstStart = parseISO(config.firstSprintStartDate);
  const sprintDiff = sprintNumber - config.firstSprintNumber;

  if (sprintDiff === 0) {
    return nextWorkingDay(firstStart);
  }

  // Each sprint is workingDaysPerSprint working days
  const totalWorkingDays = sprintDiff * config.workingDaysPerSprint;
  return addWorkingDays(firstStart, totalWorkingDays);
}

/**
 * Get the end date of a sprint (the last working day of the sprint).
 */
export function sprintEndDate(sprintNumber: number, config: SprintConfig): Date {
  const start = sprintStartDate(sprintNumber, config);
  // End is workingDaysPerSprint - 1 working days after start
  return addWorkingDays(start, config.workingDaysPerSprint - 1);
}

/**
 * Get sprint info (number, start date, end date) for a given sprint number.
 */
export function getSprintInfo(sprintNumber: number, config: SprintConfig): SprintInfo {
  return {
    number: sprintNumber,
    startDate: sprintStartDate(sprintNumber, config),
    endDate: sprintEndDate(sprintNumber, config),
  };
}

/**
 * Generate sprint info for a range of sprints.
 */
export function generateSprints(startSprint: number, count: number, config: SprintConfig): SprintInfo[] {
  const sprints: SprintInfo[] = [];
  for (let i = 0; i < count; i++) {
    sprints.push(getSprintInfo(startSprint + i, config));
  }
  return sprints;
}

/**
 * Get all dates (both working and weekend) between two dates for timeline rendering.
 */
export function getDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  let current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current = addDays(current, 1);
  }

  return dates;
}

/**
 * Format a date for display.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy');
}

/**
 * Format a date as ISO string (YYYY-MM-DD).
 */
export function toISODateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parse an ISO date string to a Date object.
 */
export function fromISODateString(dateStr: string): Date {
  return parseISO(dateStr);
}

/**
 * Get the sprint number for a given date.
 * Returns the sprint number that contains this date.
 */
export function getSprintForDate(date: Date, config: SprintConfig): number {
  const firstStart = parseISO(config.firstSprintStartDate);

  if (date < firstStart) {
    return config.firstSprintNumber - 1;
  }

  let sprintNum = config.firstSprintNumber;
  while (true) {
    const sprintEnd = sprintEndDate(sprintNum, config);
    if (date <= sprintEnd) {
      return sprintNum;
    }
    sprintNum++;
    // Safety check to prevent infinite loop
    if (sprintNum > config.firstSprintNumber + 1000) {
      return sprintNum;
    }
  }
}
