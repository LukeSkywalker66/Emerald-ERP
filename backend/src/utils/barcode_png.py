"""
Encoder PNG 1-bit (blanco/negro) sin dependencias externas.

Se usa para rasterizar códigos de barras con geometría exacta:
cada módulo ocupa un número entero de píxeles y no hay antialiasing,
lo que garantiza que la pistola decodifique sin ambigüedades.

Solo implementa lo necesario para imágenes en escala de grises de 1 bit
(color type 0), que es suficiente para un código de barras.
"""
from __future__ import annotations

import struct
import zlib

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _chunk(tag: bytes, data: bytes) -> bytes:
    """Arma un chunk PNG con su longitud y CRC32."""
    payload = tag + data
    return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload))


def _make_phys_chunk(dpi: int) -> bytes:
    """Chunk pHYs: resolución física en píxeles por metro (unit=1)."""
    if dpi <= 0:
        return b""
    ppm = int(round(dpi / 0.0254))
    return _chunk(b"pHYs", struct.pack(">IIB", ppm, ppm, 1))


def encode_1bit_png(
    width: int,
    height: int,
    row: bytes,
    dpi: int = 0,
) -> bytes:
    """
    Genera un PNG en escala de grises de 1 bit.

    :param width:  ancho en píxeles.
    :param height: alto en píxeles.
    :param row:    bytes de UNA fila empaquetada (MSB primero).
                   Bit 0 = negro, bit 1 = blanco.
    :param dpi:    DPI físico a declarar en el chunk pHYs (0 = omitir).
    :return:       bytes del archivo PNG.
    """
    if width <= 0 or height <= 0:
        raise ValueError("width y height deben ser positivos")

    expected_row_bytes = (width + 7) // 8
    if len(row) != expected_row_bytes:
        raise ValueError(
            f"row tiene {len(row)} bytes, se esperan {expected_row_bytes} "
            f"para width={width}"
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 1, 0, 0, 0, 0)

    # Cada scanline lleva 1 byte de filtro (0 = None) + los bytes empaquetados.
    raw = b"".join(b"\x00" + row for _ in range(height))
    idat = zlib.compress(raw, level=9)

    chunks = [
        _chunk(b"IHDR", ihdr),
        _make_phys_chunk(dpi),
        _chunk(b"IDAT", idat),
        _chunk(b"IEND", b""),
    ]

    return _PNG_SIGNATURE + b"".join(chunks)
