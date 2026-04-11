from src.db.postgres import Database, init_db
from src.clients import smartolt, ispcube, mikrotik
from src import config, models
from src.utils.safe_call import safe_call
from src.celery_app import celery_app
from src.services.location_resolver import (
    resolve_address_data,
    get_or_create_city,
    get_or_create_neighborhood,
)
import time

def sync_nodes(db):
    print("   ↳ Buscando Nodos en ISPCube...", end=" ", flush=True)
    try:
        nodes = ispcube.obtener_nodos()
        if nodes:
            db.clear_table(models.Node)
            for n in nodes:
                db.insert_node(n["id"], n["name"], n["ip"], n["puerto"])
            config.logger.info(f"[SYNC] {len(nodes)} nodos sincronizados.")
            db.log_sync_status("ispcube", "ok", f"{len(nodes)} nodos sincronizados")
            print(f"✅ ({len(nodes)} encontrados)")
        else:
            print("⚠️ Lista vacía")
    except Exception as e:
        print(f"❌ Error: {e}")
        config.logger.error(f"[SYNC] Error Nodos: {e}")

def sync_secrets(db):
    nodes = db.get_nodes_for_sync()
    if not nodes:
        config.logger.warning("[SYNC] No hay nodos para sync secrets.")
        return

    db.clear_table(models.PPPSecret)
    print(f"   ↳ Consultando {len(nodes)} Mikrotiks:")
    total_secrets = 0

    for node in nodes:
        ip = node["ip"]
        name = node["name"]
        port = node["port"] if node["port"] else config.MK_PORT
        print(f"      > {name} ({ip})...", end=" ", flush=True)
        
        try:
            secrets = mikrotik.get_all_secrets(ip, port)
            if secrets is not None:
                for s in secrets:
                    db.insert_secret(s, ip)
                count = len(secrets)
                total_secrets += count
                print(f"✅ ({count})")
            else:
                print("⚠️ Sin respuesta")
        except Exception as e:
            print(f"❌ Error: {e}")
            config.logger.error(f"[SYNC] Error en router {ip}: {e}")
    
    db.commit()
    config.logger.info(f"[SYNC] {total_secrets} secrets sincronizados.")
    print(f"   ↳ Resumen: {total_secrets} secrets guardados.")

def sync_onus(db):
    print("   ↳ Consultando SmartOLT...", end=" ", flush=True)
    try:
        onus = smartolt.get_all_onus()
        if onus:
            # 1. Borramos todo (Tierra quemada)
            db.clear_table(models.Subscriber)
            
            # 2. Insertamos todo (incluso si el ID externo se repite)
            for onu in onus:
                db.insert_subscriber(
                    onu.get("unique_external_id"), 
                    onu.get("sn"), 
                    onu.get("olt_name"), 
                    onu.get("olt_id"), 
                    onu.get("board"), 
                    onu.get("port"), 
                    onu.get("onu"), 
                    onu.get("onu_type_id"), 
                    onu.get("name"), 
                    onu.get("mode"),
                    onu.get("vlan")  # <--- AGREGADO: Pasamos la VLAN del JSON
                )
            
            # 3. Guardamos los cambios en bloque
            db.commit() 
            
            db.log_sync_status("smartolt", "ok", f"{len(onus)} ONUs sincronizadas")
            config.logger.info(f"[SYNC] {len(onus)} ONUs sincronizadas.")
            print(f"✅ ({len(onus)} ONUs)")
        else:
            print("⚠️ Sin datos")
    except Exception as e:
        db.rollback() # <--- Importante por si falla
        print(f"❌ Error: {e}")
        config.logger.error(f"[SYNC] Error SmartOLT: {e}")

def sync_plans(db):
    print("   ↳ [ISPCube] Bajando Planes...", end=" ", flush=True)
    try:
        planes = ispcube.obtener_planes()
        if planes:
            # db.cursor.execute("DELETE FROM plans")
            db.clear_table(models.Plan)
            for p in planes:
                db.insert_plan(p["id"], p["name"], p.get("speed"), p.get("comment"))
            config.logger.info(f"[SYNC] {len(planes)} planes sincronizados.")
            print(f"✅ ({len(planes)})")
        else: print("⚠️")
    except Exception as e: print(f"❌ {e}")

def sync_connections(db):
    print("   ↳ [ISPCube] Bajando Conexiones (Lista Completa)...", end=" ", flush=True)
    try:
        # VOLVEMOS AL MÉTODO CLÁSICO
        conexiones = ispcube.obtener_todas_conexiones()
        clientes = ispcube.obtener_clientes() or []
        clientes_map = {c.get("id"): c for c in clientes if c.get("id")}
        if conexiones:
            # db.cursor.execute("DELETE FROM connections")
            db.clear_table(models.Connection)
            city_cache: dict[str, int] = {}
            neighborhood_cache: dict[tuple[str, int], int] = {}
            for c in conexiones:
                if not c.get("id") or not c.get("user"): continue
                client_payload = clientes_map.get(c.get("customer_id"))
                resolved = resolve_address_data({"connection": c, "client": client_payload})

                city_id = None
                neighborhood_id = None

                city_name = resolved.get("city_name")
                if city_name:
                    city_key = city_name.lower()
                    city_id = city_cache.get(city_key)
                    if city_id is None:
                        city = get_or_create_city(db.db, city_name)
                        city_id = city.id if city else None
                        if city_id:
                            city_cache[city_key] = city_id

                neighborhood_name = resolved.get("neighborhood_name")
                if neighborhood_name and city_id:
                    neighborhood_key = (neighborhood_name.lower(), city_id)
                    neighborhood_id = neighborhood_cache.get(neighborhood_key)
                    if neighborhood_id is None:
                        neighborhood = get_or_create_neighborhood(db.db, neighborhood_name, city_id)
                        neighborhood_id = neighborhood.id if neighborhood else None
                        if neighborhood_id:
                            neighborhood_cache[neighborhood_key] = neighborhood_id
                db.insert_connection(
                    str(c["id"]), str(c["user"]), str(c["customer_id"]), 
                    str(c["node_id"]), str(c["plan_id"]), c.get("direccion"),
                    city_id=city_id,
                    neighborhood_id=neighborhood_id,
                )
            config.logger.info(f"[SYNC] {len(conexiones)} conexiones sincronizadas.")
            db.log_sync_status("ispcube", "ok", f"{len(conexiones)} conexiones sincronizadas")
            print(f"✅ ({len(conexiones)})")
        else:
            print("⚠️ Vacío")
    except Exception as e:
        print(f"❌ {e}")
        config.logger.error(f"[SYNC] Error Connections: {e}")

def sync_clientes(db):
    print("   ↳ [ISPCube] Bajando Clientes...", end=" ", flush=True)
    try:
        clientes = ispcube.obtener_clientes()
        if clientes:
            # db.cursor.execute("DELETE FROM clientes")
            # db.cursor.execute("DELETE FROM clientes_emails")
            # db.cursor.execute("DELETE FROM clientes_telefonos")
            db.clear_table(models.ClienteEmail)
            db.clear_table(models.ClienteTelefono)
            db.clear_table(models.Cliente)
            
            for c in clientes:
                db.insert_cliente(mapear_cliente(c))
                insertar_contactos_relacionados(db, c)

            db.commit()
            config.logger.info(f"[SYNC] {len(clientes)} clientes sincronizados.")
            db.log_sync_status("ispcube", "ok", f"{len(clientes)} clientes sincronizados")
            print(f"✅ ({len(clientes)})")
        else:
            print("⚠️ Vacío")
    except Exception as e:
        print(f"❌ {e}")

# --- UTILIDADES ---
def insertar_contactos_relacionados(db, json_cliente: dict):
    for email_obj in json_cliente.get("contact_emails", []):
        if email_obj.get("email"):
            db.insert_cliente_email(json_cliente["id"], email_obj.get("email"))
    for tel_obj in json_cliente.get("phones", []):
        if tel_obj.get("number"):
            db.insert_cliente_telefono(json_cliente["id"], tel_obj.get("number"))

def mapear_cliente(json_cliente: dict) -> dict:
    return {
        "id": json_cliente.get("id"),
        "code": json_cliente.get("code"),
        "name": json_cliente.get("name"),
        "tax_residence": json_cliente.get("tax_residence"),
        "type": json_cliente.get("type"),
        "tax_situation_id": json_cliente.get("tax_situation_id"),
        "identification_type_id": json_cliente.get("identification_type_id"),
        "doc_number": json_cliente.get("doc_number"),
        "auto_bill_sending": json_cliente.get("auto_bill_sending"),
        "auto_payment_recipe_sending": json_cliente.get("auto_payment_recipe_sending"),
        "nickname": json_cliente.get("nickname"),
        "comercial_activity": json_cliente.get("comercial_activity"),
        "address": json_cliente.get("address"),
        "between_address1": json_cliente.get("between_address1"),
        "between_address2": json_cliente.get("between_address2"),
        "city_id": json_cliente.get("city_id"),
        "lat": json_cliente.get("lat"),
        "lng": json_cliente.get("lng"),
        "extra1": json_cliente.get("extra1"),
        "extra2": json_cliente.get("extra2"),
        "entity_id": json_cliente.get("entity_id"),
        "collector_id": json_cliente.get("collector_id"),
        "seller_id": json_cliente.get("seller_id"),
        "block": json_cliente.get("block"),
        "free": json_cliente.get("free"),
        "apply_late_payment_due": json_cliente.get("apply_late_payment_due"),
        "apply_reconnection": json_cliente.get("apply_reconnection"),
        "contract": json_cliente.get("contract"),
        "contract_type_id": json_cliente.get("contract_type_id"),
        "contract_expiration_date": json_cliente.get("contract_expiration_date"),
        "paycomm": json_cliente.get("paycomm"),
        "expiration_type_id": json_cliente.get("expiration_type_id"),
        "business_id": json_cliente.get("business_id"),
        "first_expiration_date": json_cliente.get("first_expiration_date"),
        "second_expiration_date": json_cliente.get("second_expiration_date"),
        "next_month_corresponding_date": json_cliente.get("next_month_corresponding_date"),
        "start_date": json_cliente.get("start_date"),
        "perception_id": json_cliente.get("perception_id"),
        "phonekey": json_cliente.get("phonekey"),
        "debt": json_cliente.get("debt"),
        "duedebt": json_cliente.get("duedebt"),
        "speed_limited": json_cliente.get("speed_limited"),
        "status": json_cliente.get("status"),
        "enable_date": json_cliente.get("enable_date"),
        "block_date": json_cliente.get("block_date"),
        "created_at": json_cliente.get("created_at"),
        "updated_at": json_cliente.get("updated_at"),
        "deleted_at": json_cliente.get("deleted_at"),
        "temporary": json_cliente.get("temporary"),
    }

@celery_app.task(name="src.jobs.sync.nightly_sync_task", bind=True)
def nightly_sync_task(self):
    """
    Tarea de sincronización nocturna (Celery Beat).
    
    Ejecuta automáticamente cada día a las 3:00 AM (Argentina).
    Sincroniza datos desde:
    - ISPCube (nodos, planes, conexiones, clientes)
    - Mikrotik (PPP secrets)
    - SmartOLT (ONUs)
    
    El resultado se registra en logs para auditoría.
    """
    import logging
    from datetime import datetime
    
    logger = logging.getLogger("Emerald.SyncJob")
    start_time = datetime.utcnow()
    
    logger.info("=" * 80)
    logger.info("🚀 [SYNC] INICIANDO SINCRONIZACIÓN NOCTURNA")
    logger.info(f"   Timestamp: {start_time.isoformat()}")
    logger.info("=" * 80)
    
    db = None
    sync_stats = {
        "success": False,
        "nodes": 0,
        "secrets": 0,
        "onus": 0,
        "plans": 0,
        "connections": 0,
        "clientes": 0,
        "error": None,
        "duration_seconds": 0
    }
    
    try:
        # Garantiza que la validación/migración del esquema también quede dentro del manejo de errores.
        init_db()
        db = Database()

        logger.info("📦 [1/6] Sincronizando nodos ISPCube...")
        sync_nodes(db)
        sync_stats["nodes"] = db.get_count(models.Node)
        logger.info(f"   ✅ {sync_stats['nodes']} nodos en BD")
        
        logger.info("📦 [2/6] Sincronizando secrets Mikrotik...")
        sync_secrets(db)
        sync_stats["secrets"] = db.get_count(models.PPPSecret)
        logger.info(f"   ✅ {sync_stats['secrets']} secrets en BD")
        
        logger.info("📦 [3/6] Sincronizando ONUs SmartOLT...")
        sync_onus(db)
        sync_stats["onus"] = db.get_count(models.Subscriber)
        logger.info(f"   ✅ {sync_stats['onus']} ONUs en BD")
        
        logger.info("📦 [4/6] Sincronizando planes ISPCube...")
        sync_plans(db)
        sync_stats["plans"] = db.get_count(models.Plan)
        logger.info(f"   ✅ {sync_stats['plans']} planes en BD")
        
        logger.info("📦 [5/6] Sincronizando conexiones ISPCube...")
        sync_connections(db)
        sync_stats["connections"] = db.get_count(models.Connection)
        logger.info(f"   ✅ {sync_stats['connections']} conexiones en BD")
        
        logger.info("📦 [6/6] Sincronizando clientes ISPCube...")
        sync_clientes(db)
        sync_stats["clientes"] = db.get_count(models.Cliente)
        logger.info(f"   ✅ {sync_stats['clientes']} clientes en BD")
        
        logger.info("🔗 Cruzando datos (Match Connections)...")
        db.match_connections()
        db.commit()
        logger.info("   ✅ Match completado")
        
        sync_stats["success"] = True
        logger.info("=" * 80)
        logger.info("✨ [SYNC] SINCRONIZACIÓN COMPLETADA CON ÉXITO")
        logger.info("=" * 80)
        logger.info(f"📊 RESUMEN FINAL:")
        logger.info(f"   • Nodos:       {sync_stats['nodes']}")
        logger.info(f"   • Secrets:     {sync_stats['secrets']}")
        logger.info(f"   • ONUs:        {sync_stats['onus']}")
        logger.info(f"   • Planes:      {sync_stats['plans']}")
        logger.info(f"   • Conexiones:  {sync_stats['connections']}")
        logger.info(f"   • Clientes:    {sync_stats['clientes']}")
        logger.info("=" * 80)
        
        return sync_stats
        
    except Exception as e:
        sync_stats["success"] = False
        sync_stats["error"] = str(e)
        
        logger.error("=" * 80)
        logger.error("❌ [SYNC] ERROR DURANTE SINCRONIZACIÓN")
        logger.error("=" * 80)
        logger.error(f"   Tipo de error: {type(e).__name__}")
        logger.error(f"   Mensaje: {str(e)}")
        logger.error("=" * 80)
        
        # Log de traceback completo para debugging
        import traceback
        logger.error("Traceback completo:")
        logger.error(traceback.format_exc())
        logger.error("=" * 80)
        
        return sync_stats
        
    finally:
        if db is not None:
            db.close()
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        sync_stats["duration_seconds"] = duration
        
        logger.info(f"⏱️  Duración total: {duration:.2f} segundos")
        logger.info(f"📅 Fin: {end_time.isoformat()}")

if __name__ == "__main__":
    try:
        nightly_sync_task()
    except Exception:
        config.logger.exception("[CRITICAL] Fallo catastrófico en el Nightly Sync")