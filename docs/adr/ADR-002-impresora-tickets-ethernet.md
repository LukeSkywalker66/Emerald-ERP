# ADR-002 — Impresión de códigos de barras en impresora de tickets Ethernet

- **Estado:** Propuesto (pendiente de implementación)
- **Fecha:** 2026-09-29
- **Decisores:** Equipo Emerald
- **Módulos afectados:** Logística, Inventario/Compras, Backend de impresión
- **Relacionado con:** [`ADR-001`](../_legacy/adr/001-implementacion-ssl.md.md), [`PLAN_TRACKED_UNITS_BARCODE_GENERATOR.md`](../../plans/PLAN_TRACKED_UNITS_BARCODE_GENERATOR.md)

## 1. Contexto

Hoy los códigos de barras propios (unidades trazables, formato `AAA-YYYY-NNNNN`) se
imprimen exclusivamente mediante el navegador (`window.print()`), generando etiquetas
SVG/PNG en una hoja A4 para **impresora común** (láser/inyección vía driver del SO).

Se necesita, además, poder imprimir en **impresoras de tickets térmicas conectadas por
Ethernet** (ej. Epson TM-T20/TM-T88, Zebra ZD). Estas impresoras:

- No pasan por el diálogo de impresión del navegador.
- Reciben comandos propios: **ESC/POS** (Epson) o **ZPL** (Zebra), normalmente por TCP
  crudo en el puerto **9100**.
- Tienen un ancho de papel fijo (típicamente 58 mm u 80 mm).

Un dato técnico relevante que condiciona la solución: la causa raíz del bug
"guion → apóstrofe" al escanear fue la **distorsión de la geometría de las barras**
(reescalado + antialiasing del SVG vectorial). Por eso, cualquier solución de impresión
debe garantizar **módulos de ancho entero y sin reescalado**, lo que empuja a generar
**bitmaps en el backend** y, para las térmicas, usar el comando de barcode nativo del
lenguaje de la impresora o una imagen rasterizada a su DPI nativo.

## 2. Decisión

Agregar un **subsistema de impresión en el backend** con dos salidas, manteniendo la
impresora común actual y sumando la de tickets:

1. **Impresora común (actual):** se mantiene `window.print()` en el frontend, pero
   consumiendo el **PNG 1-bit de alta resolución** que ya genera
   [`BarcodeGeneratorService.render_png()`](../../backend/src/services/barcode_generator_service.py:152).
2. **Impresora de tickets Ethernet (nueva):** el backend envía el trabajo por **TCP 9100**
   usando **ESC/POS** (default) o **ZPL**, según el protocolo configurado de la impresora.

Toda la lógica (generación de bitmap, armado del payload ESC/POS/ZPL, apertura del
socket, retries) vive en el **backend**. El frontend solo muestra un selector de
impresora y dispara un `POST`.

## 3. Arquitectura propuesta

### 3.1 Configuración de impresoras (persistencia)

Reutilizar la tabla key-value existente [`system_config`](../../backend/src/models/settings.py:69).
Se crea una clave por impresora, por ejemplo:

```json
{
  "ticket_printer_default": {
    "name": "Ticket almacén",
    "protocol": "escpos",          // "escpos" | "zpl"
    "host": "192.168.1.50",
    "port": 9100,
    "paper_width_mm": 80,
    "dpi": 203,
    "enabled": true
  }
}
```

Las impresoras se administran desde Settings. El backend valida `protocol`, `host` y
`port` (solo IPs/hosts privados permitidos para evitar SSRF).

### 3.2 Servicio backend: `TicketPrinterService`

Nuevo servicio [`services/ticket_printer_service.py`](../../backend/src/services/ticket_printer_service.py)
(pendiente de crear) con responsabilidades:

- `list_printers(db)` — lee `system_config`.
- `print_tracked_unit_labels(serial_item_ids, printer_id, db)`:
  1. Recupera los `SerialItem` y valida `is_generated_barcode`.
  2. Genera el PNG 1-bit con `BarcodeGeneratorService.render_png(...)`, usando
     `dpi` de la impresora y `module_px` entero (ver §4).
  3. Construye el payload ESC/POS (`GS v 0` / `GS ( L` para raster) o ZPL (`^GF` /
     `^BC` para Code 128 nativo).
  4. Abre socket TCP al `host:port` con timeout y reintentos acotados.
  5. Envía y cierra; devuelve `{ success, printed, errors }`.

- `ping(printer)` — chequeo de conectividad para la UI.

### 3.3 Endpoint API

- `POST /api/v2/logistics/tracked-units/print`
  Body: `{ printer_id: str, serial_item_ids: number[] }`
  Response: `{ success: boolean, printed: number, errors: string[] }`

- `GET /api/v2/settings/printers` / `PUT ...` (o reutilizar el CRUD de `system_config`)
  para administrar impresoras.

### 3.4 Frontend (mínimo)

En [`BarcodeLabelPrinter.jsx`](../../frontend/src/pages/logistics/BarcodeLabelPrinter.jsx:24),
agregar un control "Destino de impresión":

- `Impresora común` → `window.print()` (comportamiento actual).
- `Impresora de tickets` → selector + botón que llama al endpoint de impresión.

Sin lógica de generación ni de protocolo en el frontend.

## 4. Directivas de calidad de barras (críticas)

Reglas obligatorias heredadas del bug de "guion → apóstrofe":

1. **Módulos enteros:** el ancho de cada módulo debe ser un número entero de píxeles
   a la resolución de la impresora. Para térmicas 203 DPI, usar `module_px = 4`
   (≈ 0.5 mm) o `module_px = 3` (≈ 0.375 mm); para 300 DPI, `module_px = 4` (≈ 0.339 mm).
2. **Nunca reescalar** el bitmap: se imprime 1:1 en tamaño físico (mm) exacto.
3. **Zona de silencio** de 10 módulos a cada lado (ya aplicada en
   [`render_png()`](../../backend/src/services/barcode_generator_service.py:152)).
4. Para ZPL, preferir el comando nativo `^BC` (Code 128) antes que una imagen, porque
   la impresora garantiza la geometría exacta. Si se envía raster ESC/POS, generar el
   bitmap al DPI nativo de la impresora.
5. Todo código de barras debe poder **decodificarse de forma programática** antes de
   liberar (test de regresión con decodificador de referencia; ver §6).

## 5. Alternativas consideradas

| Alternativa | Por qué se descartó |
|---|---|
| Imprimir a térmica vía driver del SO y `window.print()` | Depende de drivers instalados por estación, no funciona en todos los clientes, sin control del DPI/geometría. |
| Raw TCP desde el navegador | Los navegadores no permiten abrir sockets TCP crudos a puertos arbitrarios. |
| Agente local en la estación (impresión por cola) | Agrega infraestructura por cliente y es difícil de operar/soportar. |
| Solo ZPL o solo ESC/POS | Ataría la solución a una marca; se elige soporte por protocolo configurable. |

## 6. Pruebas

- **Unitarias:** generación PNG (dimensiones enteras, decodificación correcta), armado
  de payload ESC/POS/ZPL, validación de configuración y SSRF.
- **Integración:** mock de socket TCP (verificar bytes enviados, timeout, retry).
- **Regresión de escaneo:** decodificar el PNG generado y comparar contra el
  `serial_number` esperado (debe contener guiones, nunca apóstrofes).
- **E2E manual:** impresión real en una Epson TM (ESC/POS) y una Zebra (ZPL), y lectura
  con pistola de las etiquetas resultantes.

## 7. Consecuencias

**Positivas**
- La impresión de tickets queda centralizada y auditable en el backend.
- Se elimina la dependencia de la rasterización del navegador (fuente del bug).
- El mismo generador de PNG sirve para ambas salidas (común y térmica).

**Riesgos / pendientes**
- Hay que conocer el protocolo/marca de cada impresora al configurarla.
- El backend debe poder alcanzar la impresora por red (mismo segmento/VLAN).
- Se debe limitar el puerto/host para evitar abuso (SSRF) y manejar timeouts.
