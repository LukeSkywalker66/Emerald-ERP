# Code-Server Setup - VS Code Persistente Entre PCs

**Propósito:** Eliminar los 40 minutos diarios de contexto perdido cuando cambias de máquina (oficina ↔ casa).

---

## 🎯 El Problema Que Resuelve

- Trabajas mitad del día en oficina, mitad en casa
- Cada sesión de VS Code Remote SSH es independiente
- Copilot pierde contexto, tardas 40 min poniendo al día
- **Code-Server = Sesión única en el servidor, acceso desde cualquier PC**

---

## ⚡ SETUP (15 minutos, una sola vez)

### Paso 1: SSH al Servidor Debian

```bash
ssh usuario@tu-servidor-debian
# Ej: ssh lucas@192.168.1.100
```

### Paso 2: Instalar Code-Server

```bash
curl -fsSL https://code-server.dev/install.sh | sh
```

Espera a que termine (2-3 min). Verás algo como:
```
✓ Installed /usr/bin/code-server
```

### Paso 3: Iniciar Code-Server

```bash
# Opción A: Iniciar ahora en background
code-server --bind-addr 0.0.0.0:8080 &

# Opción B: Iniciar y que se mantenga (mejor a largo plazo)
sudo systemctl enable --now code-server@$USER
```

**Output esperado:**
```
[2026-01-13T20:15:00] info  Server bound to 0.0.0.0:8080
[2026-01-13T20:15:00] info  Web UI available at http://localhost:8080
[2026-01-13T20:15:00] info  Password is: <CONTRASEÑA_ALEATORIA>
```

### Paso 4: Copiar la Contraseña

Code-Server genera una contraseña aleatoria. Cópiala, la necesitarás la primera vez.

---

## 🌐 Acceso Desde Cualquier PC

### Opción A: SSH Tunnel (Más Seguro - Recomendado)

**Desde tu PC (oficina o casa):**

```bash
# Abre una terminal
ssh -L 8080:127.0.0.1:8080 usuario@tu-servidor-debian
# Ej: ssh -L 8080:127.0.0.1:8080 lucas@192.168.1.100

# Luego en navegador:
# http://localhost:8080
```

**Ventajas:**
- ✅ Tráfico cifrado por SSH
- ✅ Solo tú puedes acceder (no expone el servidor)
- ✅ Funciona incluso a través de VPN o redes públicas

**Mantén esa terminal abierta mientras trabajes.** Cuando cierres, se corta la conexión a Code-Server.

### Opción B: Directo (Solo si está en LAN privada)

```
http://tu-servidor-debian:8080
# Ej: http://192.168.1.100:8080
```

⚠️ **No recomendado** si el servidor está expuesto a internet. Solo para red interna.

---

## 🔧 Primera Vez en Code-Server

1. **Entra a `http://localhost:8080`** (o tu URL)
2. **Ingresa la contraseña** que Code-Server te mostró al iniciar
3. **Navega a `/opt/emerald-erp`** (o tu workspace)
   - File → Open Folder → `/opt/emerald-erp`
4. **Instala extensión de Copilot**
   - Click en Extensions (panel izquierdo)
   - Busca "GitHub Copilot"
   - Instala
   - Te pedirá autenticar con GitHub (browser popup)
5. **Listo.** Ya tienes VS Code en el navegador con Copilot

---

## 💾 Cambiar Contraseña (Opcional)

```bash
# En el servidor:
code-server --bind-addr 0.0.0.0:8080 --password "mi-nueva-contraseña" &
```

O editar el archivo de config:
```bash
nano ~/.config/code-server/config.yaml
# Busca "password:" y cámbialo
# Guarda con Ctrl+X, Y, Enter
```

---

## 📊 Persistencia de Sesión

### Antes (Remote SSH):
```
PC Oficina              PC Casa
    ↓                     ↓
VS Code 1           VS Code 2
(sesión A)          (sesión B)
Copilot: Nuevo     Copilot: ¿Dónde estábamos?
contexto ←→ Sin contexto = 40 min perdidos
```

### Después (Code-Server):
```
PC Oficina              PC Casa
    ↓                     ↓
  Browser 1            Browser 2
    ↓                     ↓
    └─────→ Servidor Debian ←─────┘
            Code-Server (único)
            Copilot: Mismo contexto
            = 0 minutos perdidos ✅
```

---

## 🆘 Troubleshooting

### "Connection refused al entrar a localhost:8080"
```bash
# Verifica que code-server está corriendo en el servidor:
ps aux | grep code-server

# Si no ves nada, reinicia:
sudo systemctl restart code-server@$USER
# O inicia manualmente:
code-server --bind-addr 0.0.0.0:8080 &
```

### "Contraseña rechazada"
- Copiar bien la contraseña (sin espacios)
- Si la olvidaste, mata el proceso y reinicia:
  ```bash
  pkill code-server
  code-server --bind-addr 0.0.0.0:8080 &
  ```

### "No puedo acceder desde afuera de la LAN"
- Asegúrate de usar SSH tunnel: `ssh -L 8080:...`
- O exponer solo al local si estás en LAN: no cambies `bind-addr`

---

## ⚙️ Configuraciones Opcionales (Avanzado)

### Auto-inicio al reiniciar servidor
```bash
# Debian/Ubuntu systemd:
sudo systemctl enable --now code-server@$USER

# Verificar que está activo:
sudo systemctl status code-server@$USER
```

### Logs para debugging
```bash
journalctl -u code-server@$USER -f
# O si iniciaste manualmente:
code-server --bind-addr 0.0.0.0:8080 &
# (Los logs aparecen en la terminal)
```

### Cambiar puerto (si 8080 está ocupado)
```bash
code-server --bind-addr 0.0.0.0:9090 &
# Luego accede a localhost:9090
```

---

## 📝 Checklist Post-Setup

- [ ] Code-Server instalado en servidor Debian
- [ ] Systemd habilitado (opcional pero recomendado)
- [ ] Acceso desde PC oficina: `http://localhost:8080` ✅
- [ ] Acceso desde PC casa: `http://localhost:8080` ✅
- [ ] Extensión de Copilot instalada
- [ ] GitHub authentication completa
- [ ] Workspace `/opt/emerald-erp` abierto
- [ ] Terminal integrada funciona (Ctrl+`)

---

## 🚀 Beneficios Después del Setup

✅ **Mismo contexto** en ambas máquinas  
✅ **0 minutos perdidos** de contexto  
✅ **Archivos siempre sincronizados** (están en servidor)  
✅ **Puedes trabajar desde cualquier navegador** (tablet, otro PC, etc.)  
✅ **Copilot recuerda todo** tu trabajo del día anterior  
✅ **No depende de conexión local** (funciona vía SSH remoto)

---

## 📚 Referencias

- Code-Server Docs: https://coder.com/docs/code-server
- GitHub Copilot en VS Code: https://github.com/features/copilot

---

**Creado:** 2026-01-13  
**Para usar cuando llegues a casa.**

¡Que disfrutes esos 40 minutos que ahorres! 🎉
