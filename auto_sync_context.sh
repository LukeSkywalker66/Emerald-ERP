#!/bin/bash

# Configuración
# Usa la carpeta docs relativa a este script para evitar rutas hardcodeadas del repo viejo.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARPETA="$SCRIPT_DIR/docs"
DESTINO="gdrive:Lucas_Brain_Center/Technical_Docs/Emerald_ERP_Docs"

echo "👁️  Vigilando carpeta: $CARPETA para cambios en documentación..."

# Vigilamos la carpeta completa (-r si quisieras recursivo, pero acá es plano)
# -e close_write: cuando terminan de escribir
# -e moved_to: por si el editor mueve un archivo temporal (VS Code hace esto)
inotifywait -m -e close_write -e moved_to --format "%f" "$CARPETA" | while read ARCHIVO; do

    # Filtramos: solo sincronizamos documentos críticos
    if [[ "$ARCHIVO" == "MASTER_CONTEXT.md" || "$ARCHIVO" == "AI_ARCHITECT_CONTEXT.md" || "$ARCHIVO" == "BASE_DATOS.md" || "$ARCHIVO" == "ROADMAP.md" || "$ARCHIVO" == "MAPA_NAVEGACION_FRONTEND.md" ]]; then
        
        echo "♻️  Detectado cambio en: $ARCHIVO"
        
        # Pequeña pausa de seguridad (0.5s) para asegurar que el disco terminó de escribir
        sleep 0.5
        
        # Subimos
        rclone copy "$CARPETA/$ARCHIVO" "$DESTINO"
        
        echo "✅  Sincronizado a las $(date)"
    fi
    
done