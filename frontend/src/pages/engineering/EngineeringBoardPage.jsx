import React, { useState, useEffect } from 'react';
import { useSensors, useSensor, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ClipboardList, Flame, Eye, CheckCircle2 } from 'lucide-react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
// Definición de columnas Kanban
const COLUMNS = [
  {
    id: 'backlog',
    label: 'Backlog',
    status: 'backlog',
    icon: ClipboardList,
    color: 'border-zinc-700',
    bgColor: 'bg-zinc-950',
    description: 'Tareas nuevas o sin asignar',
  },
  {
    id: 'in_progress',
    label: 'En Progreso',
    status: 'in_progress',
    icon: Flame,
    color: 'border-amber-700',
    bgColor: 'bg-amber-950',
    description: 'Tareas activas en curso',
  },
  {
    id: 'testing',
    label: 'En Pruebas',
    status: 'testing',
    icon: Eye,
    color: 'border-blue-700',
    bgColor: 'bg-blue-950',
    description: 'Tareas en validación',
  },
  {
    id: 'completed',
    label: 'Completadas',
    status: 'completed',
    icon: CheckCircle2,
    color: 'border-emerald-700',
    bgColor: 'bg-emerald-950',
    description: 'Tareas finalizadas (24h)',
  },
];
// EngineeringBoardPage - Tablero Kanban NOC Premium
// ...existing code...
const PRIORITY_CONFIG = {
  low: { label: 'Baja', color: 'bg-zinc-700/40 text-zinc-200 border-zinc-600' },
  medium: { label: 'Media', color: 'bg-amber-700/40 text-amber-200 border-amber-600' },
  high: { label: 'Alta', color: 'bg-ruby-700/40 text-ruby-200 border-ruby-600' },
  critical: { label: 'Crítica', color: 'bg-red-700/40 text-red-100 border-red-600' },
};

// Configuración de tipos
const TYPE_CONFIG = {
  incident: { label: '🚨 Incidente', color: 'text-ruby-300' },
  maintenance: { label: '🔧 Mantenimiento', color: 'text-blue-300' },
};

// Componente: Tarjeta de Tarea (Sortable)
function SortableTaskCard({ task, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task' } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const typeInfo = TYPE_CONFIG[task.task_type] || TYPE_CONFIG.incident;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className="group relative p-4 rounded-lg border border-zinc-800/60 bg-zinc-900/80 hover:bg-zinc-800/60 hover:border-emerald-700/50 transition-all cursor-grab active:cursor-grabbing"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-emerald-300 transition-colors">
            {task.title}
          </h3>
        </div>
        <Badge variant="outline" className={`text-xs font-medium ${priorityInfo.color}`}>
          {priorityInfo.label}
        </Badge>
      </div>

      {/* Metadata */}
      <div className="space-y-2">
        {/* Tipo */}
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
        </div>

        {/* Ticket asociado (si existe) */}
        {task.ticket_id && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span>Ticket #{task.ticket_id}</span>
          </div>
        )}

        {/* Asignación */}
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/50">
          {task.assigned_to_name ? (
            <>
              <div className="w-6 h-6 rounded-full bg-emerald-900/50 border border-emerald-700/50 flex items-center justify-center">
                <User size={12} className="text-emerald-400" />
              </div>
              <span className="text-xs text-zinc-400 truncate">
                {task.assigned_to_name}
              </span>
            </>
          ) : (
            <span className="text-xs text-zinc-600 flex items-center gap-1">
              <AlertCircle size={12} />
              Sin asignar
            </span>
          )}
        </div>
      </div>

      {/* Indicador de hover */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}

// Componente: Columna del Kanban (Droppable)
function KanbanColumn({ column, tasks, onTaskClick }) {
  const Icon = column.icon;
  // Droppable para la columna (siempre activo)
  const droppableId = tasks.length === 0 ? `column-droppable-${column.id}` : `column-${column.id}`;
  const droppableType = tasks.length === 0 ? 'column' : 'column';
  const { setNodeRef: setColumnRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: droppableType },
  });
  if (tasks.length === 0) {
    console.log('Render droppable columna vacía:', droppableId, droppableType);
  }

  return (
    <div className="flex flex-col h-full flex-1 min-w-0">
      {/* Header de columna */}
      <div className={`rounded-t-xl border-t border-x ${column.color} ${column.bgColor} p-4`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon size={16} className="text-zinc-400" />
          <h2 className="text-sm font-bold text-white">
            {column.label}
          </h2>
          <Badge variant="outline" className="ml-auto bg-zinc-900/50 border-zinc-700 text-zinc-300 text-xs">
            {tasks.length}
          </Badge>
        </div>
        <p className="text-xs text-zinc-500">{column.description}</p>
      </div>

      {/* Si la columna está vacía, el droppable va fuera del SortableContext y NO comparte id con ningún task */}
      {tasks.length === 0 ? (
        <div
          ref={setColumnRef}
          className={`flex-1 rounded-b-xl border-x border-b ${column.color} ${column.bgColor} p-3 min-h-[400px] flex flex-col items-center justify-center relative z-10 ${isOver ? 'border-emerald-400 bg-emerald-900/10 border-2 border-dashed' : 'border-zinc-700/40 bg-transparent border'} transition-all`}
          style={{ minHeight: '120px', display: 'flex', flexDirection: 'column' }}
        >
          <Icon size={32} className="text-zinc-700 mb-2" />
          <p className="text-xs text-zinc-600">No hay tareas en esta columna</p>
        </div>
      ) : (
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div
            ref={setColumnRef}
            className={`flex-1 rounded-b-xl border-x border-b ${column.color} ${column.bgColor} p-3 min-h-[400px] flex flex-col overflow-y-auto space-y-3 relative z-10 ${isOver ? 'border-emerald-400 bg-emerald-900/10 border-2 border-dashed' : 'border-zinc-700/40 bg-transparent border'} transition-all`}
            style={{ minHeight: '120px', display: 'flex', flexDirection: 'column' }}
          >
            {tasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} onClick={onTaskClick} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

// Componente: Modal de Detalle/Edición de Tarea
function TaskDetailModal({ task, isOpen, onClose, onUpdate }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(task?.status || 'backlog');
  const [selectedUser, setSelectedUser] = useState(task?.assigned_to_id || null);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // ...existing code...

  if (!task) return null;

  const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const typeInfo = TYPE_CONFIG[task.task_type] || TYPE_CONFIG.incident;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Wrench size={18} className="text-purple-400" />
            Tarea #{task.id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Título */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Título</p>
            <h3 className="text-base font-semibold text-white">{task.title}</h3>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Tipo</p>
              <span className={`text-sm ${typeInfo.color}`}>{typeInfo.label}</span>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Prioridad</p>
              <Badge variant="outline" className={`${priorityInfo.color}`}>
                {priorityInfo.label}
              </Badge>
            </div>
          </div>

          {/* Descripción */}
          {task.description && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Descripción</p>
              <p className="text-sm text-zinc-300 bg-zinc-950/50 rounded p-3">
                {task.description}
              </p>
            </div>
          )}

          {/* Ticket asociado */}
          {task.ticket_id && (
            <div className="p-3 rounded-lg border border-emerald-900/50 bg-emerald-950/20">
              <p className="text-xs text-emerald-500 uppercase tracking-wide mb-1">
                Ticket Asociado
              </p>
              <a
                href={`/app/tickets/${task.ticket_id}`}
                className="text-sm font-medium text-emerald-300 hover:text-emerald-200 hover:underline"
              >
                Ver Ticket #{task.ticket_id}
              </a>
            </div>
          )}

          {/* Cambiar Estado */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Estado de la Tarea
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              disabled={isUpdating}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="backlog">📋 Backlog</option>
              <option value="in_progress">🔥 En Progreso</option>
              <option value="testing">👀 En Pruebas</option>
              <option value="completed">✅ Completada</option>
            </select>
          </div>

          {/* Asignar Ingeniero */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Asignar a Ingeniero
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader size={14} className="animate-spin" />
                Cargando ingenieros...
              </div>
            ) : (
              <select
                value={selectedUser || ''}
                onChange={(e) => setSelectedUser(e.target.value ? Number(e.target.value) : null)}
                disabled={isUpdating}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">Sin asignar</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-xs text-zinc-500 pt-3 border-t border-zinc-800">
            <div>
              <span className="block">Creada:</span>
              <span className="text-zinc-400">
                {new Date(task.created_at).toLocaleDateString('es-AR')}
              </span>
            </div>
            {task.completed_at && (
              <div>
                <span className="block">Completada:</span>
                <span className="text-emerald-400">
                  {new Date(task.completed_at).toLocaleDateString('es-AR')}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isUpdating ? (
              <>
                <Loader size={16} className="mr-2 animate-spin" />
                Actualizando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Componente: KPI Card
function KPICard({ icon: Icon, label, value, color = 'text-zinc-400', trend }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-10 h-10 rounded-lg bg-zinc-800/50 flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trend > 0 ? 'text-emerald-400' : 'text-ruby-400'}`}>
            <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

// Componente Principal
export default function EngineeringBoardPage() {
    // Handler visual de dragOver (Gemini)
    const handleDragOver = (event) => {
          // LOG: Inspección de datos de drag
          console.log('DRAG OVER', {
            activeId: event.active.id,
            overId: event.over?.id,
            activeData: event.active.data?.current,
            overData: event.over?.data?.current,
          });
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id;
      const overId = over.id;

      // Si estoy sobre el mismo item, no hago nada
      if (activeId === overId) return;

      // Encontrar la tarea activa
      const isActiveTask = active.data.current?.type === 'task';
      const isOverTask = over.data.current?.type === 'task';
      const isOverColumn = over.data.current?.type === 'column';

      if (!isActiveTask) return;

      // ESCENARIO 1: Mover sobre otra tarea en diferente columna
      if (isActiveTask && isOverTask) {
        setTasks((tasks) => {
          const activeIndex = tasks.findIndex((t) => t.id === activeId);
          const overIndex = tasks.findIndex((t) => t.id === overId);
          if (activeIndex === -1 || overIndex === -1) return tasks;
          // Si están en diferente status, cambiamos el status visualmente
          if (tasks[activeIndex].status !== tasks[overIndex].status) {
             const newTasks = [...tasks];
             newTasks[activeIndex].status = tasks[overIndex].status;
             return arrayMove(newTasks, activeIndex, overIndex);
          }
          // Si es la misma columna, solo reordenar
          return arrayMove(tasks, activeIndex, overIndex);
        });
      }

      // ESCENARIO 2: Mover sobre una columna vacía
      if (isActiveTask && isOverColumn) {
        setTasks((tasks) => {
          const activeIndex = tasks.findIndex((t) => t.id === activeId);
          if (activeIndex === -1) return tasks;
          const newStatus = over.id;
          if (tasks[activeIndex].status !== newStatus) {
            const newTasks = [...tasks];
            newTasks[activeIndex].status = newStatus;
            return arrayMove(newTasks, activeIndex, activeIndex);
          }
          return tasks;
        });
      }
    };
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);

  // Sensors para drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadTasks = async () => {
    try {
      setError(null);
      const data = await engineeringService.getTasks({ limit: 100 });
      setTasks(data?.items || (Array.isArray(data) ? data : []));
    } catch (err) {
      if (err?.response?.status === 404) {
        setTasks([]);
      } else {
        setError(err.message || 'Error al cargar las tareas');
      }
      console.error('Error loading tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleTaskUpdate = () => {
    loadTasks();
    setShowTaskModal(false);
    setSelectedTask(null);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    loadTasks();
  };

  // Drag & Drop robusto
  const handleDragStart = (event) => {
    const { active } = event;
    setDraggedTaskId(active.id);
    setActiveTask(tasks.find(t => t.id === active.id) || null);
  };

  const handleDragEnd = async (event) => {
        // LOG: Inspección de datos de dragEnd
        console.log('DRAG END', {
          activeId: event.active.id,
          overId: event.over?.id,
          activeData: event.active.data?.current,
          overData: event.over?.data?.current,
        });
    const { active, over } = event;
    setDraggedTaskId(null);
    setActiveTask(null);
    if (!over) return;
    const fromTask = tasks.find(t => t.id === active.id);
    if (!fromTask) return;
    let toColumn = null;
    // Si se suelta sobre columna (vacía o no)
    const directColumn = COLUMNS.find(c => c.id === over.id);
    if (directColumn) {
      toColumn = directColumn.status;
    } else {
      // Si se suelta sobre otra tarea, usar su status
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask) toColumn = overTask.status;
    }
    // Permitir mover aunque la columna esté vacía
    if (!toColumn) return;
    if (fromTask.status === toColumn) return;
    // UI optimista
    setTasks(prev => prev.map(t => t.id === fromTask.id ? { ...t, status: toColumn } : t));
    try {
      await engineeringService.updateTask(fromTask.id, { status: toColumn });
    } catch (e) {
      // Rollback
      loadTasks();
      alert('Error al actualizar la tarea.');
    }
  };

  // Filtrar tareas
  const filteredTasks = tasks.filter((task) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        task.title?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.id?.toString().includes(query);
      if (!matchesSearch) return false;
    }

    if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
      return false;
    }

    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned' && task.assigned_to_id) return false;
      if (assigneeFilter !== 'unassigned' && task.assigned_to_id?.toString() !== assigneeFilter) return false;
    }

    return true;
  });

  // Distribuir tareas en columnas
  const tasksByColumn = COLUMNS.reduce((acc, column) => {
    acc[column.id] = filteredTasks.filter((task) => {
      if (column.status === 'completed') {
        if (task.status !== 'completed') return false;
        if (!task.completed_at) return true; // Incluir si no tiene fecha
        const completedAt = new Date(task.completed_at);
        const now = new Date();
        const diffHours = (now - completedAt) / (1000 * 60 * 60);
        return diffHours <= 24;
      }
      return task.status === column.status;
    });
    return acc;
  }, {});

  // Calcular KPIs
  const kpis = {
    totalBacklog: tasksByColumn.backlog?.length || 0,
    totalInProgress: tasksByColumn.in_progress?.length || 0,
    totalTesting: tasksByColumn.testing?.length || 0,
    completedToday: tasksByColumn.completed?.length || 0,
  };

  // Calcular tiempo promedio (simulado - en producción vendría del backend)
  const avgCompletionTime = '2.3 días';

  // Task activa para el DragOverlay ya está gestionada

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6 pb-6 max-w-full overflow-hidden">
        {/* Header principal */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-bold text-emerald-300 flex items-center gap-2">
              <Wrench size={22} className="text-emerald-400" /> Tablero Kanban NOC
            </h1>
            <p className="text-sm text-zinc-400 mt-1">Gestión visual de tareas de ingeniería y NOC</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateModal(true)} className="bg-emerald-700 hover:bg-emerald-600 text-white font-semibold">
              <Plus size={16} className="mr-1" /> Nueva Tarea
            </Button>
            <Button variant="outline" onClick={handleRefresh} className="border-zinc-700 text-zinc-300">
              <RefreshCw size={16} className="mr-1" /> Refrescar
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KPICard icon={Inbox} label="Backlog" value={kpis.totalBacklog} color="text-zinc-400" />
          <KPICard icon={Clock} label="En Progreso" value={kpis.totalInProgress} color="text-amber-400" />
          <KPICard icon={FlaskConical} label="En Pruebas" value={kpis.totalTesting} color="text-blue-400" />
          <KPICard icon={CheckCircle2} label="Completadas 24h" value={kpis.completedToday} color="text-emerald-400" />
        </div>

        {/* Toolbar de filtros y búsqueda */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
          <Input
            type="text"
            placeholder="Buscar tarea, ticket o ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full md:w-64 bg-zinc-900 border-zinc-700 text-white"
          />
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todas las prioridades</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todos los ingenieros</option>
            <option value="unassigned">Sin asignar</option>
            {/* Aquí podrías mapear ingenieros si se desea */}
          </select>
        </div>

        {/* Tablero Kanban con Drag & Drop */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
          {COLUMNS.map((column) => (
            <div key={column.id} id={column.id} className="min-w-0">
              <KanbanColumn
                column={column}
                tasks={tasksByColumn[column.id] || []}
                onTaskClick={handleTaskClick}
                activeTaskId={draggedTaskId}
              />
            </div>
          ))}
        </div>
        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? (
            <div className="p-4 rounded-lg border border-emerald-700 bg-zinc-900 shadow-2xl opacity-90">
              <h3 className="text-sm font-semibold text-white line-clamp-1">
                {activeTask.title}
              </h3>
            </div>
          ) : null}
        </DragOverlay>
      </div>
      {/* Modal: Detalle de Tarea */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
      />
      {/* Modal: Nueva Tarea Interna */}
      <CreateInternalTaskDialog
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          loadTasks();
          setShowCreateModal(false);
        }}
      />
    </DndContext>
  );
}
