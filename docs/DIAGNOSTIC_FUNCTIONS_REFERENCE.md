# Referencia de Funciones de Diagnóstico (Beholder)

> **Nota:** Este documento fue creado durante el Refurbish OT (06/06/2026).
> El bloque de diagnóstico se conserva en WorkOrderExecutionPage y puede replicarse
> en TicketDetailPage siguiendo esta guía.

> **Propósito:** Documentar las funciones y llamadas del bloque de diagnóstico que fue eliminado del módulo Work Orders, para poder replicar la misma funcionalidad en el módulo Tickets (específicamente en TicketDetailPage).

## Ubicación Actual del Bloque de Diagnóstico

El bloque de diagnóstico (Beholder) actualmente se encuentra en:
- [`WorkOrderExecutionPage.jsx`](../frontend/src/pages/WorkOrderExecutionPage.jsx) (líneas 166-169, 430-464, 796-893)

Se renderiza exclusivamente cuando:
- `workOrder?.ot_type !== 'install'` (NO es instalación)
- `workOrder?.ticket_info?.pppoe_username` existe (el cliente tiene usuario PPPoE)

## Backend

### [`backend/src/services/diagnosis.py`](../backend/src/services/diagnosis.py)

**Función principal: `consultar_diagnostico(pppoe_user, ip=None)`**

Orquesta el diagnóstico en 3 pasos:
1. **Base de datos (Postgres):** Busca datos base del cliente por PPPoE username
2. **Mikrotik:** Valida estado PPPoE en tiempo real (activo/inactivo)
3. **SmartOLT:** Consulta estado de ONU, señal óptica y VLANs (si tiene unique_external_id)

**Funciones auxiliares:**
- `search_clients(query)` - Búsqueda unificada de clientes (mínimo 3 caracteres)
- `get_live_traffic(pppoe_user)` - Tráfico en vivo desde el Mikrotik

### Endpoints del Backend

Las rutas del backend están en el router de diagnosis (no en tickets.py ni work_orders.py):
- `GET /diagnosis/{pppoe_user}` - Diagnóstico completo
- `GET /search?q={query}` - Búsqueda de clientes
- `GET /live/{pppoe_user}` - Tráfico en vivo

## Frontend - Servicio

### [`frontend/src/services/beholder.service.js`](../frontend/src/services/beholder.service.js)

Tres funciones exportadas:

```javascript
// 1. Buscar clientes por nombre, DNI o PPPoE
searchClients(query) → GET /search?q={query}

// 2. Diagnóstico completo (la principal para el widget)
getDiagnosis(pppoeUser, ip = null) → GET /diagnosis/{pppoeUser}?ip={ip}

// 3. Tráfico en vivo
getLiveTraffic(pppoeUser) → GET /live/{pppoeUser}
```

## Frontend - Implementación en WorkOrderExecutionPage

### State (líneas 166-169)
```javascript
const [beholderData, setBeholderData] = useState(null);
const [beholderLoading, setBeholderLoading] = useState(false);
const [beholderError, setBeholderError] = useState(null);
```

### Handler (líneas 430-464)
```javascript
const handleCheckBeholder = async () => {
    const pppoeUser = workOrder?.ticket_info?.pppoe_username;
    if (!pppoeUser) {
      alert('No se encontró usuario PPPoE para este cliente');
      return;
    }
    try {
      setBeholderLoading(true);
      setBeholderError(null);
      const data = await beholderService.getDiagnosis(pppoeUser);
      setBeholderData(data);
    } catch (err) {
      let errorMsg = 'Error al consultar diagnóstico';
      if (err?.response?.status === 404) {
        errorMsg = `Usuario PPPoE "${pppoeUser}" no encontrado en la red.`;
      } else if (err?.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err.message) {
        errorMsg = err.message;
      }
      setBeholderError(errorMsg);
    } finally {
      setBeholderLoading(false);
    }
};
```

### UI Widget (líneas 796-893)

Renderizado condicional:
```jsx
{workOrder?.ot_type !== 'install' && workOrder?.ticket_info?.pppoe_username && (
    <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
      <h2>Diagnóstico Remoto (Beholder)</h2>
      <p>PPPoE: {workOrder.ticket_info.pppoe_username}</p>
      
      {/* Resultados */}
      {beholderData && (
        <div className="...">
          {/* Estado PPPoE */}
          <Badge>{beholderData.mikrotik?.active ? '🟢 Activo' : '🔴 Inactivo'}</Badge>
          
          {/* Cliente */}
          {beholderData.cliente_nombre && beholderData.cliente_nombre !== 'No Vinculado' && (
            <div>Cliente: {beholderData.cliente_nombre}</div>
          )}
          
          {/* Plan */}
          {beholderData.plan && <div>Plan: {beholderData.plan}</div>}
          
          {/* Nodo */}
          {beholderData.nodo_nombre && <div>Nodo: {beholderData.nodo_nombre}</div>}
          
          {/* ONU Status */}
          {beholderData.onu_status_smrt && !beholderData.onu_status_smrt.error && (
            <div>ONU: {beholderData.onu_status_smrt.onu_status || 'N/A'}</div>
          )}
          
          {/* Señal óptica */}
          {beholderData.onu_signal_smrt && !beholderData.onu_signal_smrt.error && 
           beholderData.onu_signal_smrt.onu_signal_value && (
            <div>Señal RX: {beholderData.onu_signal_smrt.onu_signal_value} dBm</div>
          )}
        </div>
      )}
      
      {/* Error */}
      {beholderError && <div>{beholderError}</div>}
      
      {/* Botón */}
      <Button onClick={handleCheckBeholder} disabled={isCompleted || beholderLoading}>
        {beholderLoading ? <Loader /> : <Activity />}
        {beholderData ? 'Actualizar Estado' : 'Verificar Estado'}
      </Button>
    </div>
)}
```

## Datos Retornados por el Backend

El objeto `beholderData` contiene:

| Campo | Fuente | Descripción |
|-------|--------|-------------|
| `cliente_nombre` | Postgres | Nombre del cliente |
| `plan` | Postgres | Plan contratado |
| `nodo_nombre` | Postgres | Nombre del nodo |
| `nodo_ip` | Postgres | IP del router/nodo |
| `mikrotik.active` | Mikrotik API | Estado PPPoE (true/false) |
| `onu_status_smrt` | SmartOLT API | Estado de la ONU |
| `onu_signal_smrt` | SmartOLT API | Señal óptica (RX) |
| `onu_vlan` | SmartOLT API | VLANs asignadas |
| `pppoe_username` | Postgres | Usuario PPPoE |
| `unique_external_id` | Postgres | ID externo para SmartOLT |

## Para Implementar en TicketDetailPage

1. **Importar**: `import beholderService from '@/services/beholder.service'`
2. **Obtener PPPoE**: Desde los datos del ticket (similar a `ticket_info?.pppoe_username`)
3. **Llamar**: `beholderService.getDiagnosis(pppoeUser)`
4. **Renderizar**: Usar el mismo patrón de UI que en WorkOrderExecutionPage
5. **Consideración**: El bloque en WorkOrders se mostraba solo para `ot_type !== 'install'`. En tickets habría que definir la condición equivalente.
