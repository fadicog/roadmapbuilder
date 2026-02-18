import { useState, useMemo } from 'react';
import { useItems, useRoadmapStore } from '../store/roadmapStore';
import { EpicEditModal } from './EpicEditModal';
import { CATEGORY_COLORS } from '../data/poolItems';
import type { RoadmapItem } from '../types';

function getTimelineDisplay(item: RoadmapItem): string {
  if (item.startSprint !== undefined && item.endSprint !== undefined) return `S${item.startSprint} \u2013 S${item.endSprint}`;
  if (item.startDate && item.endDate) return `${item.startDate} \u2013 ${item.endDate}`;
  return '\u2014';
}

export function EpicsView() {
  const allItems = useItems();
  const { deleteItem } = useRoadmapStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [epicEditItemId, setEpicEditItemId] = useState<string | null>(null);

  const epicEditItem = allItems.find(i => i.id === epicEditItemId) ?? null;

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return allItems;
    return allItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      (item.epicName || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.owners || []).some(o => o.toLowerCase().includes(q))
    );
  }, [allItems, searchQuery]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aVal = String((a as any)[sortColumn] ?? '');
      const bVal = String((b as any)[sortColumn] ?? '');
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredItems, sortColumn, sortDir]);

  const handleSort = (col: string) => {
    if (sortColumn === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDir('asc'); }
  };

  const sortIcon = (col: string) => {
    if (sortColumn !== col) return ' \u21D5';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  return (
    <div className="epics-view">
      <div className="epics-header">
        <h2>Epics Browser</h2>
        <input
          type="search"
          className="epics-search"
          placeholder="Search by name, epic, category, owner..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {allItems.length === 0 ? (
        <div className="empty-state">
          <p>No items yet -- add items from the Timeline view.</p>
        </div>
      ) : (
        <div className="epics-table-wrapper">
          <table className="epics-table">
            <thead>
              <tr>
                <th>#</th>
                <th className="sortable-col" onClick={() => handleSort('name')}>Name{sortIcon('name')}</th>
                <th className="sortable-col" onClick={() => handleSort('epicName')}>Epic Name{sortIcon('epicName')}</th>
                <th className="sortable-col" onClick={() => handleSort('category')}>Category{sortIcon('category')}</th>
                <th>Owners</th>
                <th>Target Audience</th>
                <th>Timeline</th>
                <th className="sortable-col" onClick={() => handleSort('poolPriority')}>Priority{sortIcon('poolPriority')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, idx) => {
                const catStyle = item.category ? CATEGORY_COLORS[item.category] : undefined;
                return (
                  <tr key={item.id} className="epics-row" onClick={() => setEpicEditItemId(item.id)}>
                    <td>{idx + 1}</td>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.epicName || <span className="text-muted">&mdash;</span>}</td>
                    <td>
                      {item.category ? (
                        <span className="pool-category-badge" style={catStyle ? { backgroundColor: catStyle.bg, color: catStyle.text } : {}}>
                          {item.category}
                        </span>
                      ) : <span className="text-muted">&mdash;</span>}
                    </td>
                    <td>
                      {(item.owners || []).filter(Boolean).map((o, i) => <div key={i}>{o}</div>)}
                      {!(item.owners?.length) && <span className="text-muted">&mdash;</span>}
                    </td>
                    <td>
                      {(item.targetAudience || []).filter(Boolean).map((a, i) => <div key={i}>{a}</div>)}
                      {!(item.targetAudience?.length) && <span className="text-muted">&mdash;</span>}
                    </td>
                    <td>{getTimelineDisplay(item)}</td>
                    <td>{item.poolPriority || <span className="text-muted">&mdash;</span>}</td>
                    <td>
                      <button
                        className="btn btn-small btn-secondary"
                        onClick={e => { e.stopPropagation(); setEpicEditItemId(item.id); }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {epicEditItem && (
        <EpicEditModal
          item={epicEditItem}
          isOpen={true}
          onClose={() => setEpicEditItemId(null)}
          onDelete={id => { deleteItem(id); setEpicEditItemId(null); }}
        />
      )}
    </div>
  );
}
