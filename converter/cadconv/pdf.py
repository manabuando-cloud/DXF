"""DXF -> print-ready vector PDF (fit to page)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import ezdxf
from ezdxf import bbox, recover
from ezdxf.addons.drawing import Frontend, RenderContext, layout
from ezdxf.addons.drawing import pymupdf as pdf_backend
from ezdxf.addons.drawing.config import (
    BackgroundPolicy,
    ColorPolicy,
    Configuration,
    LineweightPolicy,
)

from . import cleanup, fonts
from .errors import ConversionError

PAPER_MM = {
    "A0": (841, 1189),
    "A1": (594, 841),
    "A2": (420, 594),
    "A3": (297, 420),
    "A4": (210, 297),
    "B4": (257, 364),
    "B5": (182, 257),
    "LETTER": (216, 279),
}


@dataclass
class PdfOptions:
    paper: str = "A4"
    orientation: str = "auto"  # auto | landscape | portrait
    color: str = "mono"        # mono | color
    margin_mm: float = 10.0
    layouts: str = "model"     # model | all


def load_dxf(path: Path, warnings: list[str]):
    """Read a DXF, falling back to ezdxf's recover mode.

    DXF written by LibreDWG or older CAD tools often has broken handles or
    tables that the strict reader rejects but recover mode can repair.
    """
    try:
        return ezdxf.readfile(path)
    except IOError as exc:
        raise ConversionError(f"DXFファイルを読み込めませんでした: {exc}")
    except Exception:  # noqa: BLE001 - any strict-mode failure -> try recover
        pass
    try:
        doc, auditor = recover.readfile(path)
    except Exception as exc:  # noqa: BLE001
        raise ConversionError(f"DXFファイルを読み込めませんでした: {exc}")
    if auditor.has_errors:
        warnings.append("壊れたDXFを修復して読み込みました。")
    return doc


def dxf_to_pdf(src: Path, dst: Path, opts: PdfOptions, warnings: list[str]) -> dict:
    doc = load_dxf(src, warnings)
    cleanup.remove_empty_text(doc)
    fonts.apply_to_document(doc)

    targets = [doc.modelspace()]
    if opts.layouts == "all":
        paper = [lay for lay in doc.layouts if not lay.is_modelspace and _has_content(lay)]
        if paper:
            targets = paper

    pages: list[bytes] = []
    used_paper = None
    for target in targets:
        extents = bbox.extents(target, fast=True)
        if not extents.has_data:
            continue
        page, orientation = _make_page(opts, extents.size.x, extents.size.y)
        used_paper = f"{opts.paper.upper()} {orientation}"
        pages.append(_render(doc, target, page, opts))

    if not pages:
        raise ConversionError("図面に印刷できる図形がありません。")

    import pymupdf

    out = pymupdf.open()
    for data in pages:
        with pymupdf.open("pdf", data) as part:
            out.insert_pdf(part)
    out.set_metadata({"title": src.stem, "creator": "CAD Converter"})
    out.save(dst, garbage=3, deflate=True)
    count = out.page_count
    out.close()
    return {"pages": count, "paper": used_paper}


def _has_content(lay) -> bool:
    return any(e.dxftype() != "VIEWPORT" for e in lay)


def _make_page(opts: PdfOptions, width: float, height: float):
    short, long_ = PAPER_MM.get(opts.paper.upper(), PAPER_MM["A4"])
    orientation = opts.orientation
    if orientation == "auto":
        orientation = "landscape" if width >= height else "portrait"
    w, h = (long_, short) if orientation == "landscape" else (short, long_)
    m = opts.margin_mm
    return layout.Page(w, h, layout.Units.mm, margins=layout.Margins(m, m, m, m)), orientation


def _render(doc, target, page, opts: PdfOptions) -> bytes:
    config = Configuration(
        color_policy=ColorPolicy.BLACK if opts.color == "mono" else ColorPolicy.COLOR,
        background_policy=BackgroundPolicy.WHITE,
        lineweight_policy=LineweightPolicy.ABSOLUTE,
        lineweight_scaling=1.0,
    )
    ctx = RenderContext(doc)
    backend = pdf_backend.PyMuPdfBackend()
    Frontend(ctx, backend, config=config).draw_layout(target, finalize=True)
    settings = layout.Settings(fit_page=True, page_alignment=layout.PageAlignment.MIDDLE_CENTER)
    return backend.get_pdf_bytes(page, settings=settings)
