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
            name=name,
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
        models.Base.metadata.create_all(bind=engine)

# Helper para compatibilidad
def init_db():
    models.Base.metadata.create_all(bind=engine)