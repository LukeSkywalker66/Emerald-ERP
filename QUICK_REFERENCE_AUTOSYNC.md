# 🎯 QUICK REFERENCE - Auto-Sync Script

**Guía de dos líneas para arrancar/detener**

---

## 🚀 ARRANCAR (Background)

```bash
nohup ./auto_sync_context.sh > sync.log 2>&1 &
```

**¿Qué hace?**
- `nohup` → No se detiene si cierras terminal
- `./auto_sync_context.sh` → Ejecuta el script
- `> sync.log 2>&1` → Logs en archivo
- `&` → Background

---

## 🛑 DETENER

```bash
pkill -f auto_sync_context.sh
```

---

## 📊 VERIFICAR LOGS

```bash
# Ver en tiempo real
tail -f sync.log

# Últimas 20 líneas
tail -20 sync.log

# Contar sincronizaciones
grep "✅" sync.log | wc -l
```

---

## ✅ VALIDAR QUE FUNCIONA

```bash
# 1. Ver si está corriendo
pgrep -f auto_sync_context.sh

# 2. Editar un archivo
echo "test" >> MASTER_CONTEXT.md

# 3. Ver en logs
tail -5 sync.log
# Debería mostrar: "✅ Sincronizado a las [HORA]"

# 4. Verificar en Google Drive
# https://drive.google.com → Emerald_ERP_Docs/ → check timestamp
```

---

## 🐛 TROUBLESHOOTING RÁPIDO

| Error | Fix |
|-------|-----|
| `command not found: inotifywait` | `sudo apt-get install inotify-tools` |
| `command not found: rclone` | `curl https://rclone.org/install.sh \| sudo bash` |
| No sincroniza | Verificar: `rclone lsd gdrive:Emerald_ERP_Docs/` |
| Carpeta no existe | Crear carpeta `Emerald_ERP_Docs` en Drive manualmente |

---

## 📝 SETUP (Una sola vez)

```bash
# 1. Instalar rclone
curl https://rclone.org/install.sh | sudo bash

# 2. Instalar inotify
sudo apt-get install inotify-tools

# 3. Configurar Google Drive
rclone config
# Seguir pasos: nuevo remoto → nombre "gdrive" → tipo 18 → autorizar en navegador

# 4. Crear carpeta en Drive
# https://drive.google.com → New Folder → nombre: "Emerald_ERP_Docs"

# 5. Listo para usar
cd /opt/emerald-erp
chmod +x auto_sync_context.sh
```

---

## 🌐 PARA GEMINI

1. Abre https://gemini.google.com
2. Crea nuevo proyecto
3. Upload: https://drive.google.com/drive/folders/[TU_CARPETA]/Emerald_ERP_Docs
4. Selecciona: `MASTER_CONTEXT.md` + `AI_ARCHITECT_CONTEXT.md`
5. Haz preguntas sobre arquitectura
6. ✅ Los archivos se actualizan automáticamente desde tu servidor

---

**Next Steps:**
- [ ] Instalar requisitos
- [ ] Configurar rclone
- [ ] Crear carpeta en Drive
- [ ] Arrancar script
- [ ] Validar en logs
- [ ] Usar en Gemini
