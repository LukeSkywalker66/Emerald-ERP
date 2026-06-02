# 📦 Archivo Histórico de Documentación - Legacy

**Propósito:** Documentación archivada que **NO se lee en el día a día**. 
Se conserva solo para referencia histórica. El sistema ([`.clineignore`](../.clineignore)) ignora este directorio para no desperdiciar tokens.

---

## 📁 Estructura

| Directorio | Contenido | Cantidad |
|-----------|-----------|----------|
| [`checkpoints/`](checkpoints/) | Checkpoints históricos de sesiones (Enero-Febrero 2026) | 25 archivos |
| [`archivos_obsoletos/`](archivos_obsoletos/) | Documentos previamente marcados como obsoletos | ~22 archivos |
| [`module_process/`](module_process/) | Documentación de proceso de implementación (redundante con docs integradores) | 26 archivos |
| [`session/`](session/) | Archivos de sesión que estaban en la raíz del proyecto | 15 archivos |
| [`adr/`](adr/) | Architecture Decision Records históricos | 3 archivos |
| [`changelog/`](changelog/) | Changelogs antiguos | 3 archivos |
| [`devops/`](devops/) | Reportes de testing automatizado antiguos | 2 archivos |
| [`inventario/`](inventario/) | Documentación de proceso de inventario | 1 archivo |
| [`legacy/`](legacy/) | Documentación previamente legacy | 1 archivo |

---

## 🔍 Si necesitas algo de aquí

Puedes referenciar archivos específicos usando su ruta completa:

```bash
# Ejemplo: leer un checkpoint específico
cat docs/_legacy/checkpoints/CHECKPOINT_2026-02-02_WORK_ORDERS_COORDINACION.md
```

---

## 📅 Historial de Reorganización

- **02 Jun 2026:** Reorganización mayor. Toda la documentación obsoleta se movió aquí.
  - Checkpoints, sesiones, documentación de proceso, ADRs antiguos y changelogs archivados.
  - Los módulos funcionales consolidan su documentación en `docs/` (integradores).
  - `.clineignore` actualizado para ignorar `docs/_legacy/`.
