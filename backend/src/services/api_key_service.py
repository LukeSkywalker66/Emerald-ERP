"""
Servicio para gestionar API Keys con validación, rotación y auditoría.
"""

import logging
import secrets
from datetime import datetime, timedelta
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from src import models

logger = logging.getLogger("Emerald.APIKeyService")

# Configuración de hash seguro
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class APIKeyService:
    """Servicio para manejar API Keys de forma segura"""
    
    @staticmethod
    def generate_key() -> str:
        """
        Generar API Key segura con prefijo identificador.
        Formato: iso_<32 caracteres random>
        
        Returns:
            str: API Key generada
        """
        random_suffix = secrets.token_urlsafe(32)
        return f"iso_{random_suffix}"
    
    @staticmethod
    def hash_key(key: str) -> str:
        """
        Hash de la API Key para almacenar en BD (bcrypt).
        
        Args:
            key: API Key en texto plano
            
        Returns:
            str: Hash bcrypt de la key
        """
        return pwd_context.hash(key)
    
    @staticmethod
    def verify_key(plain_key: str, hashed_key: str) -> bool:
        """
        Verificar que una key en texto plano coincide con su hash.
        
        Args:
            plain_key: API Key en texto plano
            hashed_key: Hash bcrypt almacenado en BD
            
        Returns:
            bool: True si coinciden, False en caso contrario
        """
        try:
            return pwd_context.verify(plain_key, hashed_key)
        except Exception as e:
            logger.error(f"Error verificando key: {e}")
            return False
    
    @staticmethod
    async def create_api_key(
        db: Session,
        name: str,
        scopes: list = None,
        expires_in_days: int = 90,
        created_by: str = "system"
    ) -> dict:
        """
        Crear una nueva API Key.
        
        ⚠️ IMPORTANTE: Solo retorna la key SIN HASH una vez.
        El usuario debe guardarla inmediatamente.
        
        Args:
            db: Sesión de base de datos
            name: Nombre descriptivo de la key
            scopes: Permisos ["read", "write"], default ["read"]
            expires_in_days: Días hasta expiración, default 90
            created_by: Quién creó la key
            
        Returns:
            dict: {id, name, key, prefix, expires_at, scopes}
        """
        if scopes is None:
            scopes = ["read"]
        
        # Generar key y hash
        key = APIKeyService.generate_key()
        key_hash = APIKeyService.hash_key(key)
        key_prefix = key[:10]
        
        # Calcular fecha de expiración
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        # Crear registro en BD
        db_key = models.APIKey(
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            expires_at=expires_at,
            scopes=scopes,
            created_by=created_by,
            active=1
        )
        db.add(db_key)
        db.commit()
        db.refresh(db_key)
        
        # Registrar auditoría
        audit_entry = models.APIKeyAudit(
            api_key_id=db_key.id,
            action="created",
            details={"created_by": created_by, "scopes": scopes}
        )
        db.add(audit_entry)
        db.commit()
        
        logger.info(f"✅ API Key creada: {key_prefix}... - {name}")
        
        # Retornar SOLO una vez la key sin hash
        return {
            "id": db_key.id,
            "name": db_key.name,
            "key": key,  # ⚠️ Solo esta vez
            "prefix": key_prefix,
            "expires_at": db_key.expires_at.isoformat(),
            "scopes": db_key.scopes,
            "warning": "⚠️ Copia esta key ahora. No se mostrará de nuevo."
        }
    
    @staticmethod
    async def validate_api_key(db: Session, key: str, ip_address: str = None) -> dict:
        """
        Validar una API Key (verificar que sea válida y no expirada).
        
        Args:
            db: Sesión de base de datos
            key: API Key en texto plano (con prefijo iso_)
            ip_address: IP del cliente (opcional, para auditoría)
            
        Returns:
            dict: {id, name, scopes, expires_at} si es válida, None si no
        """
        try:
            # Validar formato básico
            if not key or not key.startswith("iso_"):
                logger.warning(f"⚠️ API Key con formato inválido: {key[:10] if key else 'None'}...")
                return None
            
            # Buscar por prefix (más rápido)
            prefix = key[:10]
            db_key = db.query(models.APIKey).filter(
                models.APIKey.key_prefix == prefix,
                models.APIKey.active == 1
            ).first()
            
            if not db_key:
                logger.warning(f"⚠️ API Key no encontrada: {prefix}...")
                # Registrar intento fallido
                audit_entry = models.APIKeyAudit(
                    action="invalid_key",
                    ip_address=ip_address,
                    details={"prefix": prefix, "reason": "not_found"}
                )
                db.add(audit_entry)
                db.commit()
                return None
            
            # Verificar hash
            if not APIKeyService.verify_key(key, db_key.key_hash):
                logger.warning(f"⚠️ API Key inválida (hash mismatch): {prefix}...")
                # Registrar intento fallido
                audit_entry = models.APIKeyAudit(
                    api_key_id=db_key.id,
                    action="invalid_key",
                    ip_address=ip_address,
                    details={"reason": "hash_mismatch"}
                )
                db.add(audit_entry)
                db.commit()
                return None
            
            # Verificar expiración
            if db_key.expires_at and datetime.utcnow() > db_key.expires_at:
                logger.warning(f"⚠️ API Key expirada: {prefix}...")
                # Marcar como inactiva
                db_key.active = 0
                db.commit()
                
                # Registrar
                audit_entry = models.APIKeyAudit(
                    api_key_id=db_key.id,
                    action="expired",
                    ip_address=ip_address
                )
                db.add(audit_entry)
                db.commit()
                return None
            
            # Actualizar último uso
            db_key.last_used = datetime.utcnow()
            db.commit()
            
            logger.debug(f"✅ API Key validada: {prefix}... ({db_key.name})")
            
            # Registrar uso exitoso
            audit_entry = models.APIKeyAudit(
                api_key_id=db_key.id,
                action="used",
                ip_address=ip_address
            )
            db.add(audit_entry)
            db.commit()
            
            return {
                "id": db_key.id,
                "name": db_key.name,
                "scopes": db_key.scopes,
                "expires_at": db_key.expires_at.isoformat() if db_key.expires_at else None
            }
            
        except Exception as e:
            logger.error(f"Error validando API Key: {e}")
            return None
    
    @staticmethod
    async def rotate_api_key(
        db: Session,
        old_key_id: int,
        expires_in_days: int = 90
    ) -> dict:
        """
        Rotar una API Key (crear nueva, marcar vieja como inactiva).
        
        Args:
            db: Sesión de base de datos
            old_key_id: ID de la key a rotar
            expires_in_days: Días para expiración de nueva key
            
        Returns:
            dict: Datos de la nueva key generada
        """
        old_key = db.query(models.APIKey).filter(
            models.APIKey.id == old_key_id
        ).first()
        
        if not old_key:
            logger.error(f"❌ API Key no encontrada para rotar: {old_key_id}")
            raise ValueError(f"API Key {old_key_id} no existe")
        
        # Crear nueva key con mismos permisos
        new_key_data = await APIKeyService.create_api_key(
            db=db,
            name=f"{old_key.name} (rotated-{datetime.utcnow().strftime('%Y%m%d')})",
            scopes=old_key.scopes,
            expires_in_days=expires_in_days,
            created_by="system"
        )
        
        # Marcar vieja como inactiva
        old_key.active = 0
        old_key.last_rotated_at = datetime.utcnow()
        old_key.rotation_count += 1
        db.commit()
        
        # Registrar rotación
        audit_entry = models.APIKeyAudit(
            api_key_id=old_key.id,
            action="rotated",
            details={"new_key_id": new_key_data["id"], "rotation_count": old_key.rotation_count}
        )
        db.add(audit_entry)
        db.commit()
        
        logger.info(f"🔄 API Key rotada: {old_key.name} - Rotación #{old_key.rotation_count}")
        
        return new_key_data
    
    @staticmethod
    async def cleanup_expired_keys(db: Session) -> int:
        """
        Marcar como inactivas las keys expiradas.
        Se ejecuta con Celery cada día.
        
        Args:
            db: Sesión de base de datos
            
        Returns:
            int: Cantidad de keys marcadas como inactivas
        """
        expired = db.query(models.APIKey).filter(
            models.APIKey.expires_at < datetime.utcnow(),
            models.APIKey.active == 1
        ).all()
        
        count = len(expired)
        for key in expired:
            key.active = 0
            
            # Registrar
            audit_entry = models.APIKeyAudit(
                api_key_id=key.id,
                action="expired",
                details={"expired_at": key.expires_at.isoformat()}
            )
            db.add(audit_entry)
            
            logger.info(f"🗑️ API Key marcada como inactiva: {key.key_prefix}... ({key.name})")
        
        db.commit()
        logger.info(f"✅ Limpieza completada: {count} keys expiradas marcadas como inactivas")
        return count
    
    @staticmethod
    async def alert_expiring_keys(db: Session, days_before: int = 30) -> list:
        """
        Obtener keys que expiran pronto.
        Se ejecuta con Celery para alertas.
        
        Args:
            db: Sesión de base de datos
            days_before: Alertar keys que expiran en N días
            
        Returns:
            list: Lista de keys por expirar
        """
        alert_date = datetime.utcnow() + timedelta(days=days_before)
        
        keys = db.query(models.APIKey).filter(
            models.APIKey.expires_at < alert_date,
            models.APIKey.expires_at > datetime.utcnow(),
            models.APIKey.active == 1
        ).all()
        
        expiring_keys = []
        for key in keys:
            days_left = (key.expires_at - datetime.utcnow()).days
            logger.warning(
                f"⚠️ API Key expira en {days_left} días: {key.name} ({key.key_prefix}...)"
            )
            expiring_keys.append({
                "id": key.id,
                "name": key.name,
                "prefix": key.key_prefix,
                "days_left": days_left,
                "expires_at": key.expires_at.isoformat()
            })
        
        return expiring_keys
    
    @staticmethod
    async def revoke_api_key(db: Session, key_id: int) -> bool:
        """
        Revocar una API Key (desactivarla permanentemente).
        
        Args:
            db: Sesión de base de datos
            key_id: ID de la key a revocar
            
        Returns:
            bool: True si fue exitoso
        """
        db_key = db.query(models.APIKey).filter(
            models.APIKey.id == key_id
        ).first()
        
        if not db_key:
            logger.error(f"❌ API Key no encontrada para revocar: {key_id}")
            return False
        
        db_key.active = 0
        db.commit()
        
        # Registrar revocación
        audit_entry = models.APIKeyAudit(
            api_key_id=db_key.id,
            action="revoked"
        )
        db.add(audit_entry)
        db.commit()
        
        logger.warning(f"🔴 API Key revocada: {db_key.name} ({db_key.key_prefix}...)")
        
        return True
    
    @staticmethod
    def get_audit_log(db: Session, key_id: int = None, limit: int = 100) -> list:
        """
        Obtener log de auditoría de una key o todas las keys.
        
        Args:
            db: Sesión de base de datos
            key_id: ID de key específica (None = todas)
            limit: Límite de registros a retornar
            
        Returns:
            list: Registros de auditoría
        """
        query = db.query(models.APIKeyAudit)
        
        if key_id:
            query = query.filter(models.APIKeyAudit.api_key_id == key_id)
        
        results = query.order_by(
            models.APIKeyAudit.timestamp.desc()
        ).limit(limit).all()
        
        return [
            {
                "timestamp": r.timestamp.isoformat(),
                "api_key_id": r.api_key_id,
                "action": r.action,
                "ip_address": r.ip_address,
                "endpoint": r.endpoint,
                "status_code": r.status_code,
                "details": r.details
            }
            for r in results
        ]
