import React, { useEffect, useState } from 'react';
import { 
  Warehouse as WarehouseIcon,
  Plus,
  Search,
  Building2,
  Truck,
  Archive,
  User,
  Package,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { 
  getWarehouses, 
  createWarehouse,
  updateWarehouse,
  deleteWarehouse 
} from '@/services/inventory.service';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Can from '@/components/auth/Can';

export default function WarehouseList() {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [editError, setEditError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    type: 'CENTRAL',
    user_id: null
  });
  const isTechnician = ['tecnico', 'technician'].includes((user?.role || '').toLowerCase());

  useEffect(() => {
    loadWarehouses();
  }, [isTechnician, user?.id]);

  useEffect(() => {
    applyFilters();
  }, [warehouses, searchTerm, typeFilter]);

  const loadWarehouses = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filters = isTechnician
        ? { warehouse_type: 'MOBILE', user_id: user?.id }
        : {};
      const data = await getWarehouses(filters);
      setWarehouses(data);
    } catch (err) {
      console.error('Error loading warehouses:', err);
      setError('No se pudieron cargar los almacenes');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...warehouses];
    
    // Filter by type
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(w => w.type === typeFilter);
    }
    
    // Filter by search term (name)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(w => 
        w.name.toLowerCase().includes(term)
      );
    }
    
    setFilteredWarehouses(filtered);
  };

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    
    try {
      // Validaciones frontend
      if (!formData.name.trim()) {
        throw new Error('El nombre es obligatorio');
      }
      
      // Preparar payload
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
      };
      
      await createWarehouse(payload);
      
      // Recargar lista
      await loadWarehouses();
      
      // Cerrar modal y resetear form
      setShowCreateModal(false);
      setFormData({ name: '', type: 'CENTRAL', user_id: null });
    } catch (err) {
      console.error('Error creating warehouse:', err);
      setCreateError(err.response?.data?.detail || err.message || 'Error al crear warehouse');
    } finally {
      setCreating(false);
    }
  };

  const handleEditWarehouse = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setEditError(null);
    
    try {
      if (!formData.name.trim()) {
        throw new Error('El nombre es obligatorio');
      }
      
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
      };
      
      await updateWarehouse(selectedWarehouse.id, payload);
      await loadWarehouses();
      
      setShowEditModal(false);
      setSelectedWarehouse(null);
      setFormData({ name: '', type: 'CENTRAL', user_id: null });
    } catch (err) {
      console.error('Error updating warehouse:', err);
      setEditError(err.response?.data?.detail || err.message || 'Error al actualizar warehouse');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteWarehouse = async () => {
    setDeleting(true);
    setDeleteError(null);
    
    try {
      await deleteWarehouse(selectedWarehouse.id);
      await loadWarehouses();
      
      setShowDeleteConfirm(false);
      setSelectedWarehouse(null);
    } catch (err) {
      console.error('Error deleting warehouse:', err);
      // Capturar error 409 (Conflict) que indica que tiene datos asociados
      if (err.response?.status === 409) {
        setDeleteError(err.response?.data?.detail || 'No se puede eliminar: el almacén tiene stock o movimientos asociados');
      } else {
        setDeleteError(err.response?.data?.detail || err.message || 'Error al eliminar warehouse');
      }
    } finally {
      setDeleting(false);
    }
  };

  const openEditModal = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      type: warehouse.type,
      user_id: warehouse.user_id || null
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const openDeleteConfirm = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'CENTRAL':
        return <Building2 className="w-5 h-5 text-blue-400" />;
      case 'MOBILE':
        return <Truck className="w-5 h-5 text-emerald-400" />;
      case 'VIRTUAL':
        return <Archive className="w-5 h-5 text-purple-400" />;
      case 'AUXILIAR':
        return <Archive className="w-5 h-5 text-amber-400" />;
      default:
        return <WarehouseIcon className="w-5 h-5 text-zinc-400" />;
    }
  };

  const getTypeBadge = (type) => {
    const colors = {
      CENTRAL: 'bg-blue-900/30 text-blue-300 border-blue-800',
      MOBILE: 'bg-emerald-900/30 text-emerald-300 border-emerald-800',
      VIRTUAL: 'bg-purple-900/30 text-purple-300 border-purple-800',
      AUXILIAR: 'bg-amber-900/30 text-amber-300 border-amber-800'
    };
    
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[type] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
        {type}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400 text-sm">Cargando almacenes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400">Almacenes</h1>
          <p className="text-zinc-400 mt-1">
            {isTechnician
              ? 'Vista táctica: solo stock del móvil asignado al técnico autenticado'
              : 'Gestión de depósitos centrales, camionetas técnicos y ubicaciones virtuales'}
          </p>
        </div>

        <Can resource="inventory" action="edit">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Almacén</span>
          </button>
        </Can>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-3 md:space-y-0">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
            />
          </div>
          
          {/* Type Filter (oculto para técnico para evitar navegación horizontal por móviles de terceros) */}
          {!isTechnician && (
            <div className="flex items-center space-x-2">
              {['ALL', 'CENTRAL', 'MOBILE', 'VIRTUAL', 'AUXILIAR'].map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    typeFilter === type
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {type === 'ALL' ? 'Todos' : type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 font-medium">Error</p>
            <p className="text-red-400/80 text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={loadWarehouses}
            className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded text-sm transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Warehouses Grid */}
      {filteredWarehouses.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <WarehouseIcon className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-400 mb-2">
            {searchTerm || typeFilter !== 'ALL' ? 'Sin resultados' : 'Sin almacenes'}
          </h3>
          <p className="text-zinc-500 text-sm mb-4">
            {searchTerm || typeFilter !== 'ALL' 
              ? 'No se encontraron almacenes con los filtros aplicados'
              : 'Crea tu primer almacén para comenzar'
            }
          </p>
          {!searchTerm && typeFilter === 'ALL' && (
            <Can resource="inventory" action="edit">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Crear Primer Almacén
              </button>
            </Can>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWarehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-emerald-800 hover:shadow-lg hover:shadow-emerald-900/20 transition-all group relative"
            >
              {/* Action Buttons (solo roles con edición) */}
              <Can resource="inventory" action="edit">
                <div className="absolute top-4 right-4 flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(warehouse);
                    }}
                    className="p-2 bg-zinc-800 hover:bg-blue-900/30 border border-zinc-700 hover:border-blue-700 text-zinc-400 hover:text-blue-400 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Editar almacén"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteConfirm(warehouse);
                    }}
                    className="p-2 bg-zinc-800 hover:bg-red-900/30 border border-zinc-700 hover:border-red-700 text-zinc-400 hover:text-red-400 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Eliminar almacén"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Can>

              {/* Header */}
              <div className="flex items-start justify-between mb-4 pr-20">
                <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700 group-hover:border-emerald-800 transition-colors">
                  {getTypeIcon(warehouse.type)}
                </div>
                {getTypeBadge(warehouse.type)}
              </div>
              
              {/* Name */}
              <Link
                to={`/app/inventory/warehouses/${warehouse.id}`}
                className="block"
              >
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                  {warehouse.name}
                </h3>
              </Link>
              
              {/* Vehicle info (MOBILE) */}
              {warehouse.vehicle && (
                <div className="mb-3 px-3 py-2 rounded-md bg-emerald-900/20 border border-emerald-800/30">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
                    <Truck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Móvil asignado</span>
                  </div>
                  <p className="text-sm text-emerald-300 font-medium truncate">
                    {warehouse.vehicle.full_name || warehouse.vehicle.name}
                  </p>
                  {warehouse.vehicle.license_plate && (
                    <p className="text-xs text-zinc-400 truncate">
                      Patente: {warehouse.vehicle.license_plate}
                    </p>
                  )}
                  {warehouse.vehicle.vehicle_model && (
                    <p className="text-xs text-zinc-500 truncate">
                      {warehouse.vehicle.vehicle_brand || ''} {warehouse.vehicle.vehicle_model}
                      {warehouse.vehicle.vehicle_year ? ` · ${warehouse.vehicle.vehicle_year}` : ''}
                    </p>
                  )}
                </div>
              )}
              
              {/* Details */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-zinc-400">
                  <Package className="w-4 h-4" />
                  <span>ID: {warehouse.id}</span>
                </div>
                
                {warehouse.user_id && (
                  <div className="flex items-center space-x-2 text-sm text-emerald-400">
                    <User className="w-4 h-4" />
                    <span>Técnico #{warehouse.user_id}</span>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <Link
                to={`/app/inventory/warehouses/${warehouse.id}`}
                className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between"
              >
                <span className="text-xs text-zinc-500">
                  Creado {new Date(warehouse.created_at).toLocaleDateString()}
                </span>
                <span className="text-emerald-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Ver detalles →
                </span>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Stats Footer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">
            Mostrando <span className="text-white font-medium">{filteredWarehouses.length}</span> de <span className="text-white font-medium">{warehouses.length}</span> almacenes
          </span>
          <div className="flex items-center space-x-4 text-zinc-500">
            <span>{warehouses.filter(w => w.type === 'CENTRAL').length} principales</span>
            <span>•</span>
            <span>{warehouses.filter(w => w.type === 'MOBILE').length} móviles</span>
            <span>•</span>
            <span>{warehouses.filter(w => w.type === 'VIRTUAL').length} virtuales</span>
            <span>•</span>
            <span>{warehouses.filter(w => w.type === 'AUXILIAR').length} auxiliares</span>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-lg w-full p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-emerald-400">Nuevo Almacén</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                  setFormData({ name: '', type: 'CENTRAL', user_id: null });
                }}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Error Alert */}
            {createError && (
              <div className="mb-4 bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{createError}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateWarehouse} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Nombre del Almacén *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Depósito Central Buenos Aires"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Tipo de Almacén *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                >
                  <option value="CENTRAL">CENTRAL - Depósito principal</option>
                  <option value="AUXILIAR">AUXILIAR - Depósito Auxiliar</option>
                  <option value="VIRTUAL">VIRTUAL - Ubicación lógica</option>
                </select>
                <p className="mt-1 text-xs text-zinc-500">
                  Los almacenes tipo MOBILE se crean automáticamente desde el módulo Flota
                </p>
              </div>

              {/* Buttons */}
              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError(null);
                    setFormData({ name: '', type: 'CENTRAL', user_id: null });
                  }}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creando...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Crear Almacén</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedWarehouse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-blue-400">Editar Almacén</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditError(null);
                  setSelectedWarehouse(null);
                  setFormData({ name: '', type: 'CENTRAL', user_id: null });
                }}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{editError}</p>
              </div>
            )}

            <form onSubmit={handleEditWarehouse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Nombre del Almacén *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Depósito Central Buenos Aires"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Tipo de Almacén *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                >
                  <option value="CENTRAL">CENTRAL - Depósito principal</option>
                  <option value="AUXILIAR">AUXILIAR - Depósito Auxiliar</option>
                  <option value="VIRTUAL">VIRTUAL - Ubicación lógica</option>
                </select>
                {formData.type === 'MOBILE' && (
                  <p className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                    ⚠️ Los almacenes MOBILE se gestionan desde el módulo Flota.
                    No es posible cambiar su tipo aquí.
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditError(null);
                    setSelectedWarehouse(null);
                    setFormData({ name: '', type: 'CENTRAL', user_id: null });
                  }}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {updating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Actualizando...</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedWarehouse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-red-900/50 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-900/30 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-red-400">Confirmar Eliminación</h2>
              </div>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                  setSelectedWarehouse(null);
                }}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {deleteError && (
              <div className="mb-4 bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-300 text-sm font-medium">No se puede eliminar</p>
                  <p className="text-red-400/80 text-xs mt-1">{deleteError}</p>
                </div>
              </div>
            )}

            <div className="mb-6">
              <p className="text-zinc-300 mb-2">
                ¿Estás seguro de que deseas eliminar el almacén:
              </p>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-white font-semibold">{selectedWarehouse.name}</p>
                <p className="text-zinc-500 text-sm mt-1">Tipo: {selectedWarehouse.type}</p>
              </div>
              
              <div className="mt-4 bg-amber-900/20 border border-amber-900/50 rounded-lg p-3">
                <p className="text-amber-300 text-sm font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Advertencia</span>
                </p>
                <p className="text-amber-400/80 text-xs mt-1">
                  Esta acción no se puede deshacer. Solo se pueden eliminar almacenes sin stock ni historial de movimientos.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                  setSelectedWarehouse(null);
                }}
                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteWarehouse}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Almacén</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
