# Cambios UI Kanban de Ingeniería (20/01/2026)

## Resumen
- Se restauró el layout responsivo clásico del tablero Kanban de ingeniería.
- Las columnas ahora se ajustan automáticamente al ancho total del módulo, sin forzar scroll horizontal en desktop.
- El grid reparte el espacio entre columnas de forma natural y responsiva.
- El scroll horizontal solo aparece en mobile o si hay muchas columnas.
- Se mantiene el truncado/wrap en etiquetas y tarjetas para evitar desbordes.

## Motivo
- Usuarios reportaron que el tablero excedía el ancho de la ventana y forzaba scroll innecesario.
- Se buscó replicar el comportamiento original: columnas adaptativas, sin desbordes ni scroll forzado.

## Detalles Técnicos
- Se eliminó el uso de `flex-1`, `min-w`, `max-w` y scroll forzado en el contenedor de columnas.
- Se restauró el grid: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full`.
- Las columnas ahora ocupan el espacio disponible y solo hacen scroll si realmente no entran.
- No se modificó ninguna funcionalidad de drag & drop ni lógica de negocio.

## QA
- Verificar que el tablero Kanban de ingeniería se ajuste siempre al ancho del módulo.
- En desktop, no debe haber scroll horizontal ni columnas desbordadas.
- En mobile, el grid debe apilar columnas o permitir scroll solo si es necesario.
- Las etiquetas y tarjetas deben truncar/wrap correctamente.

---
_Commit relacionado: d5f27f2 en rama develop_
