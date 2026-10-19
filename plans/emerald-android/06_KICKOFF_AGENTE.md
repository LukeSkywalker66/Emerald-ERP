# 06 — Kickoff: Arrancar el Proyecto en Blanco

Guía de arranque para iniciar la app Android desde un repositorio vacío, usando esta documentación como fuente de verdad.

## 1. ¿Es suficiente la documentación?

Sí. Los documentos 01–05 más el plan general alcanzan para iniciar el proyecto desde cero. La app puede desarrollarse íntegramente contra los **endpoints existentes** de Emerald (cubren todo el flujo del técnico); los endpoints nuevos (sync incremental, presigned uploads, FCM) se documentan en el doc 03 y se pueden **mockear en el device** hasta implementarlos en el backend.

## 2. Prerrequisitos

- Android Studio reciente (Ladybug+) y JDK 17.
- SDK Android con min SDK definido (sugerido API 28+).
- Repo Git separado `emerald-android` (ver doc 05).
- Backend Emerald local levantado con [`docker-compose.dev.yml`](docker-compose.dev.yml).

## 3. Política de entornos: solo DEV hasta release estable

- Configurar **únicamente** el build variant `debug` apuntando al entorno de desarrollo local.
- `staging` y `release` se declaran como buildTypes, pero **sin URLs ni distribución** hasta tener un release estable y probado.
- Nada de staging/producción en el código ni en CI durante el desarrollo.

## 4. Orden de arranque (primer slice vertical)

1. Scaffold Gradle (Kotlin DSL + version catalog) + Compose + Hilt + MVVM.
2. Build variants `debug`/`staging`/`release` (solo `debug` cableado).
3. Retrofit/OkHttp + interceptor de auth (login/refresh/me) + kotlinx.serialization.
4. Room + SQLCipher + DataStore + Keystore.
5. Login → agenda (`my-schedule`) → detalle (`GET /{id}`) en modo lectura, con Room como fuente de verdad.
6. Luego Outbox (escrituras offline) y cierre con fotos.

## 5. Qué usar real vs. mock

| Capa | Decisión |
|------|----------|
| Auth, agenda, listado, detalle, iniciar, materiales, cierre, fotos, recovery, notas | **Reales** contra endpoints existentes |
| Sync incremental, presigned uploads, FCM, `work-orders/meta` | **Mock local** hasta implementar en Emerald (doc 03) |

## 6. Criterio de done del kickoff

- Login + agenda + detalle funcionando contra el backend dev local.
- Datos persistidos en Room y UI legible sin red (modo avión).
- Build `debug` instalable en emulador y en celular físico.

## 7. Continuación

Tras el kickoff, seguir la lista de tareas del plan general (fases 0→6 de [`plans/PLAN_APP_ANDROID_TECNICOS_OT.md`](plans/PLAN_APP_ANDROID_TECNICOS_OT.md)).
