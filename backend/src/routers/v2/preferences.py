"""
Router de preferencias de usuario (memoria de vistas por módulo/grilla).

GET  /api/v2/me/preferences/{module_key}  → payload guardado (404 si no hay)
PUT  /api/v2/me/preferences/{module_key}  → upsert del payload (dict) versionado

El payload es un JSON libre por módulo (filtros, orden, paginación). Se valida
que sea un objeto JSON y que schema_version sea un entero >= 1.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.security import get_current_user
from src.models.user import User, UserPreference
from src.schemas.user_schemas import UserPreferenceUpsert, UserPreferenceResponse

router = APIRouter(prefix="/me/preferences", tags=["User Preferences"])

MAX_MODULE_KEY_LENGTH = 100


def _validate_module_key(module_key: str) -> str:
    """Normaliza y valida la clave de módulo."""
    key = (module_key or "").strip()
    if not key:
        raise HTTPException(status_code=422, detail="module_key es requerido")
    if len(key) > MAX_MODULE_KEY_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"module_key excede {MAX_MODULE_KEY_LENGTH} caracteres",
        )
    return key


@router.get("/{module_key}", response_model=UserPreferenceResponse)
def get_preference(
    module_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve la preferencia guardada del usuario para un módulo."""
    key = _validate_module_key(module_key)
    pref = (
        db.query(UserPreference)
        .filter(
            UserPreference.user_id == current_user.id,
            UserPreference.module_key == key,
        )
        .first()
    )
    if not pref:
        raise HTTPException(status_code=404, detail="Preferencia no encontrada")
    return pref


@router.put("/{module_key}", response_model=UserPreferenceResponse)
def upsert_preference(
    module_key: str,
    data: UserPreferenceUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea o actualiza la preferencia del usuario para un módulo."""
    key = _validate_module_key(module_key)
    pref = (
        db.query(UserPreference)
        .filter(
            UserPreference.user_id == current_user.id,
            UserPreference.module_key == key,
        )
        .first()
    )

    if pref:
        pref.payload = data.payload
        pref.schema_version = data.schema_version
    else:
        pref = UserPreference(
            user_id=current_user.id,
            module_key=key,
            payload=data.payload,
            schema_version=data.schema_version,
        )
        db.add(pref)

    db.commit()
    db.refresh(pref)
    return pref
