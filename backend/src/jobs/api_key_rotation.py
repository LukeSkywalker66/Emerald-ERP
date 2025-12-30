"""
Tasks de Celery para automatizar validación, rotación y limpieza de API Keys.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from src.celery_app import celery_app
from src.database import SessionLocal
from src.services.api_key_service import APIKeyService
from src import models

logger = logging.getLogger("Emerald.APIKeyJobs")


@celery_app.task(name="api_keys.cleanup_expired", bind=True)
def cleanup_expired_api_keys(self):
    """
    Limpiar API Keys expiradas (marcar como inactivas).
    Ejecutar: Diariamente a las 3:00 AM
    
    Schedule:
        'api_keys.cleanup_expired': {
            'task': 'api_keys.cleanup_expired',
            'schedule': crontab(hour=3, minute=0),
        }
    """
    logger.info("🧹 Iniciando limpieza de API Keys expiradas...")
    
    db = SessionLocal()
    try:
        count = asyncio.run(APIKeyService.cleanup_expired_keys(db))
        logger.info(f"✅ Limpieza completada: {count} keys expiradas")
        return {"success": True, "cleaned": count}
    except Exception as e:
        logger.error(f"❌ Error en limpieza de API Keys: {e}")
        return {"success": False, "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="api_keys.rotate_expiring", bind=True)
def rotate_expiring_api_keys(self):
    """
    Rotar automáticamente API Keys que expirarán en 7 días.
    Ejecutar: Cada día a las 2:00 AM
    
    IMPORTANTE: Los admins deben notificarse para actualizar .env
    
    Schedule:
        'api_keys.rotate_expiring': {
            'task': 'api_keys.rotate_expiring',
            'schedule': crontab(hour=2, minute=0),
        }
    """
    logger.info("🔄 Iniciando rotación automática de API Keys...")
    
    db = SessionLocal()
    try:
        # Keys que expirarán en menos de 7 días
        warning_date = datetime.utcnow() + timedelta(days=7)
        
        keys_to_rotate = db.query(models.APIKey).filter(
            models.APIKey.expires_at < warning_date,
            models.APIKey.expires_at > datetime.utcnow(),
            models.APIKey.active == 1,
            ~models.APIKey.name.like("% (rotated%)")  # Evitar duplicados
        ).all()
        
        rotated_count = 0
        new_keys = []
        
        for key in keys_to_rotate:
            try:
                # Rotar la key
                new_key_data = asyncio.run(APIKeyService.rotate_api_key(db, key.id))
                rotated_count += 1
                
                new_keys.append({
                    "old_name": key.name,
                    "new_key": new_key_data["key"],
                    "prefix": new_key_data["prefix"],
                    "expires_at": new_key_data["expires_at"]
                })
                
                logger.info(f"🔄 Auto-rotada: {key.name}")
                
                # TODO: Aquí iría el envío de email al admin
                # send_email_notification(
                #     to="admin@emerald.com",
                #     subject=f"[ROTACIÓN AUTOMÁTICA] API Key: {key.name}",
                #     body=f"""
                #     Timestamp: {datetime.utcnow().isoformat()}
                #     Key rotada automáticamente (vencimiento próximo)
                #     
                #     Key antigua: {key.name}
                #     Key nueva: {new_key_data['key']}
                #     Prefijo: {new_key_data['prefix']}
                #     Expira: {new_key_data['expires_at']}
                #     
                #     ⚠️ ACCIÓN REQUERIDA:
                #     1. Copia la nueva key
                #     2. Actualiza tu .env o variables de ambiente
                #     3. Redeploy de la aplicación
                #     """
                # )
                
            except Exception as e:
                logger.error(f"❌ Error rotando {key.name}: {e}")
        
        logger.info(f"✅ Rotación completada: {rotated_count} keys")
        
        return {
            "success": True,
            "rotated": rotated_count,
            "new_keys": new_keys
        }
        
    except Exception as e:
        logger.error(f"❌ Error en rotación automática: {e}")
        return {"success": False, "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="api_keys.alert_expiring", bind=True)
def alert_expiring_api_keys(self, days_before: int = 30):
    """
    Alertar sobre API Keys que expirarán pronto.
    Ejecutar: Cada 3 días a las 1:00 AM
    
    Schedule:
        'api_keys.alert_expiring': {
            'task': 'api_keys.alert_expiring',
            'schedule': crontab(hour=1, minute=0, day_of_week='0,3,6'),  # Cada 3 días
            'kwargs': {'days_before': 30}
        }
    """
    logger.info(f"⚠️ Verificando API Keys que expiran en {days_before} días...")
    
    db = SessionLocal()
    try:
        expiring_keys = asyncio.run(APIKeyService.alert_expiring_keys(db, days_before))
        
        if expiring_keys:
            logger.warning(f"⚠️ {len(expiring_keys)} API Keys expiran pronto:")
            for key in expiring_keys:
                logger.warning(
                    f"   - {key['name']} ({key['prefix']}...): "
                    f"{key['days_left']} días restantes"
                )
            
            # TODO: Enviar email al admin con el resumen
            # send_expiring_keys_notification(expiring_keys)
        else:
            logger.info("✅ No hay API Keys próximas a expirar")
        
        return {
            "success": True,
            "expiring_count": len(expiring_keys),
            "keys": expiring_keys
        }
        
    except Exception as e:
        logger.error(f"❌ Error en alerta de expiración: {e}")
        return {"success": False, "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="api_keys.generate_audit_report", bind=True)
def generate_api_keys_audit_report(self):
    """
    Generar reporte de auditoría de todas las API Keys.
    Ejecutar: Semanalmente (Domingo a las 4:00 AM)
    
    Schedule:
        'api_keys.generate_audit_report': {
            'task': 'api_keys.generate_audit_report',
            'schedule': crontab(hour=4, minute=0, day_of_week=0),
        }
    """
    logger.info("📊 Generando reporte de auditoría de API Keys...")
    
    db = SessionLocal()
    try:
        # Obtener estadísticas
        total_keys = db.query(models.APIKey).count()
        active_keys = db.query(models.APIKey).filter(
            models.APIKey.active == 1
        ).count()
        inactive_keys = total_keys - active_keys
        
        # Keys próximas a expirar (7 días)
        warning_date = datetime.utcnow() + timedelta(days=7)
        expiring_soon = db.query(models.APIKey).filter(
            models.APIKey.expires_at < warning_date,
            models.APIKey.expires_at > datetime.utcnow(),
            models.APIKey.active == 1
        ).count()
        
        # Audit log reciente (últimas 24 horas)
        since = datetime.utcnow() - timedelta(hours=24)
        recent_audit = db.query(models.APIKeyAudit).filter(
            models.APIKeyAudit.timestamp > since
        ).count()
        
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_api_keys": total_keys,
            "active_keys": active_keys,
            "inactive_keys": inactive_keys,
            "expiring_soon": expiring_soon,
            "audit_events_24h": recent_audit
        }
        
        logger.info(f"📊 Reporte de API Keys: {report}")
        
        # TODO: Guardar reporte en BD o enviar al admin
        # save_audit_report(report)
        
        return {"success": True, "report": report}
        
    except Exception as e:
        logger.error(f"❌ Error generando reporte: {e}")
        return {"success": False, "error": str(e)}
    finally:
        db.close()
