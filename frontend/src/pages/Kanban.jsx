import { useCallback, useEffect, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

const COLUMNS = [
  { id: 'pending', key: 'kanban.pending' },
  { id: 'in_progress', key: 'kanban.inProgress' },
  { id: 'completed', key: 'kanban.completed' },
  { id: 'blocked', key: 'kanban.blocked' },
];

function groupByStatus(reminders) {
  const grouped = { pending: [], in_progress: [], completed: [], blocked: [] };
  for (const r of [...reminders].sort((a, b) => a.order - b.order)) {
    grouped[r.status || 'pending']?.push(r);
  }
  return grouped;
}

export default function Kanban() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [reminders, setReminders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffFilter, setStaffFilter] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const params = staffFilter ? { assignedTo: staffFilter } : {};
    client
      .get('/reminders', { params })
      .then((res) => setReminders(res.data.reminders))
      .catch(() => setError('Could not load reminders'));
  }, [staffFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (['admin', 'manager', 'viewer'].includes(user?.role)) {
      client.get('/staff').then((res) => setStaff(res.data.staff)).catch(() => {});
    }
  }, [user]);

  const staffNameById = Object.fromEntries(staff.map((s) => [s.id, s.name]));

  const readOnly = user?.role === 'viewer';

  async function onDragEnd(result) {
    if (readOnly) return;
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    setReminders((prev) => {
      const grouped = groupByStatus(prev);
      const [moved] = grouped[source.droppableId].splice(source.index, 1);
      moved.status = destination.droppableId;
      grouped[destination.droppableId].splice(destination.index, 0, moved);
      return COLUMNS.flatMap((c) => grouped[c.id].map((r, i) => ({ ...r, order: i })));
    });

    try {
      await client.patch(`/reminders/${draggableId}/status`, {
        status: destination.droppableId,
        order: destination.index,
      });
    } catch {
      load();
    }
  }

  const grouped = groupByStatus(reminders);

  return (
    <div>
      <div className="page-head">
        <h1>{t('nav.kanban')}</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {readOnly && <p className="muted text-sm">{t('kanban.readOnly')}</p>}

      {staff.length > 0 && (
        <div className="row mt" style={{ marginBottom: '1rem' }}>
          <select className="select" style={{ width: 'auto' }} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
            <option value="">{t('kanban.allStaff')}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kanban-board">
          {COLUMNS.map((col) => (
            <Droppable droppableId={col.id} key={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`kanban-column${snapshot.isDraggingOver ? ' drop-target' : ''}`}
                >
                  <div className="kanban-column-head">
                    <span>{t(col.key)}</span>
                    <span>{grouped[col.id].length}</span>
                  </div>
                  {grouped[col.id].map((r, index) => (
                    <Draggable draggableId={r.id} index={index} key={r.id} isDragDisabled={readOnly}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className={`kanban-card${dragSnapshot.isDragging ? ' dragging' : ''}`}
                        >
                          <div className="kanban-card-title">{r.title}</div>
                          <div className="kanban-card-meta">
                            <span className={`badge badge-${r.priority}`}>{r.priority}</span>
                            {r.assignedTo && staffNameById[r.assignedTo] && ` · ${staffNameById[r.assignedTo]}`}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
