# Dockerfile para E2E Playwright (solo QA)
# No usar en producción

# Emerald ERP - Dockerfile sectorizado para E2E con Playwright (robusto, no Alpine)
FROM node:20-bookworm

# 1. Definir directorio de trabajo
WORKDIR /app


# 2. Copiar solo el package.json sectorizado de tests
COPY package.json ./

# 3. Instalar dependencias (Playwright y helpers locales)
RUN npm install

# 4. Instalar navegadores Playwright y todas sus dependencias del sistema
RUN npx playwright install --with-deps


# 5. Copiar el resto de los tests E2E (código fuente, specs, helpers, config)
COPY . ./

# 6. Comando por defecto: ejecuta todos los tests E2E sectorizados (*.e2e.spec.ts)
CMD ["npx", "playwright", "test", "*.e2e.spec.ts", "--reporter=list"]

WORKDIR /e2e

# Copiamos solo dependencias y tests sectorizados
# Instalamos solo dependencias de test
# Forzar resolución de módulos locales y usar npx para ejecutar Playwright
