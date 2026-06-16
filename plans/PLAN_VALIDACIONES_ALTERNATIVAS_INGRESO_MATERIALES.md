# Plan de Implementación por Fases — Validaciones Alternativas de Ingreso de Materiales

**Fecha**: 2026-06-16  
**Estado**: Propuesta para ejecución futura  
**Alcance**: Compras + Entregas (scanner/inteligencia de cumplimiento)

---

## 1. Objetivo

Permitir validar requerimientos con **múltiples combinaciones equivalentes** sin convertir el código en una cadena de `if/else` difícil de mantener.

Ejemplo de requerimiento de instalación:

- Opción A: `ONU + DROP + CONECTORES`
- Opción B: `ONU_BRIDGE + ROUTER_WIFI + DROP + CONECTORES`

La propuesta prioriza:

1. Robustez (fuente de verdad en backend)
2. Escalabilidad (agregar reglas sin reescribir flujos)
3. Eficiencia (evaluación incremental por scan)
4. Compatibilidad con lo que ya existe (`ProductGroup`)

---

## 2. Contexto actual (base sólida)

Hoy ya existe un primer nivel útil con **grupos de productos** y lógica por requerimiento en entregas. Esto permite una evolución natural:

- No partir de cero
- No romper la API actual
- Reusar la infraestructura de scanner y estados

Punto clave: `ProductGroup` hoy sirve como clasificación. En esta propuesta pasa a ser una pieza del motor de reglas (capacidades/equivalencias), no solo metadata.

---

## 3. Principios de diseño (anti-espagueti)

1. **Reglas declarativas en backend**
   - La lógica de equivalencias vive en datos/configuración (tablas o JSONB validado), no embebida en React.
2. **Frontend liviano**
   - El frontend solo escanea, muestra estado y feedback.
3. **Evaluación incremental**
   - Cada scan actualiza un estado de cumplimiento local al delivery/session, sin recalcular todo el universo.
4. **Compatibilidad progresiva**
   - Si no hay reglas nuevas para un caso, se usa la lógica actual por producto/grupo.
5. **Observabilidad**
   - Toda decisión de regla debe dejar trazabilidad (qué alternativa ganó y por qué).

---

## 4. Modelo conceptual propuesto

### 4.1 Entidades nuevas (backend)

- `requirement_templates`
  - Define un tipo de requerimiento (ej: "InstalacionFibraResidencial").
- `requirement_alternatives`
  - Variantes válidas para cumplir el mismo template (A, B, C...).
- `requirement_components`
  - Componentes de cada alternativa con cantidad requerida.
  - Cada componente puede apuntar a:
    - `product_id` específico, o
    - `product_group_id` (recomendado para flexibilidad).

### 4.2 Extensiones recomendadas

- `product_groups` (existente): agregar metadatos opcionales de capacidad
  - ejemplo: `{"role": "cpe_access"}`, `{"role": "wifi_router"}`
- `material_delivery_items` / sesión de compra
  - guardar `requirement_key` y `matched_alternative_id` cuando aplique.

---

## 5. Motor de cumplimiento (sin procesos pesados)

### 5.1 Estrategia de evaluación

Al iniciar una entrega/compra:

1. Cargar template y alternativas aplicables
2. Precompilar estructura en memoria para esa sesión (diccionarios por clave)
3. Inicializar contadores pendientes por alternativa

En cada scan:

1. Resolver código (`resolve-scan`/scanner engine)
2. Mapear producto a componentes candidatos
3. Actualizar solo los contadores impactados
4. Recalcular estado de completitud de forma incremental

Complejidad esperada por scan: proporcional a componentes candidatos, no al total global.

### 5.2 Criterio de selección de alternativa

- Por defecto: elegir alternativa con mayor avance y menor déficit restante.
- Configurable por prioridad de negocio:
  - costo,
  - stock disponible,
  - preferencia operativa.

### 5.3 Cache y performance

- Cache en memoria por `delivery_id`/`session_id` con TTL corto.
- Invalidación al confirmar/cancelar/modificar items.
- Queries con índices en:
  - `serial_items.serial_number`
  - `products.group_id`
  - tablas de componentes/alternativas por `template_id`.

---

## 6. API futura (sin romper contratos actuales)

Agregar endpoints nuevos de forma no disruptiva:

- `GET /v2/logistics/requirements/templates/{id}`
- `POST /v2/logistics/deliveries/{id}/requirements/evaluate-scan`
- `GET /v2/logistics/deliveries/{id}/requirements/status`

Mantener endpoints actuales de scan y extender payload de respuesta con campos opcionales:

- `requirement_key`
- `matched_component_id`
- `matched_alternative_id`
- `remaining_for_alternative`

---

## 7. Plan por fases

## Fase 0 — Hardening de base actual

Objetivo: estabilizar lo existente antes de agregar complejidad.

1. Consolidar toda validación autoritativa en backend.
2. Unificar manejo de errores de scan (`success`, `message`, códigos HTTP).
3. Cerrar conflicto de listeners de scanner con arquitectura única (provider/singleton).

Criterio de salida:

- Flujo compra y entrega estable bajo carga de escaneos consecutivos.

## Fase 1 — Modelo de reglas declarativas (MVP)

Objetivo: soportar alternativas simples usando `product_group_id`.

1. Crear tablas `requirement_templates`, `requirement_alternatives`, `requirement_components`.
2. Implementar lectura y validación de reglas.
3. Implementar evaluación incremental por scan para delivery.

Criterio de salida:

- Caso real soportado: `ONU+DROP+CONECTORES` vs `ONU_BRIDGE+ROUTER+DROP+CONECTORES`.

## Fase 2 — Integración completa con scanner y wizard

Objetivo: reflejar estado de alternativa activa en UI sin lógica pesada en frontend.

1. Extender respuestas del backend con metadatos de cumplimiento.
2. Mostrar en Step 3: avance por alternativa y faltantes.
3. Mantener fallback a lógica actual cuando no exista template.

Criterio de salida:

- Operador entiende qué alternativa se está cumpliendo y qué falta sin ambigüedad.

## Fase 3 — Optimización y observabilidad

Objetivo: asegurar operación eficiente y auditable.

1. Cache por sesión + métricas de latencia por scan.
2. Logging estructurado de decisiones de matching.
3. Alertas sobre reglas inválidas o ambiguas.

Criterio de salida:

- p95 de evaluación por scan estable y trazabilidad completa de decisiones.

## Fase 4 — Expansión a compras y plantillas avanzadas

Objetivo: reutilizar el mismo motor en compras y escenarios más complejos.

1. Aplicar motor también al ingreso por compra.
2. Agregar soporte para restricciones avanzadas:
   - incompatibilidades,
   - dependencias,
   - prioridades por costo/stock.
3. Herramienta de simulación de reglas para testing funcional.

Criterio de salida:

- Motor unificado para compras/entregas con reglas versionadas.

---

## 8. Riesgos y mitigación

1. Riesgo: crecimiento descontrolado de reglas
   - Mitigación: versionado, validadores de consistencia, revisión técnica obligatoria.
2. Riesgo: ambigüedad entre alternativas
   - Mitigación: política de desempate explícita + override manual auditado.
3. Riesgo: degradación de performance
   - Mitigación: evaluación incremental, cache por sesión, índices y profiling temprano.

---

## 9. Definición de éxito

1. Alta de nueva validación sin tocar lógica central del scanner frontend.
2. Tiempo de respuesta por scan estable en operación normal.
3. Cero regresiones funcionales en compras y entregas existentes.
4. Trazabilidad de decisiones de matching para auditoría operativa.

---

## 10. Próxima iteración recomendada

1. Diseñar esquema SQLAlchemy 2.0 de las 3 tablas de reglas (sin activar aún).
2. Implementar un endpoint read-only de simulación (`evaluate dry-run`) para probar reglas con datos reales.
3. Crear 2 templates iniciales de instalación de fibra para validación de negocio.

---

## Anexo A — Ejemplo declarativo (conceptual)

```json
{
  "template": "INSTALACION_FIBRA_RESIDENCIAL",
  "alternatives": [
    {
      "code": "A_ONU_DIRECTA",
      "components": [
        {"group": "ONU_ONT", "qty": 1},
        {"group": "DROP", "qty": 1},
        {"group": "CONECTORES", "qty": 2}
      ]
    },
    {
      "code": "B_ONU_BRIDGE_ROUTER",
      "components": [
        {"group": "ONU_BRIDGE", "qty": 1},
        {"group": "ROUTER_WIFI", "qty": 1},
        {"group": "DROP", "qty": 1},
        {"group": "CONECTORES", "qty": 2}
      ]
    }
  ]
}
```

Este ejemplo debe persistirse en modelo relacional (no hardcodeado) y validarse en backend.
