import type { Subtask, RoadmapItem } from '../types';
import { useRoadmapStore, useSprintConfig } from '../store/roadmapStore';
import { SUBTASK_INFO, SUBTASK_ORDER, getEffectiveDates, validateSubtaskOverride } from '../utils/subtaskAllocation';
import { sprintStartDate, sprintEndDate, toISODateString, formatDate, countWorkingDays, fromISODateString } from '../utils/workingDays';

interface SubtaskEditorProps {
  item: RoadmapItem;
}

export function SubtaskEditor({ item }: SubtaskEditorProps) {
  const sprintConfig = useSprintConfig();
  const { updateSubtaskOverride, resetSubtaskOverride } = useRoadmapStore();

  // Get item date range based on whether it's sprint-based or date-based
  let itemStartDate: string;
  let itemEndDate: string;

  if (item.startSprint !== undefined && item.endSprint !== undefined) {
    // Sprint-based item
    itemStartDate = toISODateString(sprintStartDate(item.startSprint, sprintConfig));
    itemEndDate = toISODateString(sprintEndDate(item.endSprint, sprintConfig));
  } else if (item.startDate && item.endDate) {
    // Date-based item
    itemStartDate = item.startDate;
    itemEndDate = item.endDate;
  } else {
    // Fallback
    itemStartDate = toISODateString(new Date());
    itemEndDate = toISODateString(new Date());
  }

  const handleStartDateChange = (subtask: Subtask, value: string) => {
    const endDate = subtask.overrideEndDate || subtask.autoEndDate;
    updateSubtaskOverride(item.id, subtask.id, value || undefined, endDate);
  };

  const handleEndDateChange = (subtask: Subtask, value: string) => {
    const startDate = subtask.overrideStartDate || subtask.autoStartDate;
    updateSubtaskOverride(item.id, subtask.id, startDate, value || undefined);
  };

  const handleReset = (subtaskId: string) => {
    resetSubtaskOverride(item.id, subtaskId);
  };

  // Get subtasks in correct order: REQ_UX -> DEV -> QA
  const orderedSubtasks = SUBTASK_ORDER.map(type =>
    item.subtasks.find(st => st.type === type)
  ).filter((st): st is Subtask => st !== undefined);

  return (
    <div className="subtask-editor">
      <div className="subtask-header">
        <span className="subtask-header-name">Subtask</span>
        <span className="subtask-header-auto">Auto Dates</span>
        <span className="subtask-header-override">Override Start</span>
        <span className="subtask-header-override">Override End</span>
        <span className="subtask-header-days">Days</span>
        <span className="subtask-header-actions">Actions</span>
      </div>

      {orderedSubtasks.map((subtask) => {
        const info = SUBTASK_INFO[subtask.type];
        const effective = getEffectiveDates(subtask);
        const validation = validateSubtaskOverride(subtask, itemStartDate, itemEndDate);
        const hasOverride = subtask.overrideStartDate || subtask.overrideEndDate;
        const workingDays = countWorkingDays(
          fromISODateString(effective.start),
          fromISODateString(effective.end)
        );

        return (
          <div key={subtask.id} className={`subtask-row ${validation ? 'invalid' : ''}`}>
            <div className="subtask-name">
              <span
                className="subtask-color-dot"
                style={{ backgroundColor: info.color }}
              />
              {info.label}
            </div>

            <div className="subtask-auto-dates">
              <span className="date-range">
                {formatDate(subtask.autoStartDate)} - {formatDate(subtask.autoEndDate)}
              </span>
            </div>

            <div className="subtask-override-start">
              <input
                type="date"
                value={subtask.overrideStartDate || ''}
                min={itemStartDate}
                max={itemEndDate}
                onChange={(e) => handleStartDateChange(subtask, e.target.value)}
              />
            </div>

            <div className="subtask-override-end">
              <input
                type="date"
                value={subtask.overrideEndDate || ''}
                min={itemStartDate}
                max={itemEndDate}
                onChange={(e) => handleEndDateChange(subtask, e.target.value)}
              />
            </div>

            <div className="subtask-days">
              {workingDays} WD
            </div>

            <div className="subtask-actions">
              {hasOverride && (
                <button
                  type="button"
                  className="btn btn-small btn-text"
                  onClick={() => handleReset(subtask.id)}
                  title="Reset to auto-calculated dates"
                >
                  Reset
                </button>
              )}
            </div>

            {validation && (
              <div className="subtask-error">{validation}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
