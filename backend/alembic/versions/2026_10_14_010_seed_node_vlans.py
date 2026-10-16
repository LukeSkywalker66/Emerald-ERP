"""seed nodes.vlans (diccionario nodo → VLANs)

Revision ID: 2026_10_14_010
Revises: 2026_10_12_009
Create Date: 2026-10-14 00:00:00.000000

Pobla `nodes.vlans` con las VLANs asociadas a cada nodo. Se mapea por
`ip_address` (clave estable) porque los nombres de nodo varían entre
sincronizaciones. Idempotente: solo UPDATE de una columna existente.

Valores (separados por coma, sin prefijo 'vlan'):
- 138.59.172.169 → 300         (nodo2 169 — olt-tplink-loscerrillos)
- 138.59.175.17  → 100,300     (Fibra_Públicas — Huawei vlan100 + ZTE C600 vlan300)
- 138.59.175.5   → 200         (Fibra_Privadas — Huawei vlan200)
- 138.59.175.11  → 500,501     (San José — olt San José vlan500 + vlan501)
- 138.59.175.7   → 120         (Villa Dolores2 — vlan120)
- 138.59.172.4   → 700         (LT2 / ZTE C620 las tapias — vlan700)
- 138.59.175.19  → 300         (R19 San Vicente — olt-tplink-SanVicente)
- 138.59.175.6   → 140,700     (R6 ex 88 — Villa Dolores2 vlan140 + ZTE C600 vlan700)

No mapeados (quedan NULL): 138.59.175.13 (nodo3 205) y Los Hornillos
(200.105.111.162, nodo no presente en la tabla `nodes`).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_14_010'
down_revision: Union[str, Sequence[str], None] = '2026_10_12_009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NODE_VLANS = {
    "138.59.172.169": "300",
    "138.59.175.17": "100,300",
    "138.59.175.5": "200",
    "138.59.175.11": "500,501",
    "138.59.175.7": "120",
    "138.59.172.4": "700",
    "138.59.175.19": "300",
    "138.59.175.6": "140,700",
}


def upgrade() -> None:
    bind = op.get_bind()
    for ip, vlans in NODE_VLANS.items():
        bind.execute(
            sa.text("UPDATE nodes SET vlans = :vlans WHERE ip_address = :ip"),
            {"vlans": vlans, "ip": ip},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for ip in NODE_VLANS:
        bind.execute(
            sa.text("UPDATE nodes SET vlans = NULL WHERE ip_address = :ip"),
            {"ip": ip},
        )
