#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "[ERROR] No se encontro python del venv en ${PYTHON_BIN}"
  echo "        Activa/crea el entorno virtual antes de correr este check."
  exit 1
fi

echo "============================================================"
echo "Pre-Deploy Check - Emerald ERP"
echo "============================================================"
echo "[1/2] Ejecutando regresion Fase B (Ticket -> OT)..."
"${PYTHON_BIN}" -m pytest -q "${ROOT_DIR}/test/test_phase_b_ot_creation_integration.py"

echo "[2/2] Compilando frontend (Vite build)..."
(
  cd "${ROOT_DIR}/frontend"
  npm run build
)

echo "============================================================"
echo "[OK] Pre-deploy check completado sin errores"
echo "============================================================"
