"""
Schemas Pydantic para Contact Attempts - Intentos de Contacto.

Define modelos de validación para:
  - Crear intentos de contacto
  - Leer historial de intentos
  - Estadísticas de coordinación
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

from src.models.contact_attempts import ContactAttemptResult


# ========== CREATE ==========

class ContactAttemptCreate(BaseModel):
    """Schema para crear un nuevo intento de contacto."""
    
    result: ContactAttemptResult = Field(
        ...,
        description="Resultado del intento de contacto"
    )
    
    phone_number: Optional[str] = Field(
        None,
        max_length=50,
        description="Número al que se intentó llamar (opcional, snapshot)"
    )
    
    notes: Optional[str] = Field(
        None,
        description="Notas adicionales del coordinador"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "result": "no_answer",
                "phone_number": "+54 9 261 1234567",
                "notes": "Buzón de voz. Cliente pidió llamar después de las 14hs"
            }
        }
    )


# ========== RESPONSE ==========

class ContactAttemptResponse(BaseModel):
    """Schema de respuesta para un intento de contacto."""
    
    id: int
    work_order_id: int
    attempted_by: Optional[int]
    coordinator_name: Optional[str] = None
    result: ContactAttemptResult
    phone_number: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ========== STATS ==========

class ContactAttemptsStatsResponse(BaseModel):
    """Estadísticas de intentos de contacto para una OT."""
    
    work_order_id: int
    total_attempts: int
    last_attempt: Optional[ContactAttemptResponse]
    results_breakdown: dict[str, int] = Field(
        default_factory=dict,
        description="Conteo por tipo de resultado (no_answer: 3, successful: 1, etc)"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "work_order_id": 123,
                "total_attempts": 4,
                "last_attempt": {
                    "id": 45,
                    "work_order_id": 123,
                    "attempted_by": 5,
                    "coordinator_name": "Juan Pérez",
                    "result": "no_answer",
                    "phone_number": "+54 9 261 1234567",
                    "notes": "No contesta. Reintentar mañana",
                    "created_at": "2026-02-05T14:30:00Z"
                },
                "results_breakdown": {
                    "no_answer": 3,
                    "successful": 1
                }
            }
        }
    )
