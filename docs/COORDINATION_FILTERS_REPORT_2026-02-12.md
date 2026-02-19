# Reporte - Sistema de Filtros Multicriterio para Coordinación

Fecha: 2026-02-12

## Contexto

Durante la implementación de sincronización de localidades/barrios desde ISPCube (10 de febrero), se detectó que:

- ✅ ISPCube **SÍ** provee `city` (localidad) en clientes → 7001/7090 conexiones sincronizadas
- ❌ ISPCube **NO** provee `barrio`/`neighborhood` en ningún endpoint disponible → 0/7090 conexiones con barrio

**Decisión arquitectural:** En lugar de depender de datos incompletos de ISPCube para agrupación por barrio, se implementó un **sistema de filtros visuales multicriterio** que permite a los operadores reducir el ruido visual y enfocarse en subconjuntos relevantes de OTs.

---

## Solución Implementada

### Sistema de Filtros Multicriterio

**Fecha:** 12 de febrero de 2026  
**Commits:**
- `cbc5fcf` - feat: Implementar CoordinationFilters y lógica multicriterio
- `61541cc` - refactor: Mejorar UI de desplegable de Localidades  
- `d3a48b1` - fix: Extraer ciudades reales de conexiones en CoordinationFilters

---

## Arquitectura

### Frontend

#### 1. Hook: `useTicketFilters.js`

Estado centralizado de filtros con acciones:

```javascript
const { 
  filters,           // { search, cities, types, onlyCritical }
  updateFilter,      // (key, value) => void
  toggleCity,        // (city) => void - Toggle ciudad específica
  toggleType,        // (type) => void - Toggle tipo de trabajo
  clearFilters,      // () => void - Resetear todo
  hasActiveFilters   // boolean - Indicador de filtros activos
} = useTicketFilters();
```

**Estructura de `filters`:**
```javascript
{
  search: '',          // Text search universal (ID, cliente, dirección)
  cities: [],          // Array de ciudades seleccionadas ['Rosario', 'Casilda']
  types: [],           // Array de tipos ['repair', 'install']
  onlyCritical: false  // Boolean - Mostrar solo critical/high priority
}
```

#### 2. Utilidad: `filterWorkOrders.js`

Lógica pura de filtrado multicriterio:

```javascript
export const applyTicketFilters = (workOrders = [], filters = {}) => {
  return workOrders.filter((wo) => {
    // 1. Búsqueda universal (ID, cliente, dirección)
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      const idMatch = wo.id?.toString().includes(searchLower);
      const clientMatch = ticket.client_name?.toLowerCase().includes(searchLower);
      const addressMatch = ticket.address?.toLowerCase().includes(searchLower);
      if (!idMatch && !clientMatch && !addressMatch) return false;
    }

    // 2. Filtro por localidades
    if (cities.length > 0) {
      const woCity = ticket.city || ticket.contact_info?.city || '';
      if (!cities.includes(woCity.trim())) return false;
    }

    // 3. Filtro por tipos de trabajo
    if (types.length > 0) {
      const woType = wo.ot_type || '';
      if (!types.includes(woType)) return false;
    }

    // 4. Filtro por prioridad crítica
    if (onlyCritical) {
      const priority = ticket.priority || 'low';
      if (!['critical', 'high'].includes(priority)) return false;
    }

    return true;
  });
};
```

#### 3. Componente: `CoordinationFilters.jsx`

Panel visual con Shadcn UI (Popover, Badge, Button, Switch):

**Features:**
- 🔍 **Input de búsqueda universal** con icono Search
- 📍 **Dropdown expandible de localidades** (Popover con checkboxes)
- 🛠️ **Botones toggle para tipos** (Reparación, Instalación)
- ⚠️ **Switch "Solo críticos"** para filtrar por prioridad
- 🗑️ **Botón "Limpiar filtros"** cuando hay filtros activos
- 🎯 **Badge contador** de filtros activos por categoría

**Estructura visual:**
```
┌─────────────────────────────────────────┐
│ 🔍 [Input: ID, cliente, dirección...]  │
├─────────────────────────────────────────┤
│ 📍 Localidades              [3] ▼      │
│   ┌───────────────────────────────┐    │
│   │ ☑ Rosario                     │    │
│   │ ☐ Casilda                     │    │
│   │ ☑ Funes                       │    │
│   └───────────────────────────────┘    │
├─────────────────────────────────────────┤
│ [🔧 Reparación] [📶 Instalación]       │
├─────────────────────────────────────────┤
│ ⚠️ Solo críticos          [Toggle]     │
├─────────────────────────────────────────┤
│ 🗑️ Limpiar filtros (6 activos)        │
└─────────────────────────────────────────┘
```

#### 4. Integración: `CoordinationSidebar.jsx`

- **Antes:** Filtros simples (search básico + tipo legacy)
- **Después:** Sistema completo con `CoordinationFilters` + `applyTicketFilters`

**Cambios:**
```javascript
// Hook de filtros
const {
  filters,
  updateFilter,
  toggleCity,
  toggleType,
  clearFilters,
  hasActiveFilters,
} = useTicketFilters();

// Extracción de ciudades únicas desde datos reales
const availableCities = useMemo(() => {
  return backlog.map((wo) => {
    // Jerarquía de extracción:
    // 1. ticket.city (top-level)
    // 2. ticket.contact_info.city
    // 3. ticket.connection_details?.city
    // 4. Parsing básico de address
    return extractCity(wo.ticket);
  }).filter(Boolean);
}, [backlog]);

// Aplicar filtros
const filteredBacklog = useMemo(
  () => applyTicketFilters(backlog, filters),
  [backlog, filters]
);
```

---

### Backend

#### Endpoint: `GET /v2/work-orders/coordination/grid`

**Archivo:** `backend/src/routers/work_orders.py`

**Cambios en `_wo_to_list_response()`:**

```python
def _wo_to_list_response(wo, db: Session) -> dict:
    """Enriquecer WorkOrder con datos de ticket + ciudad/barrio"""
    
    # Query join con cities/neighborhoods
    connection = db.query(Connection).filter_by(
        id=ticket.connection_id
    ).join(City, isouter=True).join(Neighborhood, isouter=True).first()
    
    # Enriquecer contact_info con localidad
    contact_info = {
        "client_name": ticket.client_name,
        "address": ticket.address,
        "city": connection.city.name if connection and connection.city else None,
        "neighborhood": connection.neighborhood.name if connection and connection.neighborhood else None,
    }
    
    return {
        "id": wo.id,
        "ot_type": wo.ot_type,
        "ticket": {
            "id": ticket.id,
            "subject": ticket.subject,
            "priority": ticket.priority,
            "city": connection.city.name if connection and connection.city else None,
            "contact_info": contact_info,
        }
    }
```

**Ahora retorna:**
```json
{
  "id": 123,
  "ot_type": "repair",
  "ticket": {
    "id": 456,
    "subject": "Sin internet",
    "priority": "high",
    "city": "Rosario",
    "contact_info": {
      "client_name": "Juan García",
      "address": "San Martín 1234",
      "city": "Rosario",
      "neighborhood": null
    }
  }
}
```

---

## Script Auxiliar: `analyze_addresses.py`

**Archivo:** `backend/scripts/analyze_addresses.py`

Para refinar regexes de parsing de ciudades desde `address`:

```python
# Consulta 1000 conexiones aleatorias
# Analiza patrones comunes en el campo address
# Genera estadísticas de ciudades/localidades detectadas
# Output: Lista de ciudades más frecuentes + patrones regex
```

**Uso:**
```bash
docker compose exec backend python scripts/analyze_addresses.py
```

---

## Datos Reales

### Ciudades Sincronizadas (ISPCube)

Después del backfill (10 de febrero):

```sql
SELECT name, COUNT(*) 
FROM cities 
JOIN connections ON connections.city_id = cities.id 
GROUP BY name 
ORDER BY COUNT(*) DESC;
```

**Top ciudades:**
| Ciudad     | Conexiones |
|-----------|-----------|
| Rosario   | 4523      |
| Casilda   | 1201      |
| Funes     | 876       |
| Roldán    | 234       |
| (otras)   | 167       |
| **Total** | **7001**  |

**Sin ciudad:** 89 conexiones (1.2%)

---

## UX / Comportamiento

### Flujo de Usuario

1. **Operador accede a Coordinación** → Ve todas las OTs en backlog (~200)
2. **Busca "San Martín"** → Input universal filtra por address
3. **Selecciona "Rosario" en dropdown** → Reduce a ~80 OTs
4. **Activa "Solo críticos"** → Reduce a ~12 OTs críticas de Rosario
5. **Selecciona tipo "Reparación"** → Reduce a ~7 OTs finales
6. **Click "Limpiar filtros"** → Vuelve a ver todas (~200)

### Indicadores Visuales

- **Badge en dropdown de localidades:** Muestra cantidad seleccionada `[3]`
- **Botones de tipo activos:** Color emerald cuando seleccionado
- **Switch críticos:** Color ruby cuando activo
- **Contador global:** `"🗑️ Limpiar filtros (6 activos)"`

---

## Ventajas del Enfoque

### vs. Agrupación por Barrio (ISPCube)

| Enfoque | Pros | Contras |
|---------|------|---------|
| **Agrupación por barrio** | Organización automática | ❌ ISPCube no provee el dato<br>❌ Requiere mantenimiento manual<br>❌ Inflexible |
| **Filtros multicriterio** | ✅ Usa datos reales (city)<br>✅ Flexible (search + city + type + priority)<br>✅ Rápido (client-side)<br>✅ Stateless (no guarda preferencias) | Requiere acción manual del operador |

### Escalabilidad

- **Performance:** Filtrado client-side con `useMemo` → O(n) lineal, rápido hasta 1000 OTs
- **Extensible:** Fácil agregar filtros nuevos (estado de conexión, antigüedad, técnico asignado)
- **Responsive:** UI compacta en Sidebar (300px width)

---

## Testing

### Casos de Prueba

1. **Búsqueda universal:**
   - Input: `"123"` → Filtra OT#123 + cliente "Juan 123" + dirección "Calle 123"
   
2. **Localidades:**
   - Seleccionar "Rosario" + "Funes" → Muestra OTs de ambas ciudades (OR logic)
   
3. **Tipos de trabajo:**
   - Seleccionar "Reparación" + "Instalación" → Muestra ambos tipos (OR logic)
   
4. **Solo críticos:**
   - Activar switch → Filtra priority = 'critical' OR 'high'
   
5. **Combinación:**
   - Search="San Martín" + City="Rosario" + Type="repair" + OnlyCritical=true → AND logic

---

## Archivos Modificados/Creados

### Frontend
- ✅ `frontend/src/components/coordination/CoordinationFilters.jsx` (NEW)
- ✅ `frontend/src/hooks/useTicketFilters.js` (NEW)
- ✅ `frontend/src/utils/filterWorkOrders.js` (NEW)
- ✅ `frontend/src/components/coordination/CoordinationSidebar.jsx` (REFACTOR)

### Backend
- ✅ `backend/src/routers/work_orders.py` (UPDATE `_wo_to_list_response`)
- ✅ `backend/scripts/analyze_addresses.py` (NEW)

### Modelos/DB
- ✅ `backend/src/models/locations.py` (existente desde 10-feb)
- ✅ `backend/src/models/beholder.py` (Connection con city_id/neighborhood_id)

---

## Comandos Útiles

### Frontend
```bash
# Ver componente de filtros
cat frontend/src/components/coordination/CoordinationFilters.jsx

# Ver lógica de filtrado
cat frontend/src/utils/filterWorkOrders.js
```

### Backend
```bash
# Analizar direcciones para refinar parsing
docker compose exec backend python scripts/analyze_addresses.py

# Ver ciudades sincronizadas
docker compose exec db psql -U emerald -d emerald_db -c \
  "SELECT name, COUNT(*) FROM cities JOIN connections ON connections.city_id = cities.id GROUP BY name ORDER BY COUNT(*) DESC;"
```

---

## Próximos Pasos

### Mejoras Potenciales

1. **Persistir filtros en localStorage**
   - Guardar preferencias del usuario (última ciudad seleccionada)
   - Restaurar filtros al recargar página

2. **Filtros adicionales**
   - [ ] Estado de conexión (online/offline) desde Mikrotik
   - [ ] Antigüedad de OT (creadas hace >24h)
   - [ ] Técnico asignado (si team_id existe)
   - [ ] Distancia desde ubicación actual (geolocalización)

3. **Presets de filtros**
   - Botones rápidos: "Críticas Rosario", "Instalaciones pendientes", "Sin asignar >48h"

4. **Analytics**
   - Track qué filtros se usan más (Rosario vs. otras ciudades)
   - Optimización de UI basado en patrones de uso

5. **Exportar resultados filtrados**
   - CSV/Excel con OTs filtradas
   - Imprimir hoja de ruta para cuadrilla

---

## Conclusión

El sistema de filtros multicriterio resuelve el problema de **reducir ruido visual** sin depender de datos incompletos de ISPCube (barrios).

**Impacto:**
- ✅ Operadores pueden enfocarse en subconjuntos relevantes (ciudad + tipo + prioridad)
- ✅ Búsqueda universal rápida (ID, cliente, dirección)
- ✅ Usa datos reales de `cities` table (7001/7090 conexiones con localidad)
- ✅ Flexible y extensible para futuros filtros

**Estado:** Productizado en develop (commit `d3a48b1`)

---

**Responsables:** Equipo Frontend + Backend  
**Fecha implementación:** 12 de febrero de 2026  
**Rama:** develop  
**Commits:**
- `cbc5fcf` - Implementación inicial
- `61541cc` - Mejora UI dropdown
- `d3a48b1` - Extracción datos reales desde backend
