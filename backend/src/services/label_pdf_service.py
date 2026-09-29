"""
Servicio de generación de PDF de etiquetas de unidades trazables.

Dibuja los códigos de barras como geometría VECTORIAL exacta (rectángulos en mm)
dentro de un PDF A4. Al ser vectorial, el PDF se imprime 1:1 en cualquier
impresora sin el reescalado/antialiasing del navegador, que era la causa del
bug "guion -> apóstrofe" al escanear.
"""
from __future__ import annotations

from typing import List, Tuple

# Zona de silencio exigida por el estándar Code 128 (10 módulos por lado).
QUIET_ZONE_MODULES = 10


def _bar_runs(binary: str) -> List[Tuple[str, int]]:
    """Convierte la secuencia de módulos ('1'=barra, '0'=espacio) en runs."""
    runs: List[Tuple[str, int]] = []
    i = 0
    while i < len(binary):
        ch = binary[i]
        j = i
        while j < len(binary) and binary[j] == ch:
            j += 1
        runs.append((ch, j - i))
        i = j
    return runs


def build_labels_pdf(
    serial_numbers: List[str],
    columns: int = 2,
    module_mm: float = 0.33,
    barcode_height_mm: float = 15.0,
) -> bytes:
    """
    Construye un PDF A4 con etiquetas de código de barras CODE128.

    :param serial_numbers: códigos a etiquetar (ej. ["DRP-2026-00001", ...]).
    :param columns: cantidad de etiquetas por fila (2 recomendado).
    :param module_mm: ancho de cada módulo en mm (0.33 mm = 13 mil, robusto).
    :param barcode_height_mm: alto de las barras.
    :return: bytes del PDF.
    """
    import barcode
    from fpdf import FPDF

    page_w, page_h = 210.0, 297.0  # A4 portrait
    margin = 10.0
    gap = 6.0
    label_padding_top = 3.0
    text_gap = 5.0

    label_w = (page_w - 2 * margin - (columns - 1) * gap) / columns
    label_h = label_padding_top + barcode_height_mm + text_gap + 6.0

    code128 = barcode.get_barcode_class("code128")

    pdf = FPDF(unit="mm", format="A4")
    pdf.set_auto_page_break(auto=False)
    pdf.set_margins(0, 0, 0)
    pdf.add_page()

    rows_per_page = int((page_h - 2 * margin) // label_h)
    per_page = columns * rows_per_page

    for idx, sn in enumerate(serial_numbers):
        page_index = idx // per_page
        pos_in_page = idx % per_page
        row = pos_in_page // columns
        col = pos_in_page % columns

        while pdf.page_no() < page_index + 1:
            pdf.add_page()

        x0 = margin + col * (label_w + gap)
        y0 = margin + row * label_h

        binary = code128(sn).build()[0]
        total_modules = len(binary) + 2 * QUIET_ZONE_MODULES
        barcode_w = total_modules * module_mm

        # El código debe caber en la celda; si no, se reduce el módulo.
        effective_module = module_mm
        if barcode_w > label_w - 4.0:
            effective_module = (label_w - 4.0) / total_modules
            barcode_w = label_w - 4.0

        bx = x0 + (label_w - barcode_w) / 2.0
        by = y0 + label_padding_top

        # Dibujar barras negras (solo runs '1').
        pdf.set_fill_color(0, 0, 0)
        cursor = QUIET_ZONE_MODULES * effective_module
        for ch, length in _bar_runs(binary):
            if ch == "1":
                pdf.rect(
                    bx + cursor,
                    by,
                    length * effective_module,
                    barcode_height_mm,
                    style="F",
                )
            cursor += length * effective_module

        # Texto humano (Courier, monospace).
        pdf.set_font("Courier", "B", 11)
        pdf.set_text_color(0, 0, 0)
        text_w = pdf.get_string_width(sn)
        pdf.text(x0 + (label_w - text_w) / 2.0, by + barcode_height_mm + text_gap, sn)

    return bytes(pdf.output())
