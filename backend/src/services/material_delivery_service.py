"""
Material Delivery Service - Lógica de propuesta inteligente de materiales.
Calcula los materiales necesarios para una cuadrilla basándose en:
- OT programadas del día
- Plantillas de materiales (WOTemplate)
- Stock actual en el móvil
- Reglas de redondeo para productos compuestos
- Criterio de selección de modelos para ONT/ONU
"""
from __future__ import annotations
from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple
import logging

from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import select, and_, func

from src.models.inventory import (
    Product, ProductGroup, StockBulk, SerialItem,
    ProductType, SerialItemStatus, WarehouseType
)
from src.models.tickets import WorkOrder, WorkOrderStatus
from src.models.work_order_types import WOTemplate, WOTemplateItem
from src.models.coordination import Team, TeamMember
from src.models.fleet import Vehicle
from src.models.logistics import (
    MaterialDelivery, MaterialDeliveryItem,
    DeliveryStatus, DeliveryItemSource
)

logger = logging.getLogger("uvicorn.error")


def generate_delivery_proposal(
    db: Session,
    team_id: int,
    target_date: Optional[date] = None
) -> dict:
    """
    Genera una propuesta de materiales para una cuadrilla.
    
    Args:
        db: Sesión de base de datos
        team_id: ID de la cuadrilla
        target_date: Fecha objetivo (default: hoy)
    
    Returns:
        Dict con la propuesta completa
    """
    if target_date is None:
        target_date = date.today()

    # 1. Obtener team con su vehículo
    team = db.get(Team, team_id)
    if not team:
        raise ValueError(f"Cuadrilla {team_id} no encontrada")

    vehicle = team.vehicle if team else None
    if not vehicle:
        raise ValueError(f"La cuadrilla {team.name} no tiene vehículo asignado")

    mobile_warehouse = vehicle.warehouse
    if not mobile_warehouse:
        raise ValueError(f"El vehículo {vehicle.name} no tiene almacén móvil")

    # 2. Obtener OT programadas para la fecha
    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = datetime.combine(target_date, datetime.max.time())

    work_orders = db.execute(
        select(WorkOrder)
        .options(joinedload(WorkOrder.work_order_items))
        .where(
            WorkOrder.team_id == team_id,
            WorkOrder.scheduled_start >= start_dt,
            WorkOrder.scheduled_start <= end_dt,
            WorkOrder.status.in_([
                WorkOrderStatus.scheduled,
                WorkOrderStatus.in_progress,
                WorkOrderStatus.pending_planning,
                WorkOrderStatus.coordinated
            ])
        )
    ).scalars().unique().all()

    # 3. Obtener stock actual del móvil
    mobile_stock = _get_mobile_stock(db, mobile_warehouse.id)

    # 4. Para cada OT, obtener plantillas y acumular requerimientos
    required_materials = {}  # product_id -> {required_qty, preferred_model_id}
    
    for wo in work_orders:
        # Buscar plantilla que coincida con ot_type + action_code
        template = db.execute(
            select(WOTemplate)
            .options(selectinload(WOTemplate.items))
            .where(
                WOTemplate.ot_type == wo.ot_type.value,
                WOTemplate.action_code == (wo.resolution_category or wo.ot_type.value),
                WOTemplate.is_active == True
            )
        ).scalar_one_or_none()

        if not template:
            # Fallback: buscar por solo ot_type
            template = db.execute(
                select(WOTemplate)
                .options(selectinload(WOTemplate.items))
                .where(
                    WOTemplate.ot_type == wo.ot_type.value,
                    WOTemplate.is_active == True
                )
            ).scalar_one_or_none()

        if template and template.items:
            for item in template.items:
                if item.product_id:
                    # Item refiere a un producto específico
                    pid = item.product_id
                    if pid not in required_materials:
                        required_materials[pid] = {
                            "required_qty": 0.0,
                            "preferred_model_id": None,
                            "group_id": None,
                        }
                    required_materials[pid]["required_qty"] += item.default_quantity
                
                elif item.group_id:
                    # Item refiere a un grupo (ej: "ONU/ONT")
                    # Buscar el mejor producto de ese grupo para sugerir
                    group_products = db.execute(
                        select(Product).where(
                            Product.group_id == item.group_id,
                            Product.type == ProductType.SERIALIZED,
                        )
                    ).scalars().all()
                    
                    if not group_products:
                        # Fallback: cualquier producto del grupo
                        group_products = db.execute(
                            select(Product).where(
                                Product.group_id == item.group_id
                            )
                        ).scalars().all()
                    
                    if group_products:
                        # Seleccionar el mejor producto del grupo (con más stock)
                        best_product = _select_best_in_group(db, group_products)
                        pid = best_product.id
                        if pid not in required_materials:
                            required_materials[pid] = {
                                "required_qty": 0.0,
                                "preferred_model_id": None,
                                "group_id": item.group_id,
                            }
                        required_materials[pid]["required_qty"] += item.default_quantity

    # 5. Calcular faltantes y generar propuesta
    proposal_items = []
    for pid, req in required_materials.items():
        product = db.get(Product, pid)
        if not product:
            continue

        available = mobile_stock.get(pid, 0.0)
        required = req["required_qty"]
        deficit = required - available

        if deficit <= 0:
            continue  # Ya tiene suficiente en el móvil

        # Aplicar redondeo para productos compuestos
        suggested_qty = deficit
        suggested_composite_units = None
        if product.is_composite and product.unit_size and product.unit_size > 0:
            import math
            composite_units = math.ceil(deficit / product.unit_size)
            suggested_qty = composite_units * product.unit_size
            suggested_composite_units = composite_units
            
            composite_label = product.composite_unit_label or "unidad(es)"
            logger.info(f"  → {product.name}: {deficit} {product.unit_measure} "
                       f"≈ {composite_units} {composite_label}")

        # Para SERIALIZED, seleccionar modelo preferido
        preferred_model_id = req.get("preferred_model_id")
        if product.type == ProductType.SERIALIZED and not preferred_model_id:
            preferred_model_id = _select_preferred_model(
                db, product, mobile_warehouse.id
            )

        proposal_items.append({
            "product_id": pid,
            "product_name": product.name,
            "product_sku": product.sku,
            "group_name": product.group.name if product.group else None,
            "is_composite": product.is_composite,
            "unit_size": product.unit_size,
            "unit_measure": product.unit_measure,
            "composite_unit_label": product.composite_unit_label,
            "available_in_mobile": available,
            "required_total": required,
            "deficit": deficit,
            "suggested_quantity": suggested_qty,
            "suggested_composite_units": suggested_composite_units,
            "preferred_model_id": preferred_model_id,
            "product_type": product.type.value,
        })

    return {
        "team_id": team.id,
        "team_name": team.name,
        "vehicle_name": vehicle.name,
        "mobile_warehouse_id": mobile_warehouse.id,
        "work_orders_count": len(work_orders),
        "items": proposal_items,
        "generated_at": datetime.utcnow(),
    }


def _select_best_in_group(db: Session, products: list) -> Product:
    """
    Selecciona el mejor producto dentro de un grupo.
    Prioriza:
    1. Producto con más stock en warehouses CENTRAL
    2. Producto con stock disponible (NEW)
    3. Primer producto del grupo como fallback
    """
    if not products:
        return None
    if len(products) == 1:
        return products[0]

    # Obtener conteo de stock en central para cada producto
    product_ids = [p.id for p in products]
    stock_counts = db.execute(
        select(
            SerialItem.product_id,
            func.count(SerialItem.id).label("cnt")
        ).where(
            SerialItem.product_id.in_(product_ids),
            SerialItem.status == SerialItemStatus.NEW
        ).group_by(SerialItem.product_id)
        .order_by(func.count(SerialItem.id).desc())
    ).all()

    if stock_counts:
        best_id = stock_counts[0][0]
        best = next((p for p in products if p.id == best_id), None)
        if best:
            return best

    # Fallback: primer producto
    return products[0]


def _get_mobile_stock(db: Session, warehouse_id: int) -> dict:
    """
    Obtiene el stock actual de un almacén móvil.
    Retorna dict: {product_id: total_quantity}
    """
    stock = {}
    
    # Stock BULK
    bulk_items = db.execute(
        select(StockBulk).where(StockBulk.warehouse_id == warehouse_id)
    ).scalars().all()
    
    for item in bulk_items:
        if item.quantity > 0:
            stock[item.product_id] = stock.get(item.product_id, 0) + item.quantity
    
    # Stock SERIALIZED (contar seriales disponibles)
    serial_counts = db.execute(
        select(
            SerialItem.product_id,
            func.count(SerialItem.id)
        ).where(
            SerialItem.warehouse_id == warehouse_id,
            SerialItem.status.in_([SerialItemStatus.NEW, SerialItemStatus.IN_VEHICLE])
        ).group_by(SerialItem.product_id)
    ).all()
    
    for product_id, count in serial_counts:
        stock[product_id] = stock.get(product_id, 0) + count
    
    return stock


def _select_preferred_model(
    db: Session,
    product: Product,
    warehouse_id: int
) -> Optional[int]:
    """
    Selecciona el modelo preferido para productos SERIALIZED.
    Prioriza:
    1. Productos con más stock disponible en central
    2. Productos del mismo grupo
    3. Productos más antiguos en stock (FIFO)
    """
    if not product.group_id:
        return None
    
    # Buscar otros productos del mismo grupo con stock en central
    central_warehouses = db.execute(
        select(SerialItem.warehouse_id)
        .join(Product, SerialItem.product_id == Product.id)
        .where(
            Product.group_id == product.group_id,
            SerialItem.status == SerialItemStatus.NEW
        )
        .distinct()
        .limit(5)
    ).scalars().all()
    
    if not central_warehouses:
        return None
    
    # Obtener el producto del mismo grupo con más stock
    best = db.execute(
        select(
            SerialItem.product_id,
            func.count(SerialItem.id).label("stock_count")
        )
        .where(
            SerialItem.product_id != product.id,
            SerialItem.warehouse_id.in_(central_warehouses),
            SerialItem.status == SerialItemStatus.NEW
        )
        .group_by(SerialItem.product_id)
        .order_by(func.count(SerialItem.id).desc())
        .limit(1)
    ).first()
    
    return best[0] if best else None


def create_delivery_from_proposal(
    db: Session,
    team_id: int,
    warehouse_from_id: int,
    warehouse_to_id: int,
    user_id: int,
    proposal_items: list,
    notes: Optional[str] = None
) -> MaterialDelivery:
    """
    Crea una entrega de materiales basada en una propuesta.
    """
    delivery = MaterialDelivery(
        team_id=team_id,
        warehouse_from_id=warehouse_from_id,
        warehouse_to_id=warehouse_to_id,
        status=DeliveryStatus.DRAFT,
        delivered_by_user_id=user_id,
        proposal_generated_at=datetime.utcnow(),
        notes=notes,
    )
    db.add(delivery)
    db.flush()

    for item_data in proposal_items:
        delivery_item = MaterialDeliveryItem(
            delivery_id=delivery.id,
            product_id=item_data["product_id"],
            quantity_proposed=item_data.get("suggested_quantity", 0),
            quantity_delivered=item_data.get("suggested_quantity", 0),
            is_serialized=item_data.get("product_type") == "SERIALIZED",
            source=DeliveryItemSource.PROPOSAL,
            notes=item_data.get("notes"),
        )
        db.add(delivery_item)

    db.commit()
    db.refresh(delivery)
    return delivery


def confirm_delivery(
    db: Session,
    delivery_id: int,
    user_id: int
) -> MaterialDelivery:
    """
    Confirma una entrega y ejecuta la transferencia de stock.
    """
    delivery = db.get(MaterialDelivery, delivery_id)
    if not delivery:
        raise ValueError(f"Entrega {delivery_id} no encontrada")
    
    if delivery.status == DeliveryStatus.COMPLETED:
        raise ValueError(f"La entrega {delivery_id} ya fue completada")

    # Ejecutar transferencia de stock para cada item
    from src.services.inventory_service import transfer_stock_bulk, transfer_stock_serial

    for item in delivery.items:
        if item.quantity_delivered <= 0:
            continue

        if item.is_serialized:
            # Producto serializado
            serial_id = item.serial_item_id
            if not serial_id:
                # Buscar serial disponible en el depósito origen
                available = db.execute(
                    select(SerialItem).where(
                        SerialItem.product_id == item.product_id,
                        SerialItem.warehouse_id == delivery.warehouse_from_id,
                        SerialItem.status == SerialItemStatus.NEW
                    )
                ).scalars().first()
                if not available:
                    raise ValueError(
                        f"No hay seriales disponibles de '{item.product.name if item.product else ''}' "
                        f"en el depósito origen"
                    )
                serial_id = available.id
            
            transfer_stock_serial(
                db=db,
                serial_item_id=serial_id,
                from_warehouse_id=delivery.warehouse_from_id,
                to_warehouse_id=delivery.warehouse_to_id,
                user_id=user_id,
                reference=f"Entrega #{delivery.id}",
                notes=item.notes
            )
        else:
            # Transferencia de stock BULK
            transfer_stock_bulk(
                db=db,
                product_id=item.product_id,
                quantity=item.quantity_delivered,
                from_warehouse_id=delivery.warehouse_from_id,
                to_warehouse_id=delivery.warehouse_to_id,
                user_id=user_id,
                reference=f"Entrega #{delivery.id}",
                notes=item.notes
            )

    delivery.status = DeliveryStatus.COMPLETED
    delivery.delivered_at = datetime.utcnow()
    db.commit()
    db.refresh(delivery)
    return delivery
