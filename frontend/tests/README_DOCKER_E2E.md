# CHECKPOINT E2E - 2026-01-19

## Estado actual
- Entorno E2E sectorizado con Playwright sobre node:20-bookworm, sin dependencias globales ni Alpine.
- Todos los tests y helpers están en `frontend/tests`.
- El archivo `kanban.e2e.spec.ts` está presente y listo para ejecutar.
- Se agregó `playwright.config.ts` con `testDir: '.'` para detección universal de tests.
- El Dockerfile sectorizado es `e2e.Dockerfile` y debe usarse como tal.
- Último checkpoint: `CHECKPOINT_2026-01-19_E2E_SECTOR_NASA.md`

## Instrucciones para continuar (VSCode, cualquier máquina)

1. **Abrir VSCode en la carpeta del repo**

2. **Build del contenedor E2E sectorizado:**
   ```sh
   cd frontend/tests
   docker build -f e2e.Dockerfile -t emerald-erp-e2e .
   ```

3. **Ejecutar los tests E2E:**
   ```sh
   docker run --rm --network=host emerald-erp-e2e npx playwright test --reporter=list
   ```
   > Si necesitas correr un test específico:
   ```sh
   docker run --rm --network=host emerald-erp-e2e npx playwright test kanban.e2e.spec.ts --reporter=list
   ```

4. **Debug:**
   - Si no detecta tests, verifica que el contexto de build sea `frontend/tests` y que el archivo esté presente.
   - Puedes listar archivos dentro del contenedor:
     ```sh
     docker run --rm emerald-erp-e2e ls -l
     ```

5. **Para modificar tests o helpers:**
   - Edita en `frontend/tests/` y repite el build.

---
**IMPORTANTE:**
- No uses `docker-compose` para E2E sectorizado, usa build y run directos para asegurar el contexto.
- El entorno QA es 100% reproducible y aislado.

---
"Consultando al Orquestador..."  
Emerald ERP QA Automation
# Emerald ERP - E2E Playwright Sectorizado (Nivel NASA)

## Arquitectura
- **Base:** node:20-bookworm (Debian, máxima compatibilidad binaria)
- **Sectorización:** Todas las dependencias E2E y navegadores se definen en `frontend/tests/package.json`.
- **Aislamiento:** Cero dependencias de imágenes Playwright globales ni Alpine.
- **Reproducibilidad:** Si cambias la versión de Playwright en el JSON, el contenedor baja los navegadores correctos automáticamente.

## Uso rápido

### 1. Construir el entorno E2E sectorizado
```sh
docker compose -f docker-compose.yml -f frontend/tests/docker-compose.e2e.yml build e2e
```

### 2. Ejecutar todos los tests E2E
```sh
docker compose -f docker-compose.yml -f frontend/tests/docker-compose.e2e.yml run --rm e2e
```

### 3. Ejecutar un test específico
```sh
docker compose -f docker-compose.yml -f frontend/tests/docker-compose.e2e.yml run --rm e2e npx playwright test kanban.e2e.spec.ts --reporter=list
```

## Flujo de automatización
- El Dockerfile ejecuta automáticamente todos los archivos `*.e2e.spec.ts` al iniciar el contenedor.
- Puedes sobreescribir el comando en docker-compose para correr tests específicos.
- Los navegadores se instalan según la versión de Playwright declarada en el package.json sectorizado.

## Buenas prácticas
- Mantén los tests E2E y helpers solo en `frontend/tests/`.
- No mezcles dependencias de test con producción.
- Si agregas nuevos tests, solo reconstruye y ejecuta el contenedor: todo se detecta automáticamente.

---
"Consultando al Orquestador..."  
Emerald ERP QA Automation
# QA: Ejecución de tests E2E Playwright en Docker

## ¿Qué hace este setup?
- Permite correr los tests E2E de Playwright en un contenedor aislado (`e2e`), sin ensuciar el entorno local ni productivo.
- El servicio `e2e` depende de `frontend` y `backend` y solo se ejecuta en entornos de QA/desarrollo.
- No expone puertos ni recursos a producción.
- **Aislamiento nivel NASA:** Las dependencias de test están solo en `/frontend/tests/package.json` y nunca viajan a producción.
- El Dockerfile de producción solo instala dependencias productivas (`npm ci --only=production`).

## ¿Cómo se usa?

1. Levanta el stack normal (sin e2e):
   ```bash
   docker compose up -d
   ```
2. Corre los tests E2E en el contenedor (desde la raíz del proyecto):
   ```bash
   docker compose -f docker-compose.yml -f frontend/tests/docker-compose.e2e.yml up --build e2e
   ```
   (Esto solo ejecuta los tests y el contenedor se apaga al terminar)

## Buenas prácticas
- No incluir el servicio `e2e` en despliegues productivos.
- Mantener helpers y scripts de test fuera del build final.
- Documentar cualquier helper/credencial de testing.
- Ejecutar siempre el comando desde la raíz del proyecto para evitar errores de ruta.

---
**Emerald ERP QA / Enero 2026**
