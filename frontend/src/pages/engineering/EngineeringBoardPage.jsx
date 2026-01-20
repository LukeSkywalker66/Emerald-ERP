import React, { useState, useEffect } from 'react';

// Dnd Kit Core
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  useDroppable, 
  pointerWithin, 
  rectIntersection // <--- Fundamental
} from '@dnd-kit/core';

// Dnd Kit Sortable
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';

// UI & Icons
import { 
  ClipboardList, Flame, Eye, CheckCircle2, Wrench, Plus, 
  RefreshCw, Inbox, Clock, FlaskConical, User, AlertCircle, 
  TrendingUp, Loader 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// Services & Components
import CreateInternalTaskDialog from '@/components/engineering/CreateInternalTaskDialog';
import engineeringService from '@/services/engineering.service';
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
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
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
      className="group relative p-4 rounded-lg border border-zinc-800/60 bg-zinc-900/80 hover:bg-zinc-800/60 hover:border-emerald-700/50 transition-all cursor-grab active:cursor-grabbing min-w-0"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-emerald-300 transition-colors truncate">
            {task.title}
          </h3>
        </div>
        <Badge variant="outline" className={`text-xs font-medium max-w-[80px] whitespace-nowrap overflow-hidden text-ellipsis ${priorityInfo.color}`} title={priorityInfo.label}>
          {priorityInfo.label}
        </Badge>
      </div>

      {/* Metadata */}
      <div className="space-y-2 min-w-0">
        {/* Tipo */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-xs font-medium truncate ${typeInfo.color}`} title={typeInfo.label}>
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
  
  // 1. EL FIX: Usamos el ID directo, sin prefijos raros
  const { setNodeRef, isOver } = useDroppable({
    id: column.id, // Ej: 'backlog' (coincide con tu config)
    data: { 
      type: 'column',
      status: column.status // Pasamos el status directo para leerlo fácil
    },
  });

  return (
    <div className="flex flex-col h-full flex-1 min-w-0 w-full max-w-[360px]">
      {/* Header */}
      <div className={`rounded-t-xl border-t border-x ${column.color} ${column.bgColor} p-4`}>
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <Icon size={16} className="text-zinc-400 shrink-0" />
          <h2 className="text-sm font-bold text-white truncate max-w-[120px]">{column.label}</h2>
          <Badge variant="outline" className="ml-auto bg-zinc-900/50 border-zinc-700 text-zinc-300 text-xs whitespace-nowrap max-w-[60px] overflow-hidden text-ellipsis">
            {tasks.length}
          </Badge>
        </div>
      </div>

      {/* Body Droppable Unificado */}
      <div
        ref={setNodeRef} // <--- El ref va siempre aquí
        className={`flex-1 rounded-b-xl border-x border-b ${column.color} p-3 overflow-y-auto space-y-3 transition-all ${
          isOver ? 'bg-zinc-800/50 ring-2 ring-inset ring-emerald-500/20' : 'bg-transparent'
        }`}
        style={{ minHeight: '400px' }} // Altura mínima obligatoria
        
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </SortableContext>

        {/* Placeholder visual solo si está vacío */}
        {tasks.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600/50 border-2 border-dashed border-zinc-800/30 rounded-lg min-h-[100px]">
             <Icon size={32} className="mb-2 opacity-20" />
             <p className="text-xs">Soltar aquí</p>
          </div>
        )}
      </div>
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
        {/* ...existing code... */}
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
    const { active, over } = event;

    setDraggedTaskId(null);
    setActiveTask(null);

    if (!over) return;

    const fromTask = tasks.find(t => t.id === active.id);
    if (!fromTask) return;

    let newStatus = null;

    if (over.data.current?.type === 'column') {
      newStatus = over.id;
    } 
    else if (over.data.current?.type === 'task') {
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask) {
        newStatus = overTask.status;
      }
    }
    else if (['backlog', 'in_progress', 'testing', 'completed'].includes(over.id)) {
      newStatus = over.id;
    }

    if (!newStatus) return;

    setTasks(prev => prev.map(t => 
      t.id === fromTask.id ? { ...t, status: newStatus } : t
    ));

    try {
      const statusPayload = { status: newStatus };
      await engineeringService.updateTask(fromTask.id, statusPayload);
    } catch (e) {
      loadTasks();
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
      collisionDetection={pointerWithin}
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

        {/* Tablero Kanban con scroll horizontal y sin superposición */}
        {/* Tablero Kanban con Grid Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
          {COLUMNS.map((column) => (
            <div key={column.id} id={column.id}
              /* No min-w/max-w/flex-1: que el grid reparta el espacio */
            >
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
