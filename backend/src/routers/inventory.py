"""
Inventory Router - API endpoints para gestión de inventario operativo
Soporta almacenes móviles (camionetas) y seguimiento de seriales.
"""
from typing import List, Optional
from datetime import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import select, and_, or_, func

from src.database import get_db
from src.models.inventory import (
    Warehouse, Product, ProductCategory, ProductGroup, ProductSpec,
    StockBulk, SerialItem, StockMovement,
    WarehouseType, ProductType, MovementType, SerialItemStatus
)
from src.models.user import User
from src.schemas.inventory import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    ProductCategoryResponse,
    ProductGroupCreate, ProductGroupUpdate, ProductGroupResponse,
    ProductSpecUpdate, ProductSpecResponse,
    SerialItemCreate, SerialItemUpdate, SerialItemResponse,
    StockMovementResponse, WarehouseStockResponse, StockItemDetail,
    StockTransferRequest, StockTransferResponse,
    StockAdjustmentRequest, StockAdjustmentResponse,
    StockAlertItem
)
from src.schemas.fleet import VehicleSummary
from src.utils.audit import log_create, log_update, log_delete, get_entity_dict

router = APIRouter(tags=["inventory"])
logger = logging.getLogger("uvicorn.error")


# ============================================
# HELPER FUNCTIONS
# ============================================

def _get_user_id_from_request() -> int:
    """
    Helper para obtener user_id desde request state.
    En producción, debe leer desde JWT/session.
    """
    # TODO: Implementar extracción de user_id desde JWT
    return 2  # Usuario admin por defecto (ID 2 en DB actual)


def _safe_user_name(user: Optional[User]) -> Optional[str]:
    """Helper para obtener nombre de usuario de forma segura."""
    if user is None:
        return None
    return user.full_name or user.username


def _product_to_response(product: Product) -> ProductResponse:
    """
    Convierte un Product ORM a ProductResponse incluyendo
    group_name (desde relación group) y specs (desde relación spec).
    """
    product_dict = product.__dict__.copy()
    product_dict["group_name"] = product.group.name if product.group else None
    product_dict["specs"] = product.spec.specs if product.spec else None
    return ProductResponse(**product_dict)


# ============================================
# STOCK ALERTS ENDPOINT (OPTIMIZADO — Una sola query)
# ============================================

@router.get("/stock/alerts", response_model=List[StockAlertItem])
def get_stock_alerts(
    db: Session = Depends(get_db)
):
    """
    **Endpoint optimizado** para alertas de stock mínimo.
    
    En lugar de que el frontend haga N×M consultas (productos × warehouses),
    esta única query agrega stock BULK y cuenta seriales por producto,
    comparando contra min_stock_alert.
    
    **Retorna:** Lista de productos cuyo stock total es menor a su mínimo configurado.
    """
    # Una sola consulta: LEFT JOIN products → stock_bulk → serial_items
    # con agregación y filtro HAVING para stock < mínimo
    stmt = (
        select(
            Product.id,
            Product.name,
            Product.sku,
            Product.type,
            Product.category,
            Product.min_stock_alert,
            func.coalesce(func.sum(StockBulk.quantity), 0).label("total_bulk"),
            func.count(SerialItem.id).label("total_serialized")
        )
        .outerjoin(StockBulk, and_(
            StockBulk.product_id == Product.id,
            StockBulk.quantity > 0
        ))
        .outerjoin(SerialItem, and_(
            SerialItem.product_id == Product.id,
            SerialItem.status.in_([SerialItemStatus.NEW, SerialItemStatus.IN_VEHICLE])
        ))
        .group_by(Product.id, Product.name, Product.sku, Product.type, Product.category, Product.min_stock_alert)
        .having(
            # stock total (bulk sum + serial count) < min_stock_alert
            func.coalesce(func.sum(StockBulk.quantity), 0) +
            func.count(SerialItem.id) < Product.min_stock_alert
        )
        .order_by(Product.name)
    )
    
    results = db.execute(stmt).all()
    
    alerts = []
    for row in results:
        total_stock = float(row.total_bulk or 0) + float(row.total_serialized or 0)
        alerts.append(StockAlertItem(
            product_id=row.id,
            product_name=row.name,
            product_sku=row.sku,
            product_type=row.type,
            category=row.category,
            total_stock=total_stock,
            min_stock_alert=row.min_stock_alert,
            deficit=float(row.min_stock_alert) - total_stock
        ))
    
    return alerts


# ============================================
# WAREHOUSES ENDPOINTS
# ============================================

@router.get("/warehouses", response_model=List[WarehouseResponse])
def list_warehouses(
    warehouse_type: Optional[WarehouseType] = Query(None, description="Filtrar por tipo de warehouse"),
    user_id: Optional[int] = Query(None, description="Filtrar por técnico asignado (solo para MOBILE)"),
    db: Session = Depends(get_db)
):
    """
    Listar warehouses con filtros opcionales.
    
    - **warehouse_type**: Filtrar por CENTRAL, MOBILE o VIRTUAL
    - **user_id**: Filtrar por técnico asignado (útil para listar camionetas de un técnico)
    """
    stmt = select(Warehouse).options(
        joinedload(Warehouse.user),
        joinedload(Warehouse.vehicle),
    )
    
    if warehouse_type:
        stmt = stmt.where(Warehouse.type == warehouse_type)
    
    if user_id:
        stmt = stmt.where(Warehouse.user_id == user_id)
    
    stmt = stmt.order_by(Warehouse.type, Warehouse.name)
    warehouses = db.execute(stmt).scalars().all()
    
    def _exclude_vehicle(d: dict) -> dict:
        """Excluir 'vehicle' del __dict__ del modelo ORM para evitar
        TypeError por duplicado con el kwarg explícito vehicle=..."""
        return {k: v for k, v in d.items() if k != 'vehicle'}

    return [
        WarehouseResponse(
            **_exclude_vehicle(warehouse.__dict__),
            user_name=_safe_user_name(warehouse.user),
            vehicle=VehicleSummary.model_validate(warehouse.vehicle) if warehouse.vehicle else None,
        )
        for warehouse in warehouses
    ]


@router.post("/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    payload: WarehouseCreate,
    db: Session = Depends(get_db)
):
    """
    Crear un nuevo warehouse.
    
    - Si es tipo **MOBILE**, debe especificar `user_id` (técnico asignado).
    - Si es tipo **CENTRAL** o **VIRTUAL**, `user_id` debe ser null.
    """
    # FASE 6: MOBILE warehouses deben crearse exclusivamente desde el módulo Flota
    # (create_vehicle en fleet.py → _create_mobile_warehouse)
    if payload.type == WarehouseType.MOBILE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los almacenes MOBILE deben crearse desde el módulo Flota"
        )
    
    # Validar: CENTRAL/VIRTUAL no deben tener user_id
    if payload.type in [WarehouseType.CENTRAL, WarehouseType.VIRTUAL] and payload.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Warehouses tipo {payload.type.value} no pueden tener user_id asignado"
        )
    
    # Validar que user_id existe
    if payload.user_id:
        user = db.get(User, payload.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario con id {payload.user_id} no encontrado"
            )
    
    warehouse = Warehouse(**payload.model_dump())
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)
    return WarehouseResponse(
        **_exclude_vehicle(warehouse.__dict__),
        user_name=_safe_user_name(warehouse.user),
        vehicle=VehicleSummary.model_validate(warehouse.vehicle) if warehouse.vehicle else None,
    )


@router.put("/warehouses/{warehouse_id}", response_model=WarehouseResponse)
def update_warehouse(
    warehouse_id: int,
    payload: WarehouseUpdate,
    db: Session = Depends(get_db)
):
    """
    Actualizar un warehouse existente.
    
    Permite modificar:
    - Nombre del warehouse
    - Tipo (con validaciones)
    - Usuario asignado (solo para MOBILE)
    
    **Validaciones:**
    - Si cambia a MOBILE, requiere user_id
    - Si cambia a CENTRAL/VIRTUAL, user_id debe ser null
    """
    warehouse = db.get(Warehouse, warehouse_id)
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse con id {warehouse_id} no encontrado"
        )
    
    # 🔒 AUDIT LOG: Capturar valores antiguos ANTES del update
    old_values = {
        "name": warehouse.name,
        "type": warehouse.type.value,
        "user_id": warehouse.user_id
    }
    
    # Obtener datos del payload (solo campos que vienen en el request)
    update_data = payload.model_dump(exclude_unset=True)
    
    # Determinar tipo final (si se está cambiando o mantener actual)
    final_type = update_data.get('type', warehouse.type)
    final_user_id = update_data.get('user_id', warehouse.user_id)
    
    # Validar: MOBILE requiere user_id
    if final_type == WarehouseType.MOBILE and final_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Warehouses tipo MOBILE requieren user_id (técnico asignado)"
        )
    
    # Validar: CENTRAL/VIRTUAL no deben tener user_id
    if final_type in [WarehouseType.CENTRAL, WarehouseType.VIRTUAL] and final_user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Warehouses tipo {final_type.value} no pueden tener user_id asignado"
        )
    
    # Validar que user_id existe si se especifica
    if 'user_id' in update_data and update_data['user_id'] is not None:
        user = db.get(User, update_data['user_id'])
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario con id {update_data['user_id']} no encontrado"
            )
    
    # Aplicar actualizaciones
    for field, value in update_data.items():
        setattr(warehouse, field, value)
    
    db.commit()
    db.refresh(warehouse)
    db.refresh(warehouse, attribute_names=["user"])
    
    # 🔒 AUDIT LOG: Registrar actualización de warehouse
    try:
        new_values = {
            "name": warehouse.name,
            "type": warehouse.type.value,
            "user_id": warehouse.user_id
        }
        log_update(
            db=db,
            user_id=_get_user_id_from_request(),
            entity_name="warehouses",
            entity_id=warehouse.id,
            old_values=old_values,
            new_values=new_values
        )
    except Exception as audit_error:
        logger.error(f"❌ [AUDIT] Error al registrar actualización de warehouse {warehouse.id}: {audit_error}")
    
    return WarehouseResponse(
        **_exclude_vehicle(warehouse.__dict__),
        user_name=_safe_user_name(warehouse.user),
        vehicle=VehicleSummary.model_validate(warehouse.vehicle) if warehouse.vehicle else None,
    )


@router.delete("/warehouses/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db)
):
    """
    Eliminar un warehouse.
    
    **VALIDACIONES CRÍTICAS:**
    - No se puede eliminar si tiene stock bulk (quantity > 0)
    - No se puede eliminar si tiene serial items asignados
    - No se puede eliminar si tiene movimientos registrados
    
    **Retorna:**
    - 204 No Content si se elimina exitosamente
    - 404 si el warehouse no existe
    - 409 Conflict si tiene datos asociados
    """
    warehouse = db.get(Warehouse, warehouse_id)
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse con id {warehouse_id} no encontrado"
        )
    
    # Validación 1: Verificar stock bulk (SELECT COUNT optimizado)
    bulk_count = db.execute(
        select(func.count()).select_from(StockBulk).where(
            and_(
                StockBulk.warehouse_id == warehouse_id,
                StockBulk.quantity > 0
            )
        )
    ).scalar()
    
    if bulk_count and bulk_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: El almacén tiene {bulk_count} producto(s) con stock BULK. Transfiera o ajuste el stock antes de eliminar."
        )
    
    # Validación 2: Verificar serial items (SELECT COUNT optimizado)
    serial_count = db.execute(
        select(func.count()).select_from(SerialItem).where(
            and_(
                SerialItem.warehouse_id == warehouse_id,
                SerialItem.status.in_([SerialItemStatus.NEW, SerialItemStatus.IN_VEHICLE])
            )
        )
    ).scalar()
    
    if serial_count and serial_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: El almacén tiene {serial_count} item(s) serializados activos. Transfiera o dé de baja los items antes de eliminar."
        )
    
    # Validación 3: Verificar movimientos (origen o destino) (SELECT COUNT optimizado)
    movements_count = db.execute(
        select(func.count()).select_from(StockMovement).where(
            or_(
                StockMovement.from_warehouse_id == warehouse_id,
                StockMovement.to_warehouse_id == warehouse_id
            )
        )
    ).scalar()
    
    if movements_count and movements_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: El almacén tiene {movements_count} movimiento(s) registrado(s) en el historial. No se puede eliminar un almacén con historial de auditoría."
        )
    
    # 🔒 AUDIT LOG: Capturar valores ANTES del delete
    old_values = {
        "name": warehouse.name,
        "type": warehouse.type.value,
        "user_id": warehouse.user_id
    }
    
    # Si pasa todas las validaciones, proceder a eliminar
    db.delete(warehouse)
    
    # 🔒 AUDIT LOG: Registrar eliminación de warehouse
    try:
        log_delete(
            db=db,
            user_id=_get_user_id_from_request(),
            entity_name="warehouses",
            entity_id=warehouse_id,
            old_values=old_values,
            commit=False  # Ya estamos en una transacción
        )
    except Exception as audit_error:
        logger.error(f"❌ [AUDIT] Error al registrar eliminación de warehouse {warehouse_id}: {audit_error}")
    
    db.commit()
    
    # No return (204 No Content)


@router.get("/warehouses/{warehouse_id}/stock", response_model=WarehouseStockResponse)
def get_warehouse_stock(
    warehouse_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtener stock completo de un warehouse.
    
    Devuelve lista unificada:
    - **BULK**: Muestra cantidad
    - **SERIALIZED**: Muestra conteo y lista de seriales disponibles
    """
    warehouse = db.get(Warehouse, warehouse_id)
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse con id {warehouse_id} no encontrado"
        )
    
    # Obtener stock bulk
    bulk_stmt = (
        select(StockBulk)
        .options(joinedload(StockBulk.product))
        .where(StockBulk.warehouse_id == warehouse_id)
        .where(StockBulk.quantity > 0)
    )
    bulk_items = db.execute(bulk_stmt).scalars().all()
    
    # Obtener serial items
    serial_stmt = (
        select(SerialItem)
        .options(joinedload(SerialItem.product))
        .where(SerialItem.warehouse_id == warehouse_id)
        .where(SerialItem.status.in_([SerialItemStatus.NEW, SerialItemStatus.IN_VEHICLE]))
    )
    serial_items = db.execute(serial_stmt).scalars().all()
    
    # Agrupar seriales por producto
    serials_by_product = {}
    for item in serial_items:
        if item.product_id not in serials_by_product:
            serials_by_product[item.product_id] = []
        serials_by_product[item.product_id].append(
            SerialItemResponse(
                **item.__dict__,
                product_name=item.product.name,
                product_sku=item.product.sku,
                warehouse_name=warehouse.name
            )
        )
    
    # Construir respuesta unificada
    items = []
    
    # Agregar items BULK
    for bulk in bulk_items:
        items.append(
            StockItemDetail(
                product_id=bulk.product.id,
                product_name=bulk.product.name,
                product_sku=bulk.product.sku,
                product_type=bulk.product.type,
                category=bulk.product.category,
                quantity=bulk.quantity,
                serial_items=None,
                serial_count=None
            )
        )
    
    # Agregar items SERIALIZED
    # Construir mapa de categorías desde los productos ya cargados (evita N+1 queries)
    product_category_map = {}
    for item in serial_items:
        if item.product_id not in product_category_map and item.product:
            product_category_map[item.product_id] = item.product.category
    
    for product_id, serials in serials_by_product.items():
        product = serials[0].product_name  # Tomar de primer serial
        sku = serials[0].product_sku
        
        # Usar el mapa de categorías ya cargado en lugar de N+1 db.get()
        category = product_category_map.get(product_id)
        
        items.append(
            StockItemDetail(
                product_id=product_id,
                product_name=product,
                product_sku=sku,
                product_type=ProductType.SERIALIZED,
                category=category,
                quantity=None,
                serial_items=serials,
                serial_count=len(serials)
            )
        )
    
    return WarehouseStockResponse(
        warehouse_id=warehouse.id,
        warehouse_name=warehouse.name,
        warehouse_type=warehouse.type,
        user_id=warehouse.user_id,
        items=items
    )


# ============================================
# PRODUCTS ENDPOINTS
# ============================================

@router.get("/products", response_model=List[ProductResponse])
def list_products(
    type: Optional[ProductType] = Query(None, description="Filtrar por tipo (BULK o SERIALIZED)"),
    category: Optional[str] = Query(None, description="Filtrar por categoría"),
    search: Optional[str] = Query(None, description="Buscar por nombre o SKU"),
    group_id: Optional[int] = Query(None, description="Filtrar por grupo de producto"),
    db: Session = Depends(get_db)
):
    """
    Listar productos con filtros opcionales (Server-Side Filtering).
    
    **Parámetros Query:**
    - type: BULK o SERIALIZED (opcional)
    - category: Categoría del producto (opcional)
    - search: Buscar en nombre o SKU (opcional)
    - group_id: Filtrar por grupo de producto (opcional)
    """
    stmt = select(Product).options(
        joinedload(Product.group),
        joinedload(Product.spec)
    )
    
    if type:
        stmt = stmt.where(Product.type == type)
    
    if category:
        stmt = stmt.where(Product.category == category)
    
    if group_id:
        stmt = stmt.where(Product.group_id == group_id)
    
    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(search_pattern),
                Product.sku.ilike(search_pattern)
            )
        )
    
    stmt = stmt.order_by(Product.category, Product.name)
    products = db.execute(stmt).scalars().unique().all()
    
    return [_product_to_response(p) for p in products]


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db)
):
    """
    Crear un nuevo producto en el catálogo.
    
    El SKU debe ser único en todo el sistema.
    """
    # Validar SKU único
    existing = db.execute(
        select(Product).where(Product.sku == payload.sku)
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Producto con SKU '{payload.sku}' ya existe"
        )
    
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    
    # 🔒 AUDIT LOG: Registrar creación de producto
    try:
        log_create(
            db=db,
            user_id=_get_user_id_from_request(),
            entity_name="products",
            entity_id=product.id,
            new_values=get_entity_dict(product)
        )
    except Exception as audit_error:
        logger.error(f"❌ [AUDIT] Error al registrar creación de producto {product.id}: {audit_error}")
    
    # Recargar con relaciones para la respuesta
    product = db.execute(
        select(Product).options(joinedload(Product.group), joinedload(Product.spec))
        .where(Product.id == product.id)
    ).scalar_one()
    
    return _product_to_response(product)


# ============================================
# PRODUCT CATEGORY ENDPOINTS
# ============================================


@router.get("/product-categories", response_model=List[ProductCategoryResponse])
def list_product_categories(
    active_only: bool = Query(True, description="Solo categorías activas"),
    db: Session = Depends(get_db)
):
    """
    Listar categorías de productos desde la tabla product_categories.
    Los valores se siembran en migración: Cableado, Equipos, Accesorios, Herramientas.
    """
    try:
        stmt = select(ProductCategory)
        if active_only:
            stmt = stmt.where(ProductCategory.is_active == True)
        stmt = stmt.order_by(ProductCategory.name)
        result = db.execute(stmt).scalars().all()
        return [ProductCategoryResponse.model_validate(cat) for cat in result]
    except Exception as e:
        logger.error(f"Error al listar categorías de productos: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener categorías de productos")


# ============================================
# PRODUCT ENDPOINTS (continuación)
# ============================================


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db)
):
    """
    Actualizar un producto existente.
    
    **Campos editables:**
    - name, sku (validar unicidad si cambia), category, description, min_stock_alert
    
    **CRÍTICO - type es INMUTABLE:**
    - No se puede cambiar ProductType una vez creado
    - Si el request intenta cambiarlo, se ignora
    - El tipo es permanente para garantizar integridad de datos
    """
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con id {product_id} no encontrado"
        )
    
    # Capturar valores anteriores para auditoría
    old_values = get_entity_dict(product)
    
    # Obtener datos del payload (solo campos que vienen en el request)
    update_data = payload.model_dump(exclude_unset=True)
    
    # CRÍTICO: Prevenir cambio de type
    if 'type' in update_data:
        del update_data['type']  # Ignorar type si viene en el request
    
    # Validar SKU único si se está cambiando
    if 'sku' in update_data and update_data['sku'] != product.sku:
        existing = db.execute(
            select(Product).where(Product.sku == update_data['sku'])
        ).scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Producto con SKU '{update_data['sku']}' ya existe"
            )
    
    # Aplicar actualizaciones
    for field, value in update_data.items():
        setattr(product, field, value)
    
    db.commit()
    db.refresh(product)
    
    # 🔒 AUDIT LOG: Registrar actualización de producto
    try:
        log_update(
            db=db,
            user_id=_get_user_id_from_request(),
            entity_name="products",
            entity_id=product.id,
            old_values=old_values,
            new_values=get_entity_dict(product)
        )
    except Exception as audit_error:
        logger.error(f"❌ [AUDIT] Error al registrar actualización de producto {product.id}: {audit_error}")
    
    # Recargar con relaciones para la respuesta
    product = db.execute(
        select(Product).options(joinedload(Product.group), joinedload(Product.spec))
        .where(Product.id == product.id)
    ).scalar_one()
    return _product_to_response(product)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    """
    Eliminar un producto del catálogo.
    
    **VALIDACIONES CRÍTICAS:**
    - No se puede eliminar si tiene stock actual (stock_bulk.quantity > 0 O serial_items activos)
    - No se puede eliminar si tiene movimientos históricos en stock_movements
    
    La razón: Mantener integridad de auditoría y trazabilidad.
    
    **Retorna:**
    - 204 No Content si se elimina exitosamente
    - 404 si el producto no existe
    - 409 Conflict si tiene datos asociados
    """
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con id {product_id} no encontrado"
        )
    
    # Validación 1: Verificar stock bulk (SELECT COUNT optimizado)
    bulk_count = db.execute(
        select(func.count()).select_from(StockBulk).where(
            and_(
                StockBulk.product_id == product_id,
                StockBulk.quantity > 0
            )
        )
    ).scalar()
    
    if bulk_count and bulk_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: El producto tiene stock BULK disponible en {bulk_count} almacén(es). Transfiera o consume el stock antes de eliminar."
        )
    
    # Validación 2: Verificar serial items activos (SELECT COUNT optimizado)
    serial_count = db.execute(
        select(func.count()).select_from(SerialItem).where(
            and_(
                SerialItem.product_id == product_id,
                SerialItem.status.in_([SerialItemStatus.NEW, SerialItemStatus.IN_VEHICLE])
            )
        )
    ).scalar()
    
    if serial_count and serial_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: El producto tiene {serial_count} item(s) serializados activos. Transfiera o dé de baja los items antes de eliminar."
        )
    
    # Validación 3: Verificar movimientos históricos (SELECT COUNT optimizado)
    movements_count = db.execute(
        select(func.count()).select_from(StockMovement).where(
            StockMovement.product_id == product_id
        )
    ).scalar()
    
    if movements_count and movements_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: El producto tiene {movements_count} movimiento(s) registrado(s) en el historial. No se pueden eliminar productos con historial de auditoría."
        )
    
    # Capturar valores anteriores para auditoría
    old_values = get_entity_dict(product)
    product_id_for_audit = product.id
    
    # Si pasa todas las validaciones, proceder a eliminar
    db.delete(product)
    db.commit()
    
    # 🔒 AUDIT LOG: Registrar eliminación de producto
    try:
        log_delete(
            db=db,
            user_id=_get_user_id_from_request(),
            entity_name="products",
            entity_id=product_id_for_audit,
            old_values=old_values
        )
    except Exception as audit_error:
        logger.error(f"❌ [AUDIT] Error al registrar eliminación de producto {product_id_for_audit}: {audit_error}")
    
    # No return (204 No Content)


# ============================================
# SERIAL ITEMS ENDPOINTS
# ============================================

@router.post("/serial-items", response_model=SerialItemResponse, status_code=status.HTTP_201_CREATED)
def create_serial_item(
    payload: SerialItemCreate,
    db: Session = Depends(get_db)
):
    """
    Registrar un nuevo item con serial único.
    
    El serial_number debe ser único en todo el sistema.
    Crea automáticamente un movimiento de tipo PURCHASE.
    """
    # Validar que producto existe y es SERIALIZED
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con id {payload.product_id} no encontrado"
        )
    
    if product.type != ProductType.SERIALIZED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Producto '{product.sku}' no es tipo SERIALIZED"
        )
    
    # Validar serial único
    existing = db.execute(
        select(SerialItem).where(SerialItem.serial_number == payload.serial_number)
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Serial '{payload.serial_number}' ya está registrado"
        )
    
    # Validar warehouse existe
    warehouse = db.get(Warehouse, payload.warehouse_id)
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse con id {payload.warehouse_id} no encontrado"
        )
    
    # Crear serial item
    serial_item = SerialItem(**payload.model_dump())
    db.add(serial_item)
    db.flush()
    
    # Crear movimiento de PURCHASE
    user_id = _get_user_id_from_request()
    movement = StockMovement(
        product_id=product.id,
        from_warehouse_id=None,  # Compra no tiene origen
        to_warehouse_id=warehouse.id,
        quantity=None,
        serial_item_id=serial_item.id,
        movement_type=MovementType.PURCHASE,
        reference=f"Alta de serial {payload.serial_number}",
        user_id=user_id
    )
    db.add(movement)
    
    db.commit()
    db.refresh(serial_item)
    db.refresh(serial_item, attribute_names=["product", "warehouse"])
    
    return SerialItemResponse(
        **serial_item.__dict__,
        product_name=serial_item.product.name,
        product_sku=serial_item.product.sku,
        warehouse_name=serial_item.warehouse.name
    )


# ============================================
# STOCK TRANSFER ENDPOINT (CRÍTICO)
# ============================================

@router.post("/transfer", response_model=StockTransferResponse)
def transfer_stock(
    payload: StockTransferRequest,
    db: Session = Depends(get_db)
):
    """
    **Endpoint crítico:** Transferir stock entre warehouses.
    
    Lógica:
    1. Valida que producto, origen y destino existan
    2. Valida stock suficiente en origen
    3. Para **BULK**: ajusta cantidades en StockBulk
    4. Para **SERIALIZED**: actualiza warehouse_id en SerialItem
    5. Registra movimientos en StockMovement
    
    **Validaciones:**
    - Producto BULK requiere `quantity` (no `serial_item_ids`)
    - Producto SERIALIZED requiere `serial_item_ids` (no `quantity`)
    """
    user_id = _get_user_id_from_request()
    
    # Validar producto existe
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con id {payload.product_id} no encontrado"
        )
    
    # Validar warehouses existen
    from_warehouse = db.get(Warehouse, payload.from_warehouse_id)
    if not from_warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse origen con id {payload.from_warehouse_id} no encontrado"
        )
    
    to_warehouse = db.get(Warehouse, payload.to_warehouse_id)
    if not to_warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse destino con id {payload.to_warehouse_id} no encontrado"
        )
    
    # Validar que origen != destino
    if payload.from_warehouse_id == payload.to_warehouse_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Warehouse origen y destino no pueden ser el mismo"
        )
    
    movements_created = []
    
    # CASO 1: Producto BULK
    if product.type == ProductType.BULK:
        if not payload.quantity or payload.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Productos BULK requieren 'quantity' > 0"
            )
        
        if payload.serial_item_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Productos BULK no deben especificar 'serial_item_ids'"
            )
        
        # Validar stock suficiente en origen
        origin_stock = db.execute(
            select(StockBulk).where(
                and_(
                    StockBulk.warehouse_id == payload.from_warehouse_id,
                    StockBulk.product_id == payload.product_id
                )
            )
        ).scalar_one_or_none()
        
        if not origin_stock or origin_stock.quantity < payload.quantity:
            available = origin_stock.quantity if origin_stock else 0
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente en warehouse origen. Disponible: {available}, Solicitado: {payload.quantity}"
            )
        
        # Reducir stock en origen
        origin_stock.quantity -= payload.quantity
        
        # Aumentar stock en destino (crear si no existe)
        dest_stock = db.execute(
            select(StockBulk).where(
                and_(
                    StockBulk.warehouse_id == payload.to_warehouse_id,
                    StockBulk.product_id == payload.product_id
                )
            )
        ).scalar_one_or_none()
        
        if dest_stock:
            dest_stock.quantity += payload.quantity
        else:
            dest_stock = StockBulk(
                warehouse_id=payload.to_warehouse_id,
                product_id=payload.product_id,
                quantity=payload.quantity
            )
            db.add(dest_stock)
        
        # Registrar movimiento
        movement = StockMovement(
            product_id=product.id,
            from_warehouse_id=payload.from_warehouse_id,
            to_warehouse_id=payload.to_warehouse_id,
            quantity=payload.quantity,
            serial_item_id=None,
            movement_type=MovementType.TRANSFER,
            reference=payload.reference or f"Transferencia de {from_warehouse.name} a {to_warehouse.name}",
            user_id=user_id,
            notes=payload.notes
        )
        db.add(movement)
        db.flush()
        movements_created.append(movement.id)
    
    # CASO 2: Producto SERIALIZED
    elif product.type == ProductType.SERIALIZED:
        if not payload.serial_item_ids or len(payload.serial_item_ids) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Productos SERIALIZED requieren 'serial_item_ids' (al menos uno)"
            )
        
        if payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Productos SERIALIZED no deben especificar 'quantity'"
            )
        
        # Validar y transferir cada serial
        for serial_id in payload.serial_item_ids:
            serial_item = db.get(SerialItem, serial_id)
            
            if not serial_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Serial item con id {serial_id} no encontrado"
                )
            
            # Validar que pertenece al producto correcto
            if serial_item.product_id != payload.product_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Serial {serial_item.serial_number} no pertenece al producto especificado"
                )
            
            # Validar que está en warehouse origen
            if serial_item.warehouse_id != payload.from_warehouse_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Serial {serial_item.serial_number} no está en warehouse origen"
                )
            
            # Transferir serial
            serial_item.warehouse_id = payload.to_warehouse_id
            
            # Registrar movimiento
            movement = StockMovement(
                product_id=product.id,
                from_warehouse_id=payload.from_warehouse_id,
                to_warehouse_id=payload.to_warehouse_id,
                quantity=None,
                serial_item_id=serial_item.id,
                movement_type=MovementType.TRANSFER,
                reference=payload.reference or f"Transferencia serial {serial_item.serial_number}",
                user_id=user_id,
                notes=payload.notes
            )
            db.add(movement)
            db.flush()
            movements_created.append(movement.id)
    
    db.commit()
    
    # 🔒 AUDIT LOG: Registrar transferencia de stock
    try:
        log_create(
            db=db,
            user_id=user_id,
            entity_name="stock_transfers",
            entity_id=movements_created[0] if movements_created else None,
            new_values={
                "product_id": payload.product_id,
                "from_warehouse_id": payload.from_warehouse_id,
                "to_warehouse_id": payload.to_warehouse_id,
                "quantity": payload.quantity,
                "serial_item_ids": payload.serial_item_ids,
                "movements_created": movements_created,
                "reference": payload.reference
            }
        )
    except Exception as audit_error:
        logger.error(f"❌ [AUDIT] Error al registrar transferencia de stock: {audit_error}")
    
    return StockTransferResponse(
        success=True,
        movements_created=movements_created,
        message=f"Transferencia exitosa: {len(movements_created)} movimiento(s) registrado(s)"
    )


# ============================================
# STOCK MOVEMENTS (AUDITORÍA)
# ============================================

@router.get("/movements", response_model=List[StockMovementResponse])
def list_stock_movements(
    product_id: Optional[int] = Query(None, description="Filtrar por producto"),
    warehouse_id: Optional[int] = Query(None, description="Filtrar por warehouse (origen o destino)"),
    movement_type: Optional[List[MovementType]] = Query(None, description="Filtrar por tipo(s) de movimiento (separar por coma)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Listar movimientos de stock (auditoría) con filtros opcionales.
    Ordenado por fecha descendente (más recientes primero).
    """
    stmt = (
        select(StockMovement)
        .options(
            joinedload(StockMovement.product),
            joinedload(StockMovement.from_warehouse),
            joinedload(StockMovement.to_warehouse),
            joinedload(StockMovement.serial_item),
            joinedload(StockMovement.user)
        )
    )
    
    if product_id:
        stmt = stmt.where(StockMovement.product_id == product_id)
    
    if warehouse_id:
        stmt = stmt.where(
            or_(
                StockMovement.from_warehouse_id == warehouse_id,
                StockMovement.to_warehouse_id == warehouse_id
            )
        )
    
    if movement_type:
        stmt = stmt.where(StockMovement.movement_type.in_(movement_type))
    
    stmt = stmt.order_by(StockMovement.date.desc()).offset(offset).limit(limit)
    movements = db.execute(stmt).scalars().all()
    
    return [
        StockMovementResponse(
            **m.__dict__,
            user_name=_safe_user_name(m.user),
            product_name=m.product.name if m.product else None,
            product_sku=m.product.sku if m.product else None,
            from_warehouse_name=m.from_warehouse.name if m.from_warehouse else None,
            to_warehouse_name=m.to_warehouse.name if m.to_warehouse else None,
            serial_number=m.serial_item.serial_number if m.serial_item else None
        )
        for m in movements
    ]


# ============================================
# STOCK ADJUSTMENT ENDPOINT
# ============================================

@router.post("/adjustments", response_model=StockAdjustmentResponse)
def create_stock_adjustment(
    payload: StockAdjustmentRequest,
    db: Session = Depends(get_db)
):
    """
    **Endpoint para ajustes de inventario** (compras, ingresos, correcciones).
    
    Permite ingresar stock BULK a un warehouse específico.
    
    **Casos de uso:**
    - Compra de materiales (MovementType.PURCHASE)
    - Ajustes de inventario (MovementType.ADJUSTMENT)
    - Correcciones de stock
    
    **Validaciones:**
    - Producto debe existir y ser tipo BULK
    - Warehouse debe existir
    - Cantidad debe ser > 0
    
    **Comportamiento:**
    - Si stock_bulk existe para ese warehouse+producto → suma cantidad
    - Si NO existe → crea nuevo registro
    - Siempre crea movimiento en stock_movements para auditoría
    """
    user_id = _get_user_id_from_request()
    
    # Validar que el producto existe y es BULK
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con id {payload.product_id} no encontrado"
        )
    
    if product.type != ProductType.BULK:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El producto '{product.sku}' no es tipo BULK. Los ajustes solo aplican a productos BULK."
        )
    
    # Validar que el warehouse existe
    warehouse = db.get(Warehouse, payload.warehouse_id)
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse con id {payload.warehouse_id} no encontrado"
        )
    
    # Validar movement_type (solo PURCHASE o ADJUSTMENT)
    if payload.movement_type not in [MovementType.PURCHASE, MovementType.ADJUSTMENT]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten movement_type PURCHASE o ADJUSTMENT para ajustes de stock"
        )
    
    # Buscar si ya existe stock_bulk para este warehouse + producto
    existing_stock = db.execute(
        select(StockBulk).where(
            and_(
                StockBulk.warehouse_id == payload.warehouse_id,
                StockBulk.product_id == payload.product_id
            )
        )
    ).scalar_one_or_none()
    
    previous_quantity = 0.0
    
    if existing_stock:
        # Actualizar stock existente
        previous_quantity = existing_stock.quantity
        existing_stock.quantity += payload.quantity
        stock_bulk_id = existing_stock.id
    else:
        # Crear nuevo registro de stock
        new_stock = StockBulk(
            warehouse_id=payload.warehouse_id,
            product_id=payload.product_id,
            quantity=payload.quantity
        )
        db.add(new_stock)
        db.flush()
        stock_bulk_id = new_stock.id
    
    new_quantity = previous_quantity + payload.quantity
    
    # Crear movimiento para auditoría
    movement = StockMovement(
        product_id=payload.product_id,
        from_warehouse_id=None,  # No hay origen en ajustes/compras
        to_warehouse_id=payload.warehouse_id,
        quantity=payload.quantity,
        serial_item_id=None,
        movement_type=payload.movement_type,
        reference=payload.reference or f"Ajuste de stock - {payload.movement_type.value}",
        notes=payload.notes,
        user_id=user_id
    )
    db.add(movement)
    
    db.commit()
    db.refresh(movement)
    
    return StockAdjustmentResponse(
        success=True,
        movement_id=movement.id,
        stock_bulk_id=stock_bulk_id,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        message=f"Stock ajustado exitosamente. {previous_quantity} → {new_quantity} (+{payload.quantity})"
    )


# ============================================
# PRODUCT GROUP ENDPOINTS
# ============================================


@router.get("/product-groups", response_model=List[ProductGroupResponse])
def list_product_groups(
    active_only: bool = Query(True, description="Solo grupos activos"),
    db: Session = Depends(get_db)
):
    """
    Listar grupos de productos.
    Ej: ONU/ONT, Router Domiciliario, Conectores, Cableado.
    """
    stmt = select(ProductGroup)
    if active_only:
        stmt = stmt.where(ProductGroup.is_active == True)
    stmt = stmt.order_by(ProductGroup.name)
    result = db.execute(stmt).scalars().all()
    return [ProductGroupResponse.model_validate(g) for g in result]


@router.post("/product-groups", response_model=ProductGroupResponse, status_code=status.HTTP_201_CREATED)
def create_product_group(
    payload: ProductGroupCreate,
    db: Session = Depends(get_db)
):
    """Crear un nuevo grupo de productos."""
    existing = db.execute(
        select(ProductGroup).where(ProductGroup.name == payload.name)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Grupo '{payload.name}' ya existe"
        )
    group = ProductGroup(**payload.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return ProductGroupResponse.model_validate(group)


@router.put("/product-groups/{group_id}", response_model=ProductGroupResponse)
def update_product_group(
    group_id: int,
    payload: ProductGroupUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar un grupo de productos."""
    group = db.get(ProductGroup, group_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)
    db.commit()
    db.refresh(group)
    return ProductGroupResponse.model_validate(group)


@router.delete("/product-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_group(
    group_id: int,
    db: Session = Depends(get_db)
):
    """Eliminar un grupo de productos (solo si no tiene productos asociados)."""
    group = db.get(ProductGroup, group_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado")
    # Verificar si hay productos usando este grupo
    product_count = db.execute(
        select(func.count(Product.id)).where(Product.group_id == group_id)
    ).scalar()
    if product_count and product_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar el grupo: {product_count} producto(s) lo usan"
        )
    db.delete(group)
    db.commit()


# ============================================
# PRODUCT SPEC ENDPOINTS
# ============================================


@router.get("/products/{product_id}/specs", response_model=ProductSpecResponse)
def get_product_specs(
    product_id: int,
    db: Session = Depends(get_db)
):
    """Obtener especificaciones técnicas de un producto."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    spec = db.execute(
        select(ProductSpec).where(ProductSpec.product_id == product_id)
    ).scalar_one_or_none()
    if not spec:
        return ProductSpecResponse(product_id=product_id, specs=None, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    return ProductSpecResponse.model_validate(spec)


@router.put("/products/{product_id}/specs", response_model=ProductSpecResponse)
def update_product_specs(
    product_id: int,
    payload: ProductSpecUpdate,
    db: Session = Depends(get_db)
):
    """Crear o actualizar especificaciones técnicas de un producto."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    
    spec = db.execute(
        select(ProductSpec).where(ProductSpec.product_id == product_id)
    ).scalar_one_or_none()
    
    if spec:
        spec.specs = payload.specs
    else:
        spec = ProductSpec(product_id=product_id, specs=payload.specs)
        db.add(spec)
    
    db.commit()
    db.refresh(spec)
    return ProductSpecResponse.model_validate(spec)
