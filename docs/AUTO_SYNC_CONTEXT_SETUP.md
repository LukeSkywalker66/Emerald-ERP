# 🔄 Auto-Sync Context Script - Setup & Operación

## Propósito

Monitorea automáticamente dos archivos clave de documentación y los sincroniza en tiempo real a Google Drive, asegurando que **Gemini y otras IAs** siempre tengan acceso a la información más actualizada del proyecto.

**Archivos monitoreados:**
- `MASTER_CONTEXT.md` → Referencia técnica completa
- `AI_ARCHITECT_CONTEXT.md` → Decisiones arquitectónicas + troubleshooting

---

## 📋 Requisitos Previos

### 1. Sistema Operativo
- Linux/Unix con `inotifywait` disponible

```bash
# En Debian/Ubuntu
sudo apt-get install inotify-tools

# En RHEL/CentOS
sudo yum install inotify-tools
```

### 2. Rclone (Cliente de Google Drive)

```bash
# Instalar rclone
curl https://rclone.org/install.sh | sudo bash

# O manualmente
wget https://downloads.rclone.org/rclone-current-linux-amd64.zip
unzip rclone-current-linux-amd64.zip
sudo cp rclone-current-linux-amd64/rclone /usr/local/bin/
```

### 3. Configurar Rclone + Google Drive

```bash
# Iniciar configuración interactiva
rclone config

# Pasos:
# 1. Opción: "n" (nuevo remoto)
# 2. Nombre: "gdrive" (sin comillas)
# 3. Tipo: "18" (Google Drive)
# 4. Client ID/Secret: Dejar en blanco (usar default)
# 5. Scope: "1" (Full access)
# 6. Usar configuración default para el resto
# 7. Autenticar en el navegador cuando pida
# 8. Presionar "n" para no configurar una carpeta específica
```

**Verificar que funciona:**

```bash
rclone lsd gdrive:
# Deberías ver tus carpetas de Google Drive
```

### 4. Crear Carpeta en Google Drive

1. Abre https://drive.google.com
2. Crea una carpeta llamada **`Emerald_ERP_Docs`** (mayúsculas exactas)
3. Los archivos se sincronizarán ahí automáticamente

---

## 🚀 Arrancar el Script

### Opción 1: En Foreground (debugging)

```bash
cd /opt/emerald-erp
chmod +x auto_sync_context.sh
./auto_sync_context.sh
```

Verás logs en tiempo real. Para detener: `Ctrl+C`

### Opción 2: En Background (producción)

```bash
cd /opt/emerald-erp
nohup ./auto_sync_context.sh > sync.log 2>&1 &
```

**Explicación:**
- `nohup` → No Hang Up (ignora SIGHUP)
- `> sync.log 2>&1` → Redirige stdout y stderr al archivo `sync.log`
- `&` → Ejecuta en background

**Verificar que está corriendo:**

```bash
pgrep -f auto_sync_context.sh
# Debería devolver un PID (número)
```

---

## 🛑 Detener el Script

```bash
pkill -f auto_sync_context.sh
```

**Verificar que se detuvo:**

```bash
pgrep -f auto_sync_context.sh
# No debería devolver nada
```

---

## 📊 Monitoreo & Logs

### Ver logs en tiempo real

```bash
tail -f sync.log
```

### Ver últimas 20 líneas

```bash
tail -20 sync.log
```

### Ver estadísticas de sincronización

```bash
grep "✅ Sincronizado" sync.log | wc -l
# Cuántos archivos se han sincronizado
```

---

## 🔧 Cómo Funciona

### Flujo General

```
1. Script arranca con inotifywait
        ↓
2. Monitorea eventos en /opt/emerald-erp
        ↓
3. Detecta: ¿cambió MASTER_CONTEXT.md O AI_ARCHITECT_CONTEXT.md?
        ↓
   SÍ → Pausa 0.5s (espera a que disco termine de escribir)
        ↓
   Ejecuta: rclone copy archivo gdrive:Emerald_ERP_Docs/
        ↓
   Registra: ✅ Sincronizado a las [TIMESTAMP]
        ↓
4. Vuelve a monitorear (loop infinito)
```

### Eventos Detectados

- `close_write` → Archivo cerrado después de escritura (VS Code, nano, etc.)
- `moved_to` → Archivo movido (VS Code a veces guarda así)

### Pausa de Seguridad (0.5s)

Algunos editores escriben en archivos temporales y luego los mueven. La pausa asegura que el archivo esté completamente escrito antes de sincronizar.

---

## ✅ Validar Sincronización

### 1. Editar un archivo localmente

```bash
# Opción A: Editar manualmente con tu editor
vi MASTER_CONTEXT.md
# Guardar

# Opción B: Hacer cambio desde terminal
echo "# Test" >> AI_ARCHITECT_CONTEXT.md
```

### 2. Verificar que apareció en Drive

```bash
# Ver contenido remoto
rclone ls gdrive:Emerald_ERP_Docs/
# Debería listar los archivos

# Ver timestamp
rclone lsl gdrive:Emerald_ERP_Docs/
# Mostrará fechas de modificación
```

### 3. Confirmar en Google Drive

1. Abre https://drive.google.com
2. Navega a `Emerald_ERP_Docs/`
3. Verifica que `MASTER_CONTEXT.md` y `AI_ARCHITECT_CONTEXT.md` están ahí
4. Abre Gemini y agrega estos archivos como contexto

---

## 🐛 Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| `inotifywait: command not found` | No instalado | `sudo apt-get install inotify-tools` |
| `rclone: command not found` | No instalado | Ver sección Requisitos |
| Script no detecta cambios | Editores que no triggerean `close_write` | Usa un editor estándar (VS Code, nano) |
| Error: `permission denied` | Permisos insuficientes | `chmod +x auto_sync_context.sh` |
| No sube a Drive | Rclone no autenticado | Rerun `rclone config` |
| `gdrive:` no existe | Path incorrecto en remoto | Verifica: `rclone listremotes` |

### Debug avanzado

```bash
# Ver qué eventos dispara inotifywait
inotifywait -m --format "%f %e" /opt/emerald-erp | grep -E "MASTER_CONTEXT|AI_ARCHITECT"

# Ver logs detallados de rclone
rclone -v copy MASTER_CONTEXT.md gdrive:Emerald_ERP_Docs/
```

---

## 🔐 Consideraciones de Seguridad

### Tokens de Rclone

```bash
# Rclone almacena credenciales aquí:
cat ~/.config/rclone/rclone.conf
```

⚠️ **NUNCA** commitees `rclone.conf` a git. Ya está en `.gitignore`.

### Compartir Drive

Si querés que **múltiples usuarios/máquinas** sincronicen:

```bash
# En otra máquina, ejecutar rclone config con Google Drive 
# Autorizar la MISMA cuenta
# El remoto "gdrive:" apuntará a la misma carpeta
```

---

## 📈 Casos de Uso

### Caso 1: Documentación siempre fresh en Gemini

```
1. Desarrollador edita MASTER_CONTEXT.md localmente
2. Script detecta cambio inmediatamente
3. Archivo se sincroniza a gdrive:Emerald_ERP_Docs/
4. Gemini carga el archivo actualizado
5. Gemini da sugerencias arquitectónicas con info fresca
```

### Caso 2: Múltiples desarrolladores

```
Dev A edita localmente → Subo a Drive
Dev B abre MASTER_CONTEXT.md desde Drive → Lee los cambios frescos
```

### Caso 3: Auditoría & Compliance

```
Todos los cambios quedan registrados en Drive
Timestamps de sincronización en sync.log
Google Drive mantiene historial de versiones
```

---

## 📝 Checklist de Setup

- [ ] `inotify-tools` instalado
- [ ] `rclone` instalado y en PATH
- [ ] `rclone config` ejecutado (remoto "gdrive" creado)
- [ ] Carpeta `Emerald_ERP_Docs` creada en Google Drive
- [ ] `auto_sync_context.sh` tiene permisos ejecutables (`chmod +x`)
- [ ] Script probado en foreground
- [ ] Script iniciado en background: `nohup ./auto_sync_context.sh > sync.log 2>&1 &`
- [ ] Verificado que sincroniza: editar archivo, verificar en Drive
- [ ] Agregados MASTER_CONTEXT.md y AI_ARCHITECT_CONTEXT.md a Gemini

---

## 🎯 Próximos Pasos

1. **Agregar a Systemd (Opcional - Auto-start en reboot)**

```bash
# Crear archivo de servicio
sudo nano /etc/systemd/system/emerald-sync.service

# Contenido:
[Unit]
Description=Emerald ERP Auto-Sync to Google Drive
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/emerald-erp
ExecStart=/opt/emerald-erp/auto_sync_context.sh
Restart=on-failure
RestartSec=10
User=ubuntu  # Cambiar por tu usuario

[Install]
WantedBy=multi-user.target

# Habilitar
sudo systemctl enable emerald-sync
sudo systemctl start emerald-sync
```

2. **Agregar a crontab (Alternativa - para reintentos)**

```bash
# Cada 1 hora, verifica si el script está corriendo
crontab -e

# Agregar línea:
0 * * * * pgrep -f auto_sync_context.sh || nohup /opt/emerald-erp/auto_sync_context.sh >> /opt/emerald-erp/sync.log 2>&1 &
```

---

**Documento versión:** 1.0  
**Última actualización:** 30 Enero 2026  
**Mantenedor:** Team Emerald ERP
