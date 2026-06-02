
# 🔄 Auto-Sync Context Script - Setup & Operación (Producción via Systemd)

## Propósito

Monitorea automáticamente los archivos clave de documentación y los sincroniza en tiempo real a Google Drive, asegurando que **Gemini y otras IAs** siempre tengan acceso a la información más actualizada del proyecto.

**Archivos monitoreados:**
- `MASTER_CONTEXT.md` → Referencia técnica completa
- `AI_ARCHITECT_CONTEXT.md` → Decisiones arquitectónicas + troubleshooting
- `BASE_DATOS.md` → Estructura y esquemas
- `ROADMAP.md` → Estado de tareas y próximos pasos

---

## 📋 Requisitos Previos

### 1. Sistema Operativo
- Linux/Unix con `inotifywait` disponible

```bash
# En Debian/Ubuntu
sudo apt-get install inotify-tools

```

### 2. Rclone (Cliente de Google Drive)

Debe estar instalado y configurado con el remoto `gdrive` apuntando a la cuenta correspondiente.

---

## 🚀 Setup del Servicio (Producción - Recomendado)

Para garantizar que el script sobreviva a reinicios del servidor, se recupere ante fallos y maneje los logs eficientemente (sin llenar el disco), utilizamos **Systemd**.

### 1. Crear el archivo del servicio

```bash
sudo nano /etc/systemd/system/emerald-sync.service

```

### 2. Contenido del archivo `emerald-sync.service`

```ini
[Unit]
Description=Emerald ERP Auto-Sync to Google Drive
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/emerald-erp
ExecStart=/bin/bash /opt/emerald-erp/auto_sync_context.sh
Restart=on-failure
RestartSec=10
# Asegurar que el usuario tenga permisos sobre los archivos y el config de rclone
User=root 

[Install]
WantedBy=multi-user.target

```

### 3. Activar y Arrancar el demonio

```bash
sudo systemctl daemon-reload
sudo systemctl enable emerald-sync
sudo systemctl start emerald-sync

```

---

## 🛑 Operación y Monitoreo (Comandos Útiles)

Una vez configurado como servicio de Systemd, la gestión se vuelve centralizada:

**Ver el estado del servicio:**

```bash
sudo systemctl status emerald-sync

```

**Ver logs en tiempo real (Live Tail):**

```bash
sudo journalctl -u emerald-sync -f

```

**Ver las últimas 50 líneas de logs:**

```bash
sudo journalctl -u emerald-sync -n 50

```

**Detener el script:**

```bash
sudo systemctl stop emerald-sync

```

**Reiniciar el script (Ej: si modificaste el `.sh`):**

```bash
sudo systemctl restart emerald-sync

```

---

## 🛠️ Opción Manual / Debugging (Foreground)

Si necesitas probar un cambio en el script en tiempo real antes de mandarlo al servicio de producción:

```bash
# 1. Frenar el servicio de producción para que no compita
sudo systemctl stop emerald-sync

# 2. Correr el script en la terminal activa
cd /opt/emerald-erp
./auto_sync_context.sh

# 3. (Al terminar de probar, presionar Ctrl+C)
# 4. Volver a levantar el servicio
sudo systemctl start emerald-sync

```

---

## 🔧 Cómo Funciona el Flujo

```text
1. Systemd mantiene vivo el script auto_sync_context.sh en background.
        ↓
2. inotifywait monitorea eventos en /opt/emerald-erp
        ↓
3. Detecta: ¿cambió alguno de los archivos .md documentados?
        ↓
   SÍ → Pausa 0.5s (espera a que el disco termine de escribir, útil si se usa VS Code)
        ↓
   Ejecuta: rclone copy archivo gdrive:Emerald_ERP_Docs/
        ↓
   Registra: ✅ Sincronizado a las [TIMESTAMP] en el Journalctl
        ↓
4. Vuelve a monitorear (loop infinito)

```

---

## 🐛 Troubleshooting

| Problema | Causa | Solución |
|---|---|---|
| `inotifywait: command not found` | No instalado | `sudo apt-get install inotify-tools` |
| `Service failed to start` | Permisos/Ruta incorrecta | Validar `chmod +x` y ruta en ExecStart |
| No sube a Drive | Rclone no autenticado | `rclone config` con usuario root |
| Archivos no actualizan | VS Code usa temporales | Script detecta `-e moved_to` |

---

**Documento versión:** 2.0 (Systemd Refactor)

**Última actualización:** 02 Marzo 2026

**Mantenedor:** Team Emerald ERP

