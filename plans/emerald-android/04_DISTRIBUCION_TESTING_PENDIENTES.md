# 04 — Distribución, Configuración dev→producción, Testing y Decisiones Pendientes

## 1. Distribución de la app

### 1.1 Opciones gratuitas

| Canal | Costo | Ventajas | Desventajas | Uso recomendado |
|-------|-------|----------|-------------|-----------------|
| **Google Play Console** | USD 25 **por única vez** (cuenta de desarrollador) | Actualizaciones automáticas, testing tracks, firma gestionada, reputación, telemetría de crash (Crashlytics) | Fee inicial único | **Recomendado principal** |
| **Play Internal Testing / Closed Testing** | Gratis (dentro de la cuenta ya pagada) | Distribución a testers internos sin publicación pública | Límites de testers por track | Pruebas internas y beta |
| **APK sideload** | Gratis | Sin trámites | Actualización manual, requiere habilitar "orígenes desconocidos", menos seguro, sin telemetría | Solo emergencias |
| **MDM/EMM** (Miradore free, Hexnode, ManageEngine) | Algunos con tier gratuito | Control de dispositivos, instalación remota, políticas de seguridad | Requiere gestionar plataforma | Si hay flota rugged |
| **F-Droid** | Gratis | Open source | Solo apps FOSS, sin servicios Google | No aplica (usa FCM) |

### 1.2 Recomendación

**Play Console (costo único USD 25) + track de Internal/Closed Testing para la beta.** Es la opción más profesional y segura: actualizaciones automáticas, firma gestionada por Google (App Signing), control de versiones y telemetría. Para una flota interna pequeña también funciona; si se necesita control de dispositivos (kiosko, bloqueo, instalación forzada), sumar un **MDM** (Miradore tiene tier gratuito).

## 2. Configuración de entornos (dev → staging → producción)

### 2.1 Build variants

| Variant | Base URL API | Firma | Firebase |
|---------|--------------|-------|----------|
| `debug` | backend local (`http://10.0.2.2:8500` en emulador o `adb reverse`) | debug keystore | proyecto Firebase dev |
| `staging` | URL staging | release keystore | proyecto Firebase staging |
| `release` | URL producción | Play App Signing | proyecto Firebase prod |

### 2.2 Conexión al backend local de Emerald

- Levantar Emerald con [`docker-compose.dev.yml`](docker-compose.dev.yml).
- **Emulador Android:** usar `http://10.0.2.2:8500` (mapea al `localhost` de la PC).
- **Dispositivo físico (tu celular):** habilitar USB debugging y ejecutar `adb reverse tcp:8500 tcp:8500` (el celular ve la API en `http://127.0.0.1:8500`) o usar la IP LAN de la PC.
- Verificar CORS y que el backend permita el origen (ya usa `allow_origins=["*"]` en [`main.py`](backend/src/main.py:278)).

### 2.3 Firebase / FCM

- Crear proyecto Firebase, descargar `google-services.json` por variant.
- Registrar SHA-1 de debug y release en Firebase para FCM.

### 2.4 Firma y secretos

- **Dev:** keystore debug de Android Studio (automático).
- **Producción:** Play App Signing (Google gestiona la clave de subida); guardar credenciales en un gestor de secretos, nunca en el repo.

### 2.5 Política dev-first

Durante el desarrollo se configura **únicamente** el build variant `debug` contra el entorno de desarrollo local. `staging` y `release` se declaran como buildTypes pero **sin URLs ni distribución** hasta tener un release estable y probado. No se exponen entornos de staging/producción hasta ese hito.

## 3. Métodos de testing

### 3.1 Desde la PC (sin celular)

- **Emulador de Android Studio:** crear AVD; simular offline con el modo avión del emulador o `adb shell svc wifi disable` / `svc data disable`.
- **Network conditioning:** proxies (Charles/mitmproxy) para simular latencia y cortes.
- **Robolectric:** tests unitarios de lógica sin dispositivo.
- **Compose UI tests + Espresso:** tests de UI locales en emulador.
- **Maestro:** flujos E2E de la app contra el backend local.

### 3.2 En tu celular (dispositivo físico)

- USB debugging o **Wireless debugging** (Android 11+) desde Android Studio.
- Instalar APK de debug directamente (Run).
- Probar cámara, escáner, GPS y notificaciones reales (cosas que el emulador simula mal).

### 3.3 E2E integrado con Emerald

- Mantener el patrón de tests E2E del proyecto (Playwright en [`frontend/tests`](frontend/tests/)) pero para la app usar **Maestro/Espresso** contra [`docker-compose.dev.yml`](docker-compose.dev.yml).
- Probar el flujo completo: asignación en web → push en app → cierre offline → sync → verificación en web.

### 3.4 CI

- GitHub Actions: build del APK/AAB en cada PR, correr unit + Compose tests, y publicar artefactos.

## 4. Decisiones pendientes (checklist abierto)

- [ ] **Canal de distribución final:** Play Console vs. MDM vs. sideload.
- [ ] **Dispositivos objetivo:** modelos, Android min SDK, ¿rugged Zebra con DataWedge o smartphones?
- [ ] **Nombre/marca/icono** de la app.
- [ ] **Licencias de mapas offline:** MapLibre + OSM (gratis) vs. Google/Mapbox (pago). Fuente y generación de MBTiles.
- [ ] **Proveedor de push:** FCM (gratis) — confirmado como estándar.
- [ ] **Política de retención offline y PII:** cuántos días se guardan datos en el device, borrado remoto.
- [ ] **Cuenta Play Console** y custodia de claves de firma.
- [ ] **Telemetría de errores:** Firebase Crashlytics (gratis) o Sentry.
- [ ] **Analytics de uso** (opcional, Firebase Analytics).
- [ ] **Beta testers:** cuántos técnicos participan del closed testing.
- [ ] **Cumplimiento normativo:** DPDP Argentina (Ley 25.326 actualizada) para datos personales de clientes en el device.
- [ ] **Estrategia de rollout:** feature flags para activar extras (auto-config, OCR) sin romper la web.
- [ ] **Backup/restore** de datos locales ante cambio de dispositivo.

## 5. Respuesta directa a las preguntas

- **¿Qué forma gratuita de distribución existe?** APK sideload (gratis), MDM con tier gratuito (Miradore) y Play Internal/Closed Testing (gratis dentro de la cuenta Play Console de USD 25 única vez).
- **¿Cuál es la más segura y profesional?** **Google Play Console** con App Signing y tracks de testing. Para flota controlada, complementar con MDM.
- **¿Configuración para testeo en desarrollo y luego producción?** Build variants dev/staging/release con URLs y Firebase por ambiente; emulador (`10.0.2.2`) o celular (`adb reverse`) contra el backend local, y firma gestionada por Play en producción.
- **¿Métodos de testeo?** Emulador con simulación offline, tu celular por USB/wireless debugging, Robolectric/Compose/Espresso/Maestro, y E2E integrado contra Emerald.
- **¿Qué más falta definir?** Ver checklist de la sección 4.
