import { useState } from 'react';
import { useRoadmapStore, useSprintConfig, useDisplaySprintCount } from '../store/roadmapStore';
import { ALL_CATEGORIES } from '../data/poolItems';
import type { RoadmapItem } from '../types';

// Sub-component for editing string arrays (owners, objectives, etc.)
function BulletListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const handleUpdate = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onChange([...items, '']);
  };

  return (
    <div className="bullet-list-editor">
      <label>{label}</label>
      {items.map((item, idx) => (
        <div key={idx} className="bullet-list-row">
          <span className="bullet-dot">&bull;</span>
          <input
            type="text"
            value={item}
            onChange={(e) => handleUpdate(idx, e.target.value)}
            placeholder={placeholder}
          />
          <button
            type="button"
            className="btn-icon-remove"
            onClick={() => handleRemove(idx)}
            title="Remove"
          >
            &times;
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-small btn-secondary" onClick={handleAdd}>
        + Add
      </button>
    </div>
  );
}

interface EpicEditModalProps {
  item: RoadmapItem;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function EpicEditModal({ item, isOpen, onClose, onDelete }: EpicEditModalProps) {
  const { updateItem } = useRoadmapStore();
  const sprintConfig = useSprintConfig();
  const displaySprintCount = useDisplaySprintCount();

  // Basic tab state
  const [name, setName] = useState(item.name);
  const [epicName, setEpicName] = useState(item.epicName || '');
  const [category, setCategory] = useState(item.category || '');
  const [owners, setOwners] = useState<string[]>(item.owners || []);
  const [targetAudience, setTargetAudience] = useState<string[]>(item.targetAudience || []);
  const [externalVisible, setExternalVisible] = useState(item.externalVisible ?? false);
  const [ddaItem, setDdaItem] = useState(item.ddaItem ?? false);
  const [poolPriority, setPoolPriority] = useState(item.poolPriority || '');
  const [poolComplexity, setPoolComplexity] = useState(item.poolComplexity || '');

  // Sprint/date state
  const isSprintBased = item.startSprint !== undefined;
  const [startSprint, setStartSprint] = useState(item.startSprint ?? sprintConfig.firstSprintNumber);
  const [endSprint, setEndSprint] = useState(item.endSprint ?? sprintConfig.firstSprintNumber);
  const [startDate, setStartDate] = useState(item.startDate || '');
  const [endDate, setEndDate] = useState(item.endDate || '');

  // Advanced tab state
  const [objectives, setObjectives] = useState<string[]>(item.objectives || []);
  const [description, setDescription] = useState(item.description || '');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>(item.acceptanceCriteria || []);
  const [dependencies, setDependencies] = useState<string[]>(item.dependencies || []);

  // UI state
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen) return null;

  // Sprint options
  const sprintOptions: number[] = [];
  for (let i = 0; i < displaySprintCount; i++) {
    sprintOptions.push(sprintConfig.firstSprintNumber + i);
  }

  const handleSave = () => {
    const updates: Partial<Omit<RoadmapItem, 'id' | 'createdAt' | 'subtasks'>> = {
      name,
      epicName: epicName || undefined,
      category: category || undefined,
      owners: owners.filter(Boolean).length > 0 ? owners : undefined,
      targetAudience: targetAudience.filter(Boolean).length > 0 ? targetAudience : undefined,
      externalVisible,
      ddaItem,
      poolPriority: poolPriority || undefined,
      poolComplexity: poolComplexity || undefined,
      objectives: objectives.filter(Boolean).length > 0 ? objectives : undefined,
      description: description || undefined,
      acceptanceCriteria: acceptanceCriteria.filter(Boolean).length > 0 ? acceptanceCriteria : undefined,
      dependencies: dependencies.filter(Boolean).length > 0 ? dependencies : undefined,
    };

    if (isSprintBased) {
      updates.startSprint = startSprint;
      updates.endSprint = endSprint;
    } else {
      updates.startDate = startDate;
      updates.endDate = endDate;
    }

    updateItem(item.id, updates);
    onClose();
  };

  const handleDelete = () => {
    onDelete(item.id);
  };

  return (
    <div className="modal-overlay epic-modal-overlay" onClick={onClose}>
      <div className="modal-content epic-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="epic-modal-header">
          <h2>{item.name}</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Tabs */}
        <div className="epic-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            Basic
          </button>
          <button
            className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            Advanced
          </button>
        </div>

        {/* Body */}
        <div className="epic-modal-body">
          {activeTab === 'basic' && (
            <>
              <div className="form-group">
                <label>Item Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Epic Name</label>
                <input
                  type="text"
                  value={epicName}
                  onChange={(e) => setEpicName(e.target.value)}
                  placeholder="Optional grouping name"
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">-- None --</option>
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select value={poolPriority} onChange={(e) => setPoolPriority(e.target.value)}>
                    <option value="">-- None --</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="TBD">TBD</option>
                    <option value="TBC">TBC</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Complexity</label>
                  <select value={poolComplexity} onChange={(e) => setPoolComplexity(e.target.value)}>
                    <option value="">-- None --</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="TBD">TBD</option>
                    <option value="TBC">TBC</option>
                  </select>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={externalVisible} onChange={(e) => setExternalVisible(e.target.checked)} />
                    External Visible
                  </label>
                  <label className="checkbox-label" style={{ marginTop: '0.5rem' }}>
                    <input type="checkbox" checked={ddaItem} onChange={(e) => setDdaItem(e.target.checked)} />
                    DDA Item
                  </label>
                </div>
              </div>

              {/* Sprint or Date range */}
              {isSprintBased ? (
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Start Sprint</label>
                    <select value={startSprint} onChange={(e) => {
                      const val = Number(e.target.value);
                      setStartSprint(val);
                      if (endSprint < val) setEndSprint(val);
                    }}>
                      {sprintOptions.map((s) => (
                        <option key={s} value={s}>Sprint {s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>End Sprint</label>
                    <select value={endSprint} onChange={(e) => setEndSprint(Number(e.target.value))}>
                      {sprintOptions.filter((s) => s >= startSprint).map((s) => (
                        <option key={s} value={s}>Sprint {s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input type="date" value={startDate} onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                    }} />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              )}

              <BulletListEditor label="Owners" items={owners} onChange={setOwners} placeholder="Owner name" />
              <BulletListEditor label="Target Audience" items={targetAudience} onChange={setTargetAudience} placeholder="e.g., End Users, Service Providers" />
            </>
          )}

          {activeTab === 'advanced' && (
            <>
              <BulletListEditor label="Objectives" items={objectives} onChange={setObjectives} placeholder="Key objective" />

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of this epic..."
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.875rem', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', resize: 'vertical' }}
                />
              </div>

              <BulletListEditor label="Acceptance Criteria" items={acceptanceCriteria} onChange={setAcceptanceCriteria} placeholder="Acceptance criterion" />
              <BulletListEditor label="Dependencies" items={dependencies} onChange={setDependencies} placeholder="Dependency" />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="epic-modal-footer">
          <div>
            {showDeleteConfirm ? (
              <div className="delete-confirm">
                <span>Are you sure?</span>
                <button className="btn btn-small btn-danger" onClick={handleDelete}>Yes, delete</button>
                <button className="btn btn-small btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-small btn-secondary btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                Delete
              </button>
            )}
          </div>
          <div className="epic-modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
