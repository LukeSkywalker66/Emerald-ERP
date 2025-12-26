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
        Busca clientes en ISPCube, Mikrotik y SmartOLT.
        Prioriza ISPCube y filtra duplicados de las otras fuentes.
        Adaptado para PostgreSQL (usa ILIKE).
        """
        term = f"%{query_str}%"
        params = {"term": term}
        
        # 1. ISPCube (La fuente de verdad)
        # Usamos ILIKE para búsqueda insensible a mayúsculas/minúsculas
        sql_isp = text("""
            SELECT 
                c.pppoe_username as pppoe, 
                cl.name as nombre, 
                c.direccion as direccion, 
                cl.id as id, 
                'ispcube' as origen
            FROM clientes cl
            JOIN connections c ON cl.id = c.customer_id
            WHERE 
                cl.name ILIKE :term OR 
                c.direccion ILIKE :term OR 
                c.pppoe_username ILIKE :term OR 
                cl.doc_number ILIKE :term
            LIMIT 50
        """)
        
        # 2. Mikrotik (Datos técnicos crudos)
        sql_mk = text("""
            SELECT 
                name as pppoe, 
                'No Vinculado' as nombre, 
                CASE WHEN comment IS NOT NULL AND comment != '' THEN 'MK: ' || comment ELSE 'Sin Datos' END as direccion,
                0 as id, 
                'mikrotik' as origen
            FROM ppp_secrets
            WHERE name ILIKE :term OR last_caller_id ILIKE :term
            LIMIT 50
        """)

        # 3. SmartOLT
        sql_olt = text("""
            SELECT 
                pppoe_username as pppoe, 
                'No Vinculado' as nombre, 
                'OLT SN: ' || sn as direccion,
                0 as id, 
                'smartolt' as origen
            FROM subscribers
            WHERE pppoe_username ILIKE :term OR sn ILIKE :term
            LIMIT 50
        """)
        
        try:
            # Ejecución 1: ISPCube
            result_isp = self.db.execute(sql_isp, params).fetchall()
            # Convertimos filas de SQLAlchemy a diccionarios
            rows_isp = [dict(row._mapping) for row in result_isp]
            
            # Guardamos los PPPoEs encontrados para no repetirlos
            pppoes_encontrados = set(r['pppoe'] for r in rows_isp if r['pppoe'])
            
            # Ejecución 2: Mikrotik
            result_mk = self.db.execute(sql_mk, params).fetchall()
            rows_mk = [dict(row._mapping) for row in result_mk]
            
            # Filtramos: Solo agregamos si NO está ya en la lista de ISPCube
            clean_mk = [r for r in rows_mk if r['pppoe'] not in pppoes_encontrados]
            
            # Ejecución 3: SmartOLT
            result_olt = self.db.execute(sql_olt, params).fetchall()
            rows_olt = [dict(row._mapping) for row in result_olt]
            
            # Filtramos: Solo agregamos si NO está ya en la lista
            clean_olt = [r for r in rows_olt if r['pppoe'] not in pppoes_encontrados]

            return rows_isp + clean_mk + clean_olt

        except Exception as e:
            print(f"❌ Error en search_client: {e}")
            return []
        
    # --- CONSULTAS (MAIN.PY / DIAGNOSTICO.PY) ---

    def get_diagnosis(self, pppoe_user: str) -> dict:
        # Reemplaza la lógica de [cite: 100-108] pero usando ORM Join
        # Hacemos el query uniendo tablas
        result = (
            self.db.query(
                models.Connection, 
                models.Cliente, 
                models.Subscriber, 
                models.Node, 
                models.Plan
            )
            .join(models.Cliente, models.Connection.customer_id == models.Cliente.id)
            .outerjoin(models.Subscriber, models.Connection.pppoe_username == models.Subscriber.pppoe_username)
            .outerjoin(models.Node, models.Connection.node_id == models.Node.node_id)
            .outerjoin(models.Plan, models.Connection.plan_id == models.Plan.plan_id)
            .filter(models.Connection.pppoe_username == pppoe_user)
            .first()
        )

        # Mapeo de respuesta idéntico al original para que el frontend no se rompa
        if not result:
            # Fallback a suscriptor suelto [cite: 106]
            sub = self.db.query(models.Subscriber).filter(models.Subscriber.pppoe_username == pppoe_user).first()
            if not sub:
                return {"error": f"Cliente {pppoe_user} no encontrado."}
            
            return {
                "cliente_nombre": "No Vinculado", "direccion": "N/A", "plan": "N/A",
                "pppoe_username": pppoe_user, "onu_sn": sub.sn, "Modo": sub.mode,
                "OLT": sub.olt_name, "nodo_nombre": "Desconocido", "nodo_ip": None,
                "puerto": None, "unique_external_id": sub.unique_external_id
            }

        conn, cliente, sub, node, plan = result

        diagnosis = {
            "unique_external_id": sub.unique_external_id if sub else None,
            "pppoe_username": conn.pppoe_username,
            "onu_sn": sub.sn if sub else None,
            "Modo": sub.mode if sub else None,
            "OLT": sub.olt_name if sub else None,
            "nodo_nombre": node.name if node else None,
            "nodo_ip": node.ip_address if node else None,
            "puerto": node.puerto if node else None,
            "plan": plan.name if plan else None,
            "direccion": conn.direccion,
            "cliente_nombre": cliente.name
        }
        
        # Agregamos lógica de router IP real (Secrets) [cite: 102]
        secret = self.db.query(models.PPPSecret).filter(models.PPPSecret.name == pppoe_user).first()
        if secret:
            diagnosis['mac'] = secret.last_caller_id
            if secret.router_ip and secret.router_ip != diagnosis['nodo_ip']:
                real_node = self.db.query(models.Node).filter(models.Node.ip_address == secret.router_ip).first()
                if real_node:
                    diagnosis.update({"nodo_nombre": real_node.name, "nodo_ip": real_node.ip_address, "puerto": real_node.puerto})
                else:
                    diagnosis.update({"nodo_nombre": f"Router {secret.router_ip}", "nodo_ip": secret.router_ip})

        return diagnosis

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

    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # carpeta backend
    alembic_ini = os.path.join(here, "alembic.ini")
    alembic_dir = os.path.join(here, "alembic")

    cfg = AlembicConfig(alembic_ini)
    cfg.set_main_option("script_location", alembic_dir)
    cfg.set_main_option("sqlalchemy.url", app_config.SQLALCHEMY_DATABASE_URL)

    alembic_command.upgrade(cfg, "head")