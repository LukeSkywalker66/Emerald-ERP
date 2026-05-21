# PLAN: Geolocalización de Work Orders + Parse-Map-Link Utility

## Resumen

Agregar columnas `latitude` y `longitude` a las tablas `connections` y `work_orders`, crear un endpoint utilitario `POST /api/v2/utils/parse-map-link` que extrae coordenadas de links de Google Maps acortados, y construir los componentes frontend correspondientes: botón "Abrir en Google Maps" en la pantalla de ejecución de OT y campo "Pegar Link de Google Maps" en el diálogo de creación de OT.

---

## Arquitectura del Feature

```mermaid
flowchart LR
    A[Usuario pega link de Google Maps\nen Create WO Dialog] --> B[Frontend TicketDetailPage.jsx]
    B -->|POST /api/v2/utils/parse-map-link| C[Backend utils.py]
    C -->|httpx.AsyncClient follow_redirects| D[Google Maps URL final]
    D -->|Regex extraction| E[{latitude, longitude}]
    E -->|Response| B
    B -->|setWoForm latitude/longitude| F[WorkOrderCreate payload]
    F -->|POST /api/v2/work-orders| G[Backend work_orders.py]
    G -->|create_work_order_for_ticket| H[WorkOrder table\nlatitude + longitude]
    
    I[WorkOrderExecutionPage] -->|Lee WO.latitude/longitude| H
    I -->|Si no hay coords propias| J[ticket.connection.latitude/longitude]
    J -->|Abre Google Maps| K[google.com/maps/search/…]
```

---

## Cambios por Archivo

### FASE A: Modelos (Backend)

#### A1. [`backend/src/models/beholder.py:58`](backend/src/models/beholder.py:58) — Connection model
Agregar después de `neighborhood_id` (línea 58):
```python
latitude = Column(Numeric(10, 8), nullable=True, comment="Latitud de la dirección de la conexión")
longitude = Column(Numeric(10, 8), nullable=True, comment="Longitud de la dirección de la conexión")
```
- Import `Numeric` desde `sqlalchemy` (ya está importado `from sqlalchemy import Column, Integer, String, Numeric, ...`)
- **Nota**: El modelo Connection usa sintaxis legacy `Column()`, no `Mapped[]`.

#### A2. [`backend/src/models/tickets.py:22-34`](backend/src/models/tickets.py:22) — WorkOrder model imports
- Agregar `Numeric` al import de `sqlalchemy` en la línea 22

#### A3. [`backend/src/models/tickets.py:773-777`](backend/src/models/tickets.py:773) — WorkOrder model columns
Agregar **después de `notes`** (línea 777) y **antes de las relationships** (línea 779):
```python
# ===== GEOLOCALIZACIÓN =====
latitude: Mapped[Optional[float]] = mapped_column(
    Numeric(10, 8), nullable=True,
    comment="Latitud para geolocalización de la dirección"
)
longitude: Mapped[Optional[float]] = mapped_column(
    Numeric(10, 8), nullable=True,
    comment="Longitud para geolocalización de la dirección"
)
```

---

### FASE B: Schemas (Backend)

#### B1. [`backend/src/schemas/tickets.py:92-103`](backend/src/schemas/tickets.py:92) — WorkOrderCreate
Agregar al final de la clase:
```python
latitude: Optional[float] = Field(None, description="Latitud de la ubicación")
longitude: Optional[float] = Field(None, description="Longitud de la ubicación")
```

#### B2. [`backend/src/schemas/tickets.py:137-167`](backend/src/schemas/tickets.py:137) — WorkOrderUpdate
Agregar:
```python
latitude: Optional[float] = Field(None, description="Latitud de la ubicación")
longitude: Optional[float] = Field(None, description="Longitud de la ubicación")
```

#### B3. [`backend/src/schemas/tickets.py:190-225`](backend/src/schemas/tickets.py:190) — WorkOrderDetailResponse
Agregar:
```python
latitude: Optional[float] = Field(None, description="Latitud de la ubicación")
longitude: Optional[float] = Field(None, description="Longitud de la ubicación")
```

---

### FASE C: Servicio (Backend)

#### C1. [`backend/src/services/work_order_service.py:52-65`](backend/src/services/work_order_service.py:52) — create_work_order_for_ticket
- Agregar parámetros `latitude` y `longitude` con default `None`
- Pasar al constructor de `WorkOrder`:
```python
work_order = WorkOrder(
    ...
    latitude=latitude,
    longitude=longitude,
    ...
)
```

---

### FASE D: Router de WorkOrders (Backend)

#### D1. [`backend/src/routers/work_orders.py:52-95`](backend/src/routers/work_orders.py:52) — create_work_order
- Pasar `latitude=payload.latitude` y `longitude=payload.longitude` a `create_work_order_for_ticket()`

#### D2. [`backend/src/routers/work_orders.py:556-775`](backend/src/routers/work_orders.py:556) — update_work_order
- En `old_values` (línea 576): agregar `"latitude": float(wo.latitude) if wo.latitude else None` e igual para `longitude`
- En `new_values` del audit log (línea 763): agregar `"latitude": float(wo.latitude) if wo.latitude else None` e igual para `longitude`
- El mapper de `update_data` (línea 677) ya itera `payload.model_dump(exclude_unset=True)`, por lo que si `latitude`/`longitude` vienen en el payload se asignarán automáticamente vía `setattr(wo, key, value)`.

---

### FASE E: Nuevo Router Utilitario (Backend)

#### E1. Crear [`backend/src/routers/utils.py`](backend/src/routers/utils.py)
```python
"""Router de utilidades — parse-map-link para geolocalización."""
import re
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
import httpx

router = APIRouter(tags=["Utilities"])
logger = logging.getLogger(__name__)

class ParseMapLinkRequest(BaseModel):
    url: HttpUrl

class ParseMapLinkResponse(BaseModel):
    latitude: float
    longitude: float

@router.post("/parse-map-link", response_model=ParseMapLinkResponse)
async def parse_map_link(payload: ParseMapLinkRequest):
    """Sigue redirects de un link acortado de Google Maps y extrae coordenadas."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(str(payload.url))
            final_url = str(resp.url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al resolver URL: {str(e)}")
    
    # Pattern 1: /maps/place/.../@lat,lng/
    pattern1 = re.compile(r"/maps/place/.*?/@(-?\d+\.\d+),(-?\d+\.\d+)")
    # Pattern 2: /maps/?q=lat,lng
    pattern2 = re.compile(r"/maps/\?q=(-?\d+\.\d+),(-?\d+\.\d+)")
    # Pattern 3: /maps/search/lat,lng
    pattern3 = re.compile(r"/maps/search/(-?\d+\.\d+),(-?\d+\.\d+)")
    
    for pattern in [pattern1, pattern2, pattern3]:
        match = pattern.search(final_url)
        if match:
            return ParseMapLinkResponse(
                latitude=float(match.group(1)),
                longitude=float(match.group(2))
            )
    
    raise HTTPException(
        status_code=400,
        detail="No se pudieron extraer coordenadas del enlace proporcionado"
    )
```

#### E2. [`backend/src/main.py:28`](backend/src/main.py:28) — Registrar router
- Agregar `utils` al import de routers (línea 28)
- Agregar `app.include_router(utils.router, prefix="/api/v2/utils", tags=["Utilities"])`

#### E3. [`backend/requirements.txt`](backend/requirements.txt) — Agregar dependencia
- Agregar `httpx` (línea nueva, puede ir después de `requests`)

---

### FASE F: Migración Alembic

#### F1. Crear [`backend/alembic/versions/2026_05_21_001_add_lat_lng_to_connections_and_work_orders.py`](backend/alembic/versions/2026_05_21_001_add_lat_lng_to_connections_and_work_orders.py)
- `down_revision = "2026_05_20_002"` (chain desde última migración)
- `upgrade()`:
  ```python
  op.add_column("connections", sa.Column("latitude", sa.Numeric(10, 8), nullable=True))
  op.add_column("connections", sa.Column("longitude", sa.Numeric(10, 8), nullable=True))
  op.add_column("work_orders", sa.Column("latitude", sa.Numeric(10, 8), nullable=True))
  op.add_column("work_orders", sa.Column("longitude", sa.Numeric(10, 8), nullable=True))
  ```
- `downgrade()`:
  ```python
  op.drop_column("work_orders", "longitude")
  op.drop_column("work_orders", "latitude")
  op.drop_column("connections", "longitude")
  op.drop_column("connections", "latitude")
  ```

---

### FASE G: Frontend — WorkOrderExecutionPage (Botón Google Maps)

#### G1. [`frontend/src/pages/WorkOrderExecutionPage.jsx:592-602`](frontend/src/pages/WorkOrderExecutionPage.jsx:592) — Botón Google Maps
Después del bloque de dirección (línea 602), agregar:
```jsx
{/* Botón Google Maps */}
{(workOrder?.latitude || workOrder?.longitude || 
  workOrder?.ticket_info?.connection?.latitude || 
  workOrder?.ticket_info?.connection?.longitude) && (
  <div className="mt-2">
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${
        workOrder.latitude || workOrder.ticket_info?.connection?.latitude
      },${
        workOrder.longitude || workOrder.ticket_info?.connection?.longitude
      }`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg 
                 bg-zinc-900 text-emerald-400 border border-emerald-500/50
                 hover:shadow-[0_0_10px_rgba(52,211,153,0.5)] 
                 transition-all duration-200 text-xs"
    >
      <MapPin size={14} />
      Abrir en Google Maps
    </a>
  </div>
)}
```

**NOTA**: `MapPin` ya está importado en línea 10. Si no está, agregarlo al import de `lucide-react`.

---

### FASE H: Frontend — TicketDetailPage (Campo Pegar Link)

#### H1. [`frontend/src/pages/TicketDetailPage.jsx:1457-1521`](frontend/src/pages/TicketDetailPage.jsx:1457) — Agregar campo en Create WO Dialog

**State additions** (en el `useState` del WO form, línea ~656):
```javascript
const [woForm, setWoForm] = useState({
  ot_type: 'repair',
  priority: 'medium',
  operational_instruction: '',
  latitude: null,
  longitude: null,
});
const [mapsLink, setMapsLink] = useState('');
const [isParsingMapLink, setIsParsingMapLink] = useState(false);
```

**Importar servicios**: Asegurar que `api` esté importado (ya debe estarlo desde `api.js` o similar).

**Campo en el diálogo** (después del textarea de instrucción operativa, línea 1501):
```jsx
{/* Pegar Link de Google Maps */}
<div className="border-t border-zinc-800 pt-4">
  <label className="text-sm text-zinc-300 block mb-2">
    Pegar Link de Google Maps
  </label>
  <div className="flex gap-2">
    <input
      type="text"
      value={mapsLink}
      onChange={(e) => setMapsLink(e.target.value)}
      placeholder="https://maps.app.goo.gl/..."
      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 
                 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
    />
    <button
      onClick={async () => {
        if (!mapsLink.trim()) return;
        setIsParsingMapLink(true);
        try {
          const res = await api.post('/api/v2/utils/parse-map-link', { url: mapsLink });
          setWoForm(prev => ({
            ...prev,
            latitude: res.data.latitude,
            longitude: res.data.longitude,
          }));
          toast.success('Coordenadas extraídas exitosamente');
          setMapsLink('');
        } catch (err) {
          toast.error('No se pudo extraer la ubicación');
        } finally {
          setIsParsingMapLink(false);
        }
      }}
      disabled={isParsingMapLink || !mapsLink.trim()}
      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 
                 text-white rounded-lg transition-colors text-sm flex items-center gap-1"
    >
      {isParsingMapLink ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <MapPin size={14} />
      )}
      {isParsingMapLink ? 'Extrayendo...' : 'Extraer'}
    </button>
  </div>
  {woForm.latitude && woForm.longitude && (
    <p className="text-xs text-emerald-400 mt-2">
      ✓ Coordenadas: {woForm.latitude.toFixed(6)}, {woForm.longitude.toFixed(6)}
    </p>
  )}
</div>
```

**Agregar imports necesarios** al inicio del archivo:
- `Loader2` de `lucide-react` (ya debe estar importado, o agregarlo)
- `toast` de `sonner` (o `react-hot-toast` según lo que use el proyecto)

**Pasar lat/lng en `handleCreateWorkOrder`** (línea 918):
```javascript
await workOrdersService.createWorkOrder({
  ticket_id: ticket.id,
  ot_type: woForm.ot_type,
  priority: woForm.priority,
  operational_instruction: woForm.operational_instruction,
  description: woForm.operational_instruction,
  latitude: woForm.latitude,
  longitude: woForm.longitude,
});
setWoForm({ ot_type: 'repair', priority: 'medium', operational_instruction: '', latitude: null, longitude: null });
```

---

## Orden de Implementación Recomendado

| # | Fase | Archivos | Dependencias |
|---|------|----------|-------------|
| 1 | F | `backend/requirements.txt` | Ninguna |
| 2 | A | `backend/src/models/beholder.py`, `backend/src/models/tickets.py` | Ninguna |
| 3 | F1 | Migración Alembic | Fase A completa |
| 4 | B | `backend/src/schemas/tickets.py` | Fase A completa |
| 5 | C | `backend/src/services/work_order_service.py` | Fase A, B completas |
| 6 | D | `backend/src/routers/work_orders.py` | Fase A, B, C completas |
| 7 | E | `backend/src/routers/utils.py`, `backend/src/main.py` | Fase F (httpx) |
| 8 | G | `frontend/src/pages/WorkOrderExecutionPage.jsx` | Ninguna |
| 9 | H | `frontend/src/pages/TicketDetailPage.jsx` | Fase E (endpoint) |

---

## Riesgos y Consideraciones

1. **`Numeric` no importado**: En `backend/src/models/tickets.py` no está `Numeric` en el import de sqlalchemy (línea 22). Agregarlo.
2. **`httpx` ausente**: No está en `requirements.txt`. Agregarlo antes de implementar el nuevo router.
3. **Audit compatibility**: Los campos `latitude`/`longitude` son `Numeric(10,8)` que al serializarse a JSON pueden dar `Decimal` no serializable. Usar `float(wo.latitude) if wo.latitude else None` en los dicts de auditoría.
4. **Connection model legacy**: Usa `Column()` sin type annotations. No tocar esa sintaxis.
5. **Google Maps URL fallback**: Si el WO no tiene coordenadas propias pero la connection sí (futuro), se usarán las de la connection. Por ahora la connection tendrá columnas null.
6. **Frontend toast library**: Verificar qué librería de toast usa el proyecto (sonner/react-hot-toast/otra). `TicketDetailPage.jsx` probablemente ya importa `toast` de alguna librería.
