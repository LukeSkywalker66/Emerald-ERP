🏛️ EMERALD ERP: DEFINICIÓN DE ARQUITECTURA (V2)
OBJETIVO: Sistema unificado para ISP que gestiona Operación Técnica, Comercial y de Red.

1. ESTRUCTURA DE NAVEGACIÓN (Menú Lateral)
📊 Dashboard: KPIs gerenciales, estado general del ISP.

🎫 Mesa de Ayuda (Tickets): Gestión de incidentes y solicitudes de Clientes.

📅 Coordinación: (Ex-Planificación). Calendario de asignación de recursos. Convergencia de OTs de clientes y proyectos de red.

🌐 Infraestructura: Gestión de Nodos, Torres y Fibra. Genera OTs internas (mantenimiento/expansión).

🛠️ Mis Tareas (Vista Técnico): Interfaz simplificada (Mobile First) para la ejecución de OTs en calle.

📦 Depósito: Gestión de Stock Central y Stock por Móvil (Pañol).

⚙️ Ajustes: Usuarios, Roles, Zonas.

2. FLUJOS CORE Y RELACIONES
A. El Flujo de Trabajo (La OT es la unidad):

Origen 1 (Cliente): Mesa de Ayuda -> Ticket -> Genera OT (Tipo: Service/Instalación).

Origen 2 (Red): Infraestructura -> Proyecto/Incidente -> Genera OT (Tipo: Mantenimiento/Obra).

Destino: Ambas OTs caen en la bolsa de "Pendientes" del módulo Coordinación.

B. Coordinación y Recursos:

El Coordinador asigna OTs a un Móvil (Vehículo + Técnicos) en un bloque horario.

El sistema valida conflictos de agenda.

C. Ejecución y Stock:

El Técnico accede a "Mis Tareas" desde su celular.

Ve tarjetas simples: "Ir a tal dirección", "Hacer tal cosa".

Al cerrar la OT, carga materiales.

Lógica de Inventario: El material se descuenta del stock del Móvil asignado, no del depósito central.

3. UX/UI GUIDELINES
Single App: No hay app separada para técnicos. Es la misma web, pero con diseño responsivo que adapta la vista según el Rol.

Mesa de Ayuda: Optimizada para Desktop (alta densidad de datos, tablas, historial).

Mis Tareas: Optimizada para Móvil (botones grandes, flujos lineales, poco texto).

⏸️ Estado Actual:
Estamos finalizando la Integración del Módulo de Tickets (Mesa de Ayuda).

Copilot está generando los archivos tickets_v2.py (Backend) y tickets.service.js (Frontend).

El objetivo inmediato es lograr crear un ticket real, que se guarde en la BD, y verlo en la lista.

Una vez logrado esto, avanzamos al diseño de la Orden de Trabajo (OT).