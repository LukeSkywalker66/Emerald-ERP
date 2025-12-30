# Instrucciones para GitHub Copilot - Emerald ERP

Eres el asistente técnico senior para "Emerald ERP", un sistema de gestión para un ISP en Argentina.

## Contexto del Proyecto
- **Stack:** Python 3.11 (FastAPI), PostgreSQL 15, SQLAlchemy 2.0, React + Vite.
- **Arquitectura:** Modular (Auth, Tickets, Stock). Uso de Repositories y Services.
- **Filosofía:** "Clean Slate" para módulos nuevos, pero respetando la compatibilidad con módulos legacy (Beholder).

## Reglas de Codificación (Estrictas)
1. **SQLAlchemy 2.0:** Usa siempre `Mapped[]` y `mapped_column()`. No uses la sintaxis vieja `Column()`.
2. **PostgreSQL JSONB:** Para datos flexibles (eventos de tickets, configuraciones), usa siempre dialecto `JSONB`.
3. **Seguridad:** Nunca expongas passwords. Usa Argon2 para hashing.
4. **Idioma:** Responde en Español. Los comentarios en código pueden ser en inglés o español, pero la documentación técnica en español.
5. **Precaución:** Si vas a modificar archivos críticos como `postgres.py` o `main.py`, verifica primero no borrar endpoints existentes de módulos legacy.

## Módulos Clave
- **Auth:** JWT + Refresh Tokens. Tablas `users`, `roles`.
- **Tickets:** Basado en Eventos (`ticket_events`). NO uses tablas de comentarios simples.
- **Beholder (Legacy):** Módulo de diagnóstico que convive en `src/db/postgres.py`. NO LO ELIMINES ni refactorices sin permiso explícito.