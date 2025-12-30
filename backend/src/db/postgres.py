# backend/src/db/postgres.py
from sqlalchemy import text
from src.database import SessionLocal, engine
from src import models
from datetime import datetime

class Database:
    def __init__(self):
        self.db = SessionLocal()

    def close(self):
        self.db.close()
    
    def commit(self):
        self.db.commit()

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

    def insert_connection(self, connection_id, pppoe_username, customer_id, node_id, plan_id, direccion):
        new_conn = models.Connection(
            connection_id=str(connection_id), # Aseguramos String
            pppoe_username=pppoe_username,
            customer_id=customer_id,
            node_id=str(node_id),
            plan_id=str(plan_id),
            direccion=direccion # Nombre corregido
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
                "OLT": row.get("olt"),  # PostgreSQL convierte alias a minúsculas
                "onu_sn": row.get("onu_sn"),
                "unique_external_id": row.get("unique_external_id"),
                "Modo": row.get("modo"),  # PostgreSQL convierte alias a minúsculas

                # Objeto Mikrotik (Necesario para que no se rompa OutputBox)
                "mikrotik": {
                    "active": "Online" if not row.get("is_disabled") else "Disabled", # Simplificación, idealmente cruzar con ppp_active
                    "uptime": "N/A", # La query de secrets no tiene uptime, eso está en ppp_active
                    "secret": {
                        "last-logged-out": row["last_logged_out"],
                        "remote-address": row["nodo_ip"]
                    }
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