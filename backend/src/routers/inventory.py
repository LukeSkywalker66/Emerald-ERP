"""
Inventory Router - API endpoints para gestión de inventario operativo
Soporta almacenes móviles (camionetas) y seguimiento de seriales.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import select, and_, or_

from src.database import get_db
from src.models.inventory import (
    Warehouse, Product, StockBulk, SerialItem, StockMovement,
    WarehouseType, ProductType, MovementType, SerialItemStatus
)
from src.models.user import User
from src.schemas.inventory import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    SerialItemCreate, SerialItemUpdate, SerialItemResponse,
    StockMovementResponse, WarehouseStockResponse, StockItemDetail,
    StockTransferRequest, StockTransferResponse,
    StockAdjustmentRequest, StockAdjustmentResponse
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


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
    stmt = select(Warehouse).options(joinedload(Warehouse.user))
    
    if warehouse_type:
        stmt = stmt.where(Warehouse.type == warehouse_type)
    
    if user_id:
        stmt = stmt.where(Warehouse.user_id == user_id)
    
    stmt = stmt.order_by(Warehouse.type, Warehouse.name)
    warehouses = db.execute(stmt).scalars().all()
    
    return [
        WarehouseResponse(
            **warehouse.__dict__,
            user_name=_safe_user_name(warehouse.user)
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
    # Validar: MOBILE requiere user_id
    if payload.type == WarehouseType.MOBILE and not payload.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Warehouses tipo MOBILE requieren user_id (técnico asignado)"
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
    db.refresh(warehouse, attribute_names=["user"])
    
    return WarehouseResponse(
        **warehouse.__dict__,
        user_name=_safe_user_name(warehouse.user)
    )


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
        .where(SerialItem.status.in_([SerialItemStatus.NEW, SerialItemStatus.USED]))
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
    for product_id, serials in serials_by_product.items():
        product = serials[0].product_name  # Tomar de primer serial
        sku = serials[0].product_sku
        
        # Obtener product completo para category
        prod_obj = db.get(Product, product_id)
        
        items.append(
            StockItemDetail(
                product_id=product_id,
                product_name=product,
                product_sku=sku,
                product_type=ProductType.SERIALIZED,
                category=prod_obj.category if prod_obj else None,
                quantity=None,
                serial_items=serials,
                serial_count=len(serials)
            )
        )
    
    return WarehouseStockResponse(
        warehouse_id=warehouse.id,
        warehouse_name=warehouse.name,
        warehouse_type=warehouse.type,
        items=items
    )


# ============================================
# PRODUCTS ENDPOINTS
# ============================================

@router.get("/products", response_model=List[ProductResponse])
def list_products(
    product_type: Optional[ProductType] = Query(None, description="Filtrar por tipo"),
    category: Optional[str] = Query(None, description="Filtrar por categoría"),
    search: Optional[str] = Query(None, description="Buscar por nombre o SKU"),
    db: Session = Depends(get_db)
):
    """
    Listar productos con filtros opcionales.
    """
    stmt = select(Product)
    
    if product_type:
        stmt = stmt.where(Product.type == product_type)
    
    if category:
        stmt = stmt.where(Product.category == category)
    
    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(search_pattern),
                Product.sku.ilike(search_pattern)
            )
        )
    
    stmt = stmt.order_by(Product.category, Product.name)
    products = db.execute(stmt).scalars().all()
    
    return [ProductResponse(**p.__dict__) for p in products]


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
    
    return ProductResponse(**product.__dict__)


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
    movement_type: Optional[MovementType] = Query(None, description="Filtrar por tipo de movimiento"),
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
        stmt = stmt.where(StockMovement.movement_type == movement_type)
    
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
