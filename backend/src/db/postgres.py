# backend/src/db/postgres.py
from sqlalchemy import func, text
from src.database import SessionLocal, engine
from src import models
from src.services.location_resolver import (
    resolve_address_data,
    get_or_create_city,
    get_or_create_neighborhood,
)
from datetime import datetime

class Database:
    def __init__(self):
        self.db = SessionLocal()

    def close(self):
        self.db.close()
    
    def commit(self):
        self.db.commit()

    def get_count(self, model_class):
        """Return a fast row count for a mapped model.

        Uses SELECT COUNT(*) on the underlying table instead of loading rows
        into memory, which keeps the nightly sync lightweight.
        """
        return self.db.query(func.count()).select_from(model_class).scalar() or 0

    # --- INSERTS (Replicando sqlite.py) ---
    def insert_subscriber(self, unique_external_id, sn, olt_name, olt_id, board, port, onu, onu_type_id, name, mode, vlan=None):
        # Usamos merge o add. Como ahora tenemos un ID autoincremental, 
        # lo mejor es simplemente AGREGAR (add) una nueva fila siempre.
        # Ya no usamos merge() basándonos en external_id porque hay duplicados.
        
        new_sub = models.Subscriber(
            unique_external_id=unique_external_id,
            sn=sn,
            olt_name=olt_name,
            olt_id=olt_id,
            board=board,
            port=port,
            onu=onu,
            onu_type_id=onu_type_id,
            pppoe_username=name,
            mode=mode,
            vlan=vlan # Asegurate de pasar este dato si viene
        )
        self.db.add(new_sub)
        # No hacemos commit acá, lo hacemos al final del bloque en sync.py para velocidad

    def insert_node(self, node_id, name, ip_address, puerto):
        new_node = models.Node(
            node_id=str(node_id), # Aseguramos String
            name=name,
            ip_address=ip_address, # Nombre corregido
            puerto=str(puerto)
        )
        self.db.merge(new_node)

    def insert_plan(self, plan_id, name, speed, description):
        new_plan = models.Plan(
            plan_id=str(plan_id), # Aseguramos String
            name=name,
            speed=speed,
            description=description
        )
        self.db.merge(new_plan)

    def insert_connection(
        self,
        connection_id,
        pppoe_username,
        customer_id,
        node_id,
        plan_id,
        direccion,
        city_id=None,
        neighborhood_id=None,
    ):
        new_conn = models.Connection(
            connection_id=str(connection_id), # Aseguramos String
            pppoe_username=pppoe_username,
            customer_id=customer_id,
            node_id=str(node_id),
            plan_id=str(plan_id),
            direccion=direccion, # Nombre corregido
            city_id=city_id,
            neighborhood_id=neighborhood_id,
        )
        self.db.merge(new_conn)
    
    def insert_cliente(self, cliente_data: dict):
        # Reemplaza a [cite: 83]
        # Mapeamos manual o usamos unpacking si los campos coinciden exacto
        # Agregamos raw_data para nuestra mejora estratégica
        obj = models.Cliente(
            id=cliente_data.get('id'),
            code=cliente_data.get('code'),
            name=cliente_data.get('name'),
            doc_number=cliente_data.get('doc_number'),
            address=cliente_data.get('address'),
            status=cliente_data.get('status'),
            # ... mapear el resto de columnas necesarias ...
            raw_data=cliente_data 
        )
        self.db.merge(obj)

    def insert_cliente_email(self, customer_id, email):
        # Reemplaza a
        obj = models.ClienteEmail(customer_id=customer_id, email=email)
        self.db.add(obj) # Acá usamos add porque es log append, o merge si tiene ID

    def insert_cliente_telefono(self, customer_id, number):
        # Reemplaza a [cite: 84]
        obj = models.ClienteTelefono(customer_id=customer_id, number=number)
        self.db.add(obj)
    
    def sync_cliente_instalacion(self, customer_data: dict, connections_data: list):
        """
        Sincroniza cliente + conexiones a Postgres durante creación de ticket de instalación.
        Usa insert_cliente() e insert_connection() existentes.
        
        Args:
            customer_data: Dict con datos del cliente desde ISPCube
            connections_data: Lista de conexiones del cliente desde ISPCube
        """
        from src.jobs.sync import mapear_cliente, insertar_contactos_relacionados
        
        try:
            customer_id = customer_data.get("id")
            if not customer_id:
                return
            
            # Sincronizar cliente
            mapped_cliente = mapear_cliente(customer_data)
            existing_cliente = self.db.query(models.Cliente).filter_by(id=customer_id).first()
            
            if existing_cliente:
                # Actualizar datos del cliente existente
                for key, value in mapped_cliente.items():
                    if hasattr(existing_cliente, key):
                        setattr(existing_cliente, key, value)
            else:
                # Insertar nuevo cliente
                self.insert_cliente(mapped_cliente)
            
            # Insertar contactos (emails, teléfonos)
            insertar_contactos_relacionados(self, customer_data)
            
            # Sincronizar conexiones
            if connections_data:
                for conn in connections_data:
                    if not conn.get("id"):
                        continue

                    resolved = resolve_address_data({"connection": conn, "client": customer_data})
                    city = get_or_create_city(self.db, resolved.get("city_name"))
                    neighborhood = get_or_create_neighborhood(
                        self.db,
                        resolved.get("neighborhood_name"),
                        city.id if city else None,
                    )
                    
                    conn_id = str(conn.get("id"))
                    existing_conn = self.db.query(models.Connection).filter_by(connection_id=conn_id).first()
                    
                    if existing_conn:
                        # Actualizar conexión existente
                        existing_conn.pppoe_username = str(conn.get("user") or "")
                        existing_conn.customer_id = customer_id
                        existing_conn.node_id = conn.get("node_id")
                        existing_conn.plan_id = conn.get("plan_id")
                        existing_conn.direccion = conn.get("direccion") or conn.get("address")
                        existing_conn.city_id = city.id if city else None
                        existing_conn.neighborhood_id = neighborhood.id if neighborhood else None
                    else:
                        # Crear nueva conexión
                        self.insert_connection(
                            str(conn.get("id")),
                            str(conn.get("user") or ""),
                            customer_id,
                            conn.get("node_id"),
                            conn.get("plan_id"),
                            conn.get("direccion") or conn.get("address"),
                            city_id=city.id if city else None,
                            neighborhood_id=neighborhood.id if neighborhood else None,
                        )
            
            self.commit()
            
        except Exception as e:
            from src.config import logger
            logger.error(f"Error sincronizando cliente {customer_data.get('id')}: {e}")
            self.db.rollback()

    def insert_secret(self, secret_data: dict, router_ip: str):
        # Reemplaza a
        obj = models.PPPSecret(
            name=secret_data.get("name"),
            router_ip=router_ip,
            password=secret_data.get("password"),
            profile=secret_data.get("profile"),
            service=secret_data.get("service"),
            last_caller_id=secret_data.get("last-caller-id"),
            comment=secret_data.get("comment"),
            last_logged_out=secret_data.get("last-logged-out")
        )
        self.db.merge(obj)

    # --- UTILIDADES DE SYNC ---

    def get_nodes_for_sync(self) -> list:
        # Reemplaza a [cite: 85]
        nodes = self.db.query(models.Node).filter(models.Node.ip_address != None).all()
        return [{
            "ip": n.ip_address, 
            "port": int(n.puerto) if n.puerto and n.puerto.isdigit() else None, 
            "name": n.name
        } for n in nodes]

    def match_connections(self):
        # Reemplaza a [cite: 86]
        # SQLAlchemy puro para UPDATE con JOIN es complejo, usamos SQL explícito para mantener la lógica exacta
        sql = text("""
            UPDATE subscribers
            SET node_id = c.node_id, connection_id = c.connection_id
            FROM connections c
            WHERE subscribers.pppoe_username = c.pppoe_username
        """)
        self.db.execute(sql)
        self.commit()

    def log_sync_status(self, fuente, estado, detalle=""):
        # Reemplaza a [cite: 86]
        log = models.SyncStatus(fuente=fuente, estado=estado, detalle=detalle)
        self.db.add(log)
        self.commit()

    # ------------------ BÚSQUEDA UNIFICADA ------------------
    def search_client(self, query_str: str) -> list:
        """
        Busca clientes unificando ISPCube y Mikrotik.
        Se eliminó SmartOLT (Subscribers) porque si no está en Secrets, no es un servicio activo.
        
        LÓGICA DE EXCLUSIÓN (SQL):
        La query de Mikrotik usa NOT EXISTS para excluir automáticamente 
        los registros que ya tienen un par (Usuario + IP) idéntico en ISPCube.
        """
        term = f"%{query_str}%"
        params = {"term": term}
        
        # 1. ISPCube (Prioridad 1 - Administrativo)
        sql_isp = text("""
            SELECT 
                c.pppoe_username as pppoe, 
                cl.name as nombre, 
                c.direccion as direccion, 
                cl.id as id, 
                'ispcube' as origen,
                n.ip_address as nodo_ip,
                n.name as nodo_nombre
            FROM clientes cl
            JOIN connections c ON cl.id = c.customer_id
            LEFT JOIN nodes n ON c.node_id = n.node_id
            WHERE 
                cl.name ILIKE :term OR 
                c.direccion ILIKE :term OR 
                c.pppoe_username ILIKE :term OR 
                cl.doc_number ILIKE :term
            LIMIT 50
        """)
        
        # 2. Mikrotik (Solo huérfanos o duplicados reales)
        # Excluye lo que ya devolvió la query de arriba (mismo usuario Y misma IP)
        sql_mk = text("""
            SELECT 
                s.name as pppoe, 
                COALESCE(NULLIF(s.comment, ''), 'No Vinculado') as nombre,
                'IP: ' || CAST(s.router_ip AS VARCHAR) as direccion,
                0 as id, 
                'mikrotik' as origen,
                s.router_ip as nodo_ip,
                'Router ' || COALESCE(s.router_ip, '?') as nodo_nombre
            FROM ppp_secrets s
            WHERE s.name ILIKE :term
            AND NOT EXISTS (
                SELECT 1 
                FROM connections c
                JOIN nodes n ON c.node_id = n.node_id
                WHERE c.pppoe_username = s.name 
                  AND n.ip_address = s.router_ip
            )
            LIMIT 50
        """)

        try:
            # Ejecución
            result_isp = self.db.execute(sql_isp, params).fetchall()
            rows_isp = [dict(row._mapping) for row in result_isp]
            
            result_mk = self.db.execute(sql_mk, params).fetchall()
            rows_mk = [dict(row._mapping) for row in result_mk]
            
            return rows_isp + rows_mk

        except Exception as e:
            print(f"❌ Error en search_client: {e}")
            return []

    # --- CONSULTAS (MAIN.PY / DIAGNOSTICO.PY) ---

    def get_diagnosis(self, pppoe_user: str, target_router_ip: str = None) -> dict:
        """
        Versión: SQL Power Query (La Definitiva) 🚀
        Unifica toda la lógica de prioridades y cruces en una sola consulta SQL.
        """
        
        # Preparamos la cláusula de IP. 
        # Si viene IP, filtramos estricto. Si no, simplemente traemos el primero disponible.
        ip_clause = "AND s.router_ip = :ip" if target_router_ip else ""
        order_clause = "ORDER BY (CASE WHEN c.connection_id IS NOT NULL THEN 0 ELSE 1 END), s.router_ip LIMIT 1" if not target_router_ip else ""

        # Query Maestra
        sql_query = text(f"""
            SELECT 
                -- 1. IDENTIDAD
                COALESCE(cl.name, NULLIF(s.comment, ''), 'No Vinculado') as cliente_nombre,
                s.name as pppoe_username,
                
                -- 2. UBICACIÓN (Corregido 'address')
                COALESCE(NULLIF(c.direccion, ''), NULLIF(cl.address, ''), 'Sin dirección') as direccion,
                
                -- 3. PLAN
                COALESCE(pl.name, s.profile, 'N/A') as plan,
                
                -- 4. DATOS TÉCNICOS
                n.name as nodo_nombre,
                s.router_ip as nodo_ip,
                n.puerto as puerto,
                s.last_caller_id as mac,
                s.last_logged_out,  -- Agregado para el Frontend
                
                -- 5. DATOS ONT (SmartOLT)
                sub.sn as onu_sn,
                sub.olt_name as OLT,
                sub.mode as Modo,
                sub.unique_external_id
                
                -- 6. STATUS (Intentamos pegar status si existe tabla ppp_active o similar, sino N/A)
                -- (Aquí asumimos que la validación de 'Online' la hace el servicio o viene de otro lado,
                --  pero traemos lo básico del secret).
                --s.disabled as is_disabled

            FROM ppp_secrets s

            -- A. Nodo
            LEFT JOIN nodes n ON s.router_ip = n.ip_address

            -- B. Conexión Administrativa (Match Estricto: User + Nodo)
            LEFT JOIN connections c ON s.name = c.pppoe_username AND n.node_id = c.node_id

            -- C. Cliente y Plan
            LEFT JOIN clientes cl ON c.customer_id = cl.id
            LEFT JOIN plans pl ON c.plan_id = pl.plan_id

            -- D. SmartOLT
            LEFT JOIN subscribers sub ON s.name = sub.pppoe_username

            WHERE s.name = :pppoe_user
            {ip_clause}
            {order_clause}
        """)

        try:
            params = {"pppoe_user": pppoe_user}
            if target_router_ip:
                params["ip"] = target_router_ip

            result = self.db.execute(sql_query, params).fetchone()

            # Fallback: si no hay secret PPPoE, intentamos por tabla connections
            if not result:
                fallback_sql = text(
                    """
                    SELECT 
                        COALESCE(cl.name, 'No Vinculado') as cliente_nombre,
                        c.pppoe_username as pppoe_username,
                        COALESCE(NULLIF(c.direccion, ''), NULLIF(cl.address, ''), 'Sin dirección') as direccion,
                        COALESCE(pl.name, 'N/A') as plan,
                        n.name as nodo_nombre,
                        n.ip_address as nodo_ip,
                        n.puerto as puerto,
                        sub.sn as onu_sn,
                        sub.olt_name as OLT,
                        sub.mode as Modo,
                        sub.unique_external_id
                    FROM connections c
                    LEFT JOIN clientes cl ON c.customer_id = cl.id
                    LEFT JOIN plans pl ON c.plan_id = pl.plan_id
                    LEFT JOIN nodes n ON c.node_id = n.node_id
                    LEFT JOIN subscribers sub ON c.pppoe_username = sub.pppoe_username
                    WHERE c.pppoe_username = :pppoe_user
                    LIMIT 1
                    """
                )
                result = self.db.execute(fallback_sql, {"pppoe_user": pppoe_user}).fetchone()

                if not result:
                    return {"error": f"Cliente {pppoe_user} no encontrado."}

            # Convertimos el resultado (Row) a Diccionario
            row = dict(result._mapping)

            # --- MAPEO PARA FRONTEND ---
            # El OutputBox espera objetos anidados, así que reconstruimos esa estructura aquí.
            
            diagnosis = {
                "cliente_nombre": row["cliente_nombre"],
                "direccion": row["direccion"],
                "plan": row["plan"],
                "pppoe_username": row["pppoe_username"],
                "nodo_nombre": row["nodo_nombre"] if row["nodo_nombre"] else f"Router {row['nodo_ip']}",
                "nodo_ip": row["nodo_ip"],
                "puerto": row["puerto"],
                
                # Datos de OLT planos en la raíz (OutputBox los busca ahí)
                "OLT": row.get("olt"),
                "onu_sn": row.get("onu_sn"),
                "unique_external_id": row.get("unique_external_id"),
                "Modo": row.get("modo"),

                # Objeto Mikrotik (Necesario para que no se rompa OutputBox)
                "mikrotik": {
                    # Si venimos del fallback, no tenemos secret; marcamos offline pero útil para UI
                    "active": False if row.get("last_logged_out") is None else "Online",
                    "uptime": "N/A",
                    "secret": {
                        "last-logged-out": row.get("last_logged_out"),
                        "remote-address": row.get("nodo_ip"),
                    },
                },

                # Objetos ONU (Placeholders para que no rompa si el servicio no los llena después)
                "onu_status_smrt": {
                    "onu_status": "N/A",
                    "last_status_change": "N/A"
                },
                "onu_signal_smrt": {
                    "onu_signal": "N/A",
                    "onu_signal_value": "N/A"
                }
            }
            
            return diagnosis

        except Exception as e:
            print(f"❌ Error en SQL Power Query: {e}")
            return {"error": str(e)}

    def get_router_for_pppoe(self, pppoe_user: str):
        # Reemplaza a [cite: 96]
        result = (
            self.db.query(models.PPPSecret.router_ip, models.Node.puerto)
            .outerjoin(models.Node, models.PPPSecret.router_ip == models.Node.ip_address)
            .filter(func.lower(func.trim(models.PPPSecret.name)) == pppoe_user.strip().lower())
            .first()
        )
        if result:
            return result.router_ip, result.puerto
        return None
    
    # En backend/src/db/postgres.py

    # ... otros métodos ...

    def clear_table(self, model_class):
        """
        Borra todo el contenido de la tabla asociada al modelo.
        Equivalente a DELETE FROM tabla;
        """
        try:
            self.db.query(model_class).delete()
            self.commit()
        except Exception as e:
            self.db.rollback()
            print(f"❌ Error limpiando tabla {model_class.__tablename__}: {e}")
    
    def rollback(self):
        """Deshace la transacción actual en caso de error para no bloquear la DB."""
        self.db.rollback()

    def init_db(self):
        # Reemplaza a [cite: 110]
        # Crea las tablas si no existen
        # Ejecuta migraciones Alembic para asegurar el esquema
        from alembic import command as alembic_command
        from alembic.config import Config as AlembicConfig
        import os
        from src import config as app_config

        here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # carpeta backend
        alembic_ini = os.path.join(here, "alembic.ini")
        alembic_dir = os.path.join(here, "alembic")

        cfg = AlembicConfig(alembic_ini)
        cfg.set_main_option("script_location", alembic_dir)
        cfg.set_main_option("sqlalchemy.url", app_config.SQLALCHEMY_DATABASE_URL)

        alembic_command.upgrade(cfg, "head")

# Helper para compatibilidad
def init_db():
    # Ejecuta migraciones Alembic para asegurar el esquema
    from alembic import command as alembic_command
    from alembic.config import Config as AlembicConfig
    import os
    from src import config as app_config

    here = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # carpeta backend
    alembic_ini = os.path.join(here, "alembic.ini")
    alembic_dir = os.path.join(here, "alembic")

    cfg = AlembicConfig(alembic_ini)
    cfg.set_main_option("script_location", alembic_dir)
    cfg.set_main_option("sqlalchemy.url", app_config.SQLALCHEMY_DATABASE_URL)

    alembic_command.upgrade(cfg, "head")