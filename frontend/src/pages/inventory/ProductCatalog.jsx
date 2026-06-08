import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  AlertCircle,
  Loader,
  Package,
  Droplets,
  QrCode,
  X,
  Trash2,
  Edit2
} from 'lucide-react';
import {
  getProducts,
  createProduct,
  createSerialItem,
  updateProduct,
  deleteProduct,
  getProductCategories,
  getProductGroups,
  updateProductSpecs
} from '@/services/inventory.service';

export default function ProductCatalog() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [productGroups, setProductGroups] = useState([]);

  // Search/Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [editError, setEditError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Specs editor state
  const [specsForm, setSpecsForm] = useState({});
  const [savingSpecs, setSavingSpecs] = useState(false);
  const [specsError, setSpecsError] = useState(null);

  // Form state — expanded with new fields
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    type: 'BULK',
    category: 'Cableado',
    description: '',
    min_stock_alert: 50,
    serial_numbers: '',
    // Nuevos campos
    group_id: '',
    is_composite: false,
    unit_size: '',
    unit_measure: 'm',
    composite_unit_label: '',
    specs: {}
  });

  const resetFormData = () => setFormData({
    name: '',
    sku: '',
    type: 'BULK',
    category: 'Cableado',
    description: '',
    min_stock_alert: 50,
    serial_numbers: '',
    group_id: '',
    is_composite: false,
    unit_size: '',
    unit_measure: 'm',
    composite_unit_label: '',
    specs: {}
  });

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadProductGroups();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchTerm, typeFilter, categoryFilter, groupFilter]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error loading products:', err);
      setError('No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getProductCategories();
      setCategories(data || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadProductGroups = async () => {
    try {
      const data = await getProductGroups();
      setProductGroups(data || []);
    } catch (err) {
      console.error('Error loading product groups:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    // Filter by type
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(p => p.type === typeFilter);
    }

    // Filter by category
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    // Filter by group
    if (groupFilter !== 'ALL') {
      filtered = filtered.filter(p => p.group_id === parseInt(groupFilter));
    }

    // Search by name or SKU
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term)
      );
    }

    setFilteredProducts(filtered);
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      // Validations
      if (!formData.name.trim()) {
        throw new Error('El nombre es obligatorio');
      }
      if (!formData.sku.trim()) {
        throw new Error('El SKU es obligatorio');
      }

      // Check SKU uniqueness
      if (products.some(p => p.sku.toUpperCase() === formData.sku.toUpperCase())) {
        throw new Error('El SKU ya existe en el catálogo');
      }

      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        type: formData.type,
        category: formData.category || null,
        description: formData.description.trim() || null,
        min_stock_alert: parseInt(formData.min_stock_alert) || 0,
        // Nuevos campos
        group_id: formData.group_id ? parseInt(formData.group_id) : null,
        is_composite: formData.type === 'BULK' ? formData.is_composite : false,
        unit_size: formData.is_composite && formData.unit_size ? parseFloat(formData.unit_size) : null,
        unit_measure: formData.is_composite ? (formData.unit_measure || 'm') : null,
        composite_unit_label: formData.is_composite ? (formData.composite_unit_label || null) : null,
      };

      const created = await createProduct(payload);

      // Save specs if group and specs data provided
      if (created?.id && formData.group_id && Object.keys(formData.specs).length > 0) {
        try {
          await updateProductSpecs(created.id, { specs: formData.specs });
        } catch (specErr) {
          console.warn('⚠️ Product created but specs not saved:', specErr);
        }
      }

      // If SERIALIZED type, create serial items for each serial number
      if (formData.type === 'SERIALIZED' && formData.serial_numbers.trim()) {
        const serials = formData.serial_numbers
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean);

        const productId = created?.id || created?.product?.id;
        if (productId && serials.length > 0) {
          // Create serial items one by one
          for (const serial of serials) {
            await createSerialItem({
              serial_number: serial,
              product_id: productId,
              warehouse_id: null, // will be assigned on stock entry
              status: 'NEW',
              notes: null,
            });
          }
        }
      }

      // Reload products
      await loadProducts();

      // Close modal and reset form
      setShowCreateModal(false);
      resetFormData();
    } catch (err) {
      console.error('Error creating product:', err);
      setCreateError(err.response?.data?.detail || err.message || 'Error al crear producto');
    } finally {
      setCreating(false);
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setEditError(null);

    try {
      // Validations
      if (!formData.name.trim()) {
        throw new Error('El nombre es obligatorio');
      }
      if (!formData.sku.trim()) {
        throw new Error('El SKU es obligatorio');
      }

      // Check SKU uniqueness (excluding current product)
      if (products.some(p => p.id !== selectedProduct.id && p.sku.toUpperCase() === formData.sku.toUpperCase())) {
        throw new Error('El SKU ya existe en el catálogo');
      }

      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        // type is intentionally omitted - immutable field handled by backend
        category: formData.category || null,
        description: formData.description.trim() || null,
        min_stock_alert: parseInt(formData.min_stock_alert) || 0,
        // Nuevos campos
        group_id: formData.group_id ? parseInt(formData.group_id) : null,
        is_composite: formData.type === 'BULK' ? formData.is_composite : false,
        unit_size: formData.is_composite && formData.unit_size ? parseFloat(formData.unit_size) : null,
        unit_measure: formData.is_composite ? (formData.unit_measure || 'm') : null,
        composite_unit_label: formData.is_composite ? (formData.composite_unit_label || null) : null,
      };

      await updateProduct(selectedProduct.id, payload);

      // If SERIALIZED type and serial numbers entered, create serial items
      if (formData.type === 'SERIALIZED' && formData.serial_numbers.trim()) {
        const serials = formData.serial_numbers
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (serials.length > 0) {
          for (const serial of serials) {
            await createSerialItem({
              serial_number: serial,
              product_id: selectedProduct.id,
              warehouse_id: null,
              status: 'NEW',
              notes: null,
            });
          }
        }
      }

      // Reload products
      await loadProducts();

      // Close modal and reset form
      setShowEditModal(false);
      setSelectedProduct(null);
      resetFormData();
    } catch (err) {
      console.error('Error updating product:', err);
      setEditError(err.response?.data?.detail || err.message || 'Error al actualizar producto');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteProduct = async () => {
    setUpdating(true);
    setEditError(null);

    try {
      await deleteProduct(selectedProduct.id);

      // Reload products
      await loadProducts();

      // Close confirmation and reset
      setShowEditModal(false);
      setSelectedProduct(null);
    } catch (err) {
      console.error('Error deleting product:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Error al eliminar producto';
      
      // Check for 409 conflicts
      if (err.response?.status === 409) {
        setEditError(`No se puede eliminar: ${errorMsg}`);
      } else {
        setEditError(errorMsg);
      }
    } finally {
      setUpdating(false);
    }
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      type: product.type,
      category: product.category || 'Cableado',
      description: product.description || '',
      min_stock_alert: product.min_stock_alert || 50,
      serial_numbers: '',
      // Nuevos campos
      group_id: product.group_id ? String(product.group_id) : '',
      is_composite: product.is_composite || false,
      unit_size: product.unit_size ? String(product.unit_size) : '',
      unit_measure: product.unit_measure || 'm',
      composite_unit_label: product.composite_unit_label || '',
      specs: product.specs || {}
    });
    setShowEditModal(true);
    setEditError(null);
  };

  const openDeleteConfirm = (product) => {
    setSelectedProduct(product);
    setEditError(null);
    setShowDeleteConfirm(true);
  };

  const categoryNames = categories.map(c => c.name);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <Loader className="w-12 h-12 text-emerald-500 animate-spin" />
          <p className="text-zinc-400 text-sm">Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400">Catálogo de Productos</h1>
          <p className="text-zinc-400 mt-1">
            Gestión del inventario de cables, ONUs y componentes
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
          >
            <option value="ALL">Todos los Tipos</option>
            <option value="BULK">A Granel</option>
            <option value="SERIALIZED">Serializados</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
          >
            <option value="ALL">Todas las Categorías</option>
            {categoryNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* Group Filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
          >
            <option value="ALL">Todos los Grupos</option>
            {productGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
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
            onClick={loadProducts}
            className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded text-sm transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Products Table */}
      {filteredProducts.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <Package className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-400 mb-2">
            {searchTerm || typeFilter !== 'ALL' || categoryFilter !== 'ALL'
              ? 'Sin resultados'
              : 'Sin productos'}
          </h3>
          <p className="text-zinc-500 text-sm">
            {searchTerm || typeFilter !== 'ALL' || categoryFilter !== 'ALL'
              ? 'No se encontraron productos con los filtros aplicados'
              : 'Crea tu primer producto para comenzar'}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="bg-zinc-800/50 border-b border-zinc-800 grid grid-cols-12 gap-4 p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            <div className="col-span-3">Producto</div>
            <div className="col-span-2">SKU</div>
            <div className="col-span-1">Tipo</div>
            <div className="col-span-2">Categoría</div>
            <div className="col-span-2">Grupo</div>
            <div className="col-span-1">Mín Stock</div>
            <div className="col-span-1">Acción</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-zinc-800">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="grid grid-cols-12 gap-4 p-4 hover:bg-zinc-800/50 transition-colors items-center"
              >
                {/* Nombre */}
                <div className="col-span-3">
                  <div className="flex items-center space-x-2">
                    {product.type === 'BULK' ? (
                      <Droplets className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    ) : (
                      <QrCode className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-white font-medium">{product.name}</p>
                      {product.description && (
                        <p className="text-zinc-500 text-xs mt-0.5 truncate">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* SKU */}
                <div className="col-span-2">
                  <code className="text-zinc-300 text-sm bg-zinc-800 px-2 py-1 rounded">
                    {product.sku}
                  </code>
                </div>

                {/* Type */}
                <div className="col-span-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    product.type === 'BULK'
                      ? 'bg-blue-900/30 text-blue-300 border-blue-800'
                      : 'bg-purple-900/30 text-purple-300 border-purple-800'
                  }`}>
                    {product.type === 'BULK' ? 'BG' : 'SR'}
                  </span>
                </div>

                {/* Category */}
                <div className="col-span-2">
                  <span className="text-zinc-400 text-sm">
                    {product.category || '-'}
                  </span>
                </div>

                {/* Group */}
                <div className="col-span-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300">
                    {product.group_name || '-'}
                  </span>
                </div>

                {/* Min Stock Alert */}
                <div className="col-span-1">
                  <span className="text-zinc-300 font-medium">{product.min_stock_alert}</span>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end space-x-2">
                  <button
                    onClick={() => openEditModal(product)}
                    className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(product)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">
            Mostrando <span className="text-white font-medium">{filteredProducts.length}</span> de <span className="text-white font-medium">{products.length}</span> productos
          </span>
          <div className="flex items-center space-x-4 text-zinc-500">
            <span>{products.filter(p => p.type === 'BULK').length} a granel</span>
            <span>•</span>
            <span>{products.filter(p => p.type === 'SERIALIZED').length} serializados</span>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-2xl w-full my-8 shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header - Fixed */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 flex-shrink-0">
              <h2 className="text-2xl font-bold text-emerald-400">Nuevo Producto</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                  setFormData({
                    name: '',
                    sku: '',
                    type: 'BULK',
                    category: 'Cableado',
                    description: '',
                    min_stock_alert: 50,
                    serial_numbers: ''
                  });
                }}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-6">
              {/* Error Alert */}
              {createError && (
                <div className="mb-4 bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{createError}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleCreateProduct} className="space-y-4" id="create-product-form">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Cable UTP Cat6 305m"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  SKU (Código Único) *
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  placeholder="Ej: CAB-UTP-CAT6-305"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors font-mono"
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Tipo de Producto *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                >
                  <option value="BULK">A Granel (cable, conectores, etc.)</option>
                  <option value="SERIALIZED">Serializado (ONUs, routers, etc.)</option>
                </select>
              </div>

              {/* Serial Numbers (only for SERIALIZED type) */}
              {formData.type === 'SERIALIZED' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Números de Serie
                  </label>
                  <textarea
                    value={formData.serial_numbers}
                    onChange={(e) => setFormData({ ...formData, serial_numbers: e.target.value })}
                    placeholder="Ingresá un serial por línea o separados por coma&#10;Ej: ONU-2024-001, ONU-2024-002, ONU-2024-003"
                    rows="4"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors resize-none"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Se crearán items individuales con cada serial al guardar el producto
                  </p>
                </div>
              )}

              {/* Group selector */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Grupo de Producto
                </label>
                <select
                  value={formData.group_id}
                  onChange={(e) => {
                    const gid = e.target.value;
                    const group = productGroups.find(g => String(g.id) === gid);
                    setFormData({ ...formData, group_id: gid, specs: {} });
                    // If specs already exist for this product, load them
                    if (selectedProduct?.specs && selectedProduct.group_id === parseInt(gid)) {
                      setFormData(prev => ({ ...prev, group_id: gid, specs: selectedProduct.specs }));
                    }
                  }}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                >
                  <option value="">Sin grupo</option>
                  {productGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Categoría
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                >
                  <option value="">Sin categoría</option>
                  {categoryNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Composite product fields (only for BULK type) */}
              {formData.type === 'BULK' && (
                <>
                  <div className="border-t border-zinc-800 pt-4">
                    <h3 className="text-lg font-semibold text-zinc-200 mb-3">Producto Compuesto / Fraccionable</h3>
                    <p className="text-xs text-zinc-500 mb-4">
                      Marcá esta opción si el producto se compra como unidad (bobina, blister)
                      pero se consume fraccionadamente (metros, unidades).
                    </p>

                    <label className="flex items-center space-x-3 mb-4 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.is_composite}
                        onChange={(e) => setFormData({ ...formData, is_composite: e.target.checked })}
                        className="w-5 h-5 rounded border-zinc-600 text-emerald-500 focus:ring-emerald-500 bg-zinc-700"
                      />
                      <div>
                        <span className="text-zinc-200 font-medium">Es un producto compuesto</span>
                        <p className="text-xs text-zinc-500">Ej: Bobina de drop 300m, Blister conectores x10</p>
                      </div>
                    </label>

                    {formData.is_composite && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Tamaño por Unidad
                          </label>
                          <input
                            type="number"
                            value={formData.unit_size}
                            onChange={(e) => setFormData({ ...formData, unit_size: e.target.value })}
                            placeholder="Ej: 300"
                            min="0"
                            step="0.1"
                            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Unidad de Medida
                          </label>
                          <select
                            value={formData.unit_measure}
                            onChange={(e) => setFormData({ ...formData, unit_measure: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                          >
                            <option value="m">Metros (m)</option>
                            <option value="units">Unidades</option>
                            <option value="pcs">Piezas</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Etiqueta de Unidad
                          </label>
                          <input
                            type="text"
                            value={formData.composite_unit_label}
                            onChange={(e) => setFormData({ ...formData, composite_unit_label: e.target.value })}
                            placeholder="Ej: Bobina, Blister"
                            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Specs editor (only when a group is selected) */}
              {formData.group_id && (
                <div className="border-t border-zinc-800 pt-4">
                  <h3 className="text-lg font-semibold text-zinc-200 mb-3">Especificaciones Técnicas</h3>
                  <p className="text-xs text-zinc-500 mb-4">
                    Completá los atributos técnicos según el grupo seleccionado.
                  </p>
                  <div className="space-y-3">
                    {/* Common fields - these will be shown based on group */}
                    {(() => {
                      const group = productGroups.find(g => String(g.id) === formData.group_id);
                      const groupName = group?.name || '';
                      const isONT = groupName.includes('ONT') || groupName.includes('ONU');
                      const isRouter = groupName.includes('Router');
                      const fields = [];

                      if (isONT || isRouter) {
                        fields.push(
                          <div key="dual_band">
                            <label className="flex items-center space-x-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.specs?.is_dual_band || false}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  specs: { ...formData.specs, is_dual_band: e.target.checked }
                                })}
                                className="w-5 h-5 rounded border-zinc-600 text-emerald-500 bg-zinc-700"
                              />
                              <span className="text-zinc-200">Doble Banda (Dual Band)</span>
                            </label>
                          </div>
                        );

                        if (isONT) {
                          fields.push(
                            <div key="wifi">
                              <label className="block text-sm font-medium text-zinc-300 mb-2">WiFi</label>
                              <select
                                value={formData.specs?.wifi_version || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  specs: { ...formData.specs, wifi_version: e.target.value }
                                })}
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                              >
                                <option value="">Seleccionar</option>
                                <option value="4">WiFi 4</option>
                                <option value="5">WiFi 5</option>
                                <option value="6">WiFi 6</option>
                              </select>
                            </div>
                          );
                          fields.push(
                            <div key="mode">
                              <label className="block text-sm font-medium text-zinc-300 mb-2">Modo</label>
                              <select
                                value={formData.specs?.mode || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  specs: { ...formData.specs, mode: e.target.value }
                                })}
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                              >
                                <option value="">Seleccionar</option>
                                <option value="router">Router</option>
                                <option value="bridge">Bridge</option>
                                <option value="router_bridge">Router + Bridge</option>
                              </select>
                            </div>
                          );
                        }

                        if (isRouter) {
                          fields.push(
                            <div key="mesh">
                              <label className="flex items-center space-x-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.specs?.is_mesh || false}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    specs: { ...formData.specs, is_mesh: e.target.checked }
                                  })}
                                  className="w-5 h-5 rounded border-zinc-600 text-emerald-500 bg-zinc-700"
                                />
                                <span className="text-zinc-200">Mesh</span>
                              </label>
                            </div>
                          );
                          fields.push(
                            <div key="extra_notes">
                              <label className="block text-sm font-medium text-zinc-300 mb-2">Notas Extras</label>
                              <textarea
                                value={formData.specs?.extra_notes || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  specs: { ...formData.specs, extra_notes: e.target.value }
                                })}
                                rows="2"
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white resize-none"
                                placeholder="Puertos, características especiales..."
                              />
                            </div>
                          );
                        }
                      }

                      // If no specific fields for this group, show raw JSON editor
                      if (fields.length === 0) {
                        fields.push(
                          <div key="raw">
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                              Atributos (JSON)
                            </label>
                            <textarea
                              value={JSON.stringify(formData.specs || {}, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  setFormData({ ...formData, specs: parsed });
                                } catch {
                                  // Allow typing invalid JSON temporarily
                                }
                              }}
                              rows="4"
                              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono text-sm resize-none"
                              placeholder='{"key": "value"}'
                            />
                          </div>
                        );
                      }

                      return fields;
                    })()}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalles del producto, especificaciones, proveedor..."
                  rows="3"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              {/* Min Stock Alert */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Stock Mínimo para Alerta
                </label>
                <input
                  type="number"
                  value={formData.min_stock_alert}
                  onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                  placeholder="Ej: 50"
                  min="0"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                />
              </div>
              </form>
            </div>

            {/* Fixed Footer with Buttons */}
            <div className="p-6 border-t border-zinc-800 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError(null);
                    setFormData({
                      name: '',
                      sku: '',
                      type: 'BULK',
                      category: 'Cableado',
                      description: '',
                      min_stock_alert: 50,
                      serial_numbers: ''
                    });
                  }}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="create-product-form"
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
                      <span>Crear Producto</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-2xl w-full my-8 shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header - Fixed */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 flex-shrink-0">
              <h2 className="text-2xl font-bold text-blue-400">Editar Producto</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditError(null);
                  setSelectedProduct(null);
                  setFormData({
                    name: '',
                    sku: '',
                    type: 'BULK',
                    category: 'Cableado',
                    description: '',
                    min_stock_alert: 50,
                    serial_numbers: ''
                  });
                }}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-6">
              {/* Error Alert */}
              {editError && (
                <div className="mb-4 bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{editError}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleEditProduct} className="space-y-4" id="edit-product-form">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Cable UTP Cat6 305m"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    SKU (Código Único) *
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="Ej: CAB-UTP-CAT6-305"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors font-mono"
                    required
                  />
                </div>

                {/* Type - DISABLED (immutable) */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Tipo de Producto <span className="text-zinc-500 text-xs">(Inmutable)</span>
                  </label>
                  <select
                    value={formData.type}
                    disabled
                    className="w-full px-4 py-3 bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-500 cursor-not-allowed"
                  >
                    <option value="BULK">A Granel (cable, conectores, etc.)</option>
                    <option value="SERIALIZED">Serializado (ONUs, routers, etc.)</option>
                  </select>
                  <p className="text-xs text-zinc-500 mt-1">El tipo de producto no puede ser modificado</p>
                </div>

                {/* Serial Numbers (only for SERIALIZED type) */}
                {formData.type === 'SERIALIZED' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Números de Serie
                    </label>
                    <textarea
                      value={formData.serial_numbers}
                      onChange={(e) => setFormData({ ...formData, serial_numbers: e.target.value })}
                      placeholder="Ingresá un serial por línea o separados por coma&#10;Ej: ONU-2024-001, ONU-2024-002, ONU-2024-003"
                      rows="4"
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors resize-none"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Se crearán items individuales con cada serial al guardar el producto
                    </p>
                  </div>
                )}

                {/* Group selector */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Grupo de Producto
                  </label>
                  <select
                    value={formData.group_id}
                    onChange={(e) => {
                      const gid = e.target.value;
                      setFormData({ ...formData, group_id: gid, specs: selectedProduct?.specs || {} });
                    }}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Sin grupo</option>
                    {productGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Categoría
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Sin categoría</option>
                    {categoryNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                {/* Composite product fields (only for BULK type) */}
                {formData.type === 'BULK' && (
                  <>
                    <div className="border-t border-zinc-800 pt-4">
                      <h3 className="text-lg font-semibold text-zinc-200 mb-3">Producto Compuesto / Fraccionable</h3>
                      <p className="text-xs text-zinc-500 mb-4">
                        Marcá esta opción si el producto se compra como unidad (bobina, blister)
                        pero se consume fraccionadamente (metros, unidades).
                      </p>
                      <label className="flex items-center space-x-3 mb-4 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.is_composite}
                          onChange={(e) => setFormData({ ...formData, is_composite: e.target.checked })}
                          className="w-5 h-5 rounded border-zinc-600 text-blue-500 focus:ring-blue-500 bg-zinc-700"
                        />
                        <div>
                          <span className="text-zinc-200 font-medium">Es un producto compuesto</span>
                          <p className="text-xs text-zinc-500">Ej: Bobina de drop 300m, Blister conectores x10</p>
                        </div>
                      </label>
                      {formData.is_composite && (
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">Tamaño por Unidad</label>
                            <input type="number" value={formData.unit_size}
                              onChange={(e) => setFormData({ ...formData, unit_size: e.target.value })}
                              placeholder="Ej: 300" min="0" step="0.1"
                              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">Unidad de Medida</label>
                            <select value={formData.unit_measure}
                              onChange={(e) => setFormData({ ...formData, unit_measure: e.target.value })}
                              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white">
                              <option value="m">Metros (m)</option>
                              <option value="units">Unidades</option>
                              <option value="pcs">Piezas</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">Etiqueta de Unidad</label>
                            <input type="text" value={formData.composite_unit_label}
                              onChange={(e) => setFormData({ ...formData, composite_unit_label: e.target.value })}
                              placeholder="Ej: Bobina, Blister"
                              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Specs editor */}
                {formData.group_id && (
                  <div className="border-t border-zinc-800 pt-4">
                    <h3 className="text-lg font-semibold text-zinc-200 mb-3">Especificaciones Técnicas</h3>
                    <div className="space-y-3">
                      {(() => {
                        const group = productGroups.find(g => String(g.id) === formData.group_id);
                        const groupName = group?.name || '';
                        const isONT = groupName.includes('ONT') || groupName.includes('ONU');
                        const isRouter = groupName.includes('Router');
                        const fields = [];
                        if (isONT || isRouter) {
                          fields.push(
                            <div key="dual_band">
                              <label className="flex items-center space-x-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer">
                                <input type="checkbox"
                                  checked={formData.specs?.is_dual_band || false}
                                  onChange={(e) => setFormData({ ...formData, specs: { ...formData.specs, is_dual_band: e.target.checked } })}
                                  className="w-5 h-5 rounded border-zinc-600 text-blue-500 bg-zinc-700" />
                                <span className="text-zinc-200">Doble Banda (Dual Band)</span>
                              </label>
                            </div>
                          );
                          if (isONT) {
                            fields.push(
                              <div key="wifi">
                                <label className="block text-sm font-medium text-zinc-300 mb-2">WiFi</label>
                                <select value={formData.specs?.wifi_version || ''}
                                  onChange={(e) => setFormData({ ...formData, specs: { ...formData.specs, wifi_version: e.target.value } })}
                                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white">
                                  <option value="">Seleccionar</option>
                                  <option value="4">WiFi 4</option>
                                  <option value="5">WiFi 5</option>
                                  <option value="6">WiFi 6</option>
                                </select>
                              </div>
                            );
                            fields.push(
                              <div key="mode">
                                <label className="block text-sm font-medium text-zinc-300 mb-2">Modo</label>
                                <select value={formData.specs?.mode || ''}
                                  onChange={(e) => setFormData({ ...formData, specs: { ...formData.specs, mode: e.target.value } })}
                                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white">
                                  <option value="">Seleccionar</option>
                                  <option value="router">Router</option>
                                  <option value="bridge">Bridge</option>
                                  <option value="router_bridge">Router + Bridge</option>
                                </select>
                              </div>
                            );
                          }
                          if (isRouter) {
                            fields.push(
                              <div key="mesh">
                                <label className="flex items-center space-x-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer">
                                  <input type="checkbox"
                                    checked={formData.specs?.is_mesh || false}
                                    onChange={(e) => setFormData({ ...formData, specs: { ...formData.specs, is_mesh: e.target.checked } })}
                                    className="w-5 h-5 rounded border-zinc-600 text-blue-500 bg-zinc-700" />
                                  <span className="text-zinc-200">Mesh</span>
                                </label>
                              </div>
                            );
                            fields.push(
                              <div key="extra_notes">
                                <label className="block text-sm font-medium text-zinc-300 mb-2">Notas Extras</label>
                                <textarea value={formData.specs?.extra_notes || ''}
                                  onChange={(e) => setFormData({ ...formData, specs: { ...formData.specs, extra_notes: e.target.value } })}
                                  rows="2" className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white resize-none" />
                              </div>
                            );
                          }
                        }
                        if (fields.length === 0) {
                          fields.push(
                            <div key="raw">
                              <label className="block text-sm font-medium text-zinc-300 mb-2">Atributos (JSON)</label>
                              <textarea value={JSON.stringify(formData.specs || {}, null, 2)}
                                onChange={(e) => { try { setFormData({ ...formData, specs: JSON.parse(e.target.value) }); } catch {} }}
                                rows="4" className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono text-sm resize-none" />
                            </div>
                          );
                        }
                        return fields;
                      })()}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalles del producto, especificaciones, proveedor..."
                    rows="3"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                {/* Min Stock Alert */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Stock Mínimo para Alerta
                  </label>
                  <input
                    type="number"
                    value={formData.min_stock_alert}
                    onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                    placeholder="Ej: 50"
                    min="0"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                  />
                </div>
              </form>
            </div>

            {/* Fixed Footer with Buttons */}
            <div className="p-6 border-t border-zinc-800 flex-shrink-0 space-y-2">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditError(null);
                    setSelectedProduct(null);
                    setFormData({
                      name: '',
                      sku: '',
                      type: 'BULK',
                      category: 'Cableado',
                      description: '',
                      min_stock_alert: 50,
                      serial_numbers: ''
                    });
                  }}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="edit-product-form"
                  disabled={updating}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {updating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-3 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg transition-colors border border-red-900/50"
              >
                Eliminar Producto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-red-900/50 rounded-lg max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="flex items-start space-x-3 p-6 border-b border-red-900/30">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-red-400">Eliminar Producto</h2>
                <p className="text-sm text-zinc-400 mt-1">Esta acción no puede deshacerse</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {editError ? (
                <div className="bg-red-900/30 border border-red-900/50 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{editError}</p>
                </div>
              ) : (
                <>
                  <p className="text-zinc-300">
                    ¿Está seguro que desea eliminar el producto <span className="font-medium text-white">"{selectedProduct.name}"</span>?
                  </p>
                  <div className="bg-zinc-900 rounded p-3 text-sm text-zinc-400">
                    <p><span className="text-zinc-500">SKU:</span> {selectedProduct.sku}</p>
                    <p><span className="text-zinc-500">Tipo:</span> {selectedProduct.type === 'BULK' ? 'A Granel' : 'Serializado'}</p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-red-900/30 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setEditError(null);
                }}
                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={updating}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {updating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar</span>
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
