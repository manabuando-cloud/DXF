"""Top-level conversion entry point."""

from __future__ import annotations

import shutil
import tempfile
import time
from pathlib import Path

from . import cleanup
from .dwg import dwg_to_dxf
from .errors import ConversionError
from .jww import jww_to_dxf
from .pdf import PdfOptions, dxf_to_pdf, load_dxf

SUPPORTED = {".dwg", ".dxf", ".jww"}


def to_dxf(src: Path, dst: Path, warnings: list[str]) -> None:
    ext = src.suffix.lower()
    if ext == ".dxf":
        shutil.copyfile(src, dst)
    elif ext == ".jww":
        jww_to_dxf(src, dst, warnings)
    elif ext == ".dwg":
        dwg_to_dxf(src, dst, warnings)
    else:
        raise ConversionError(f"対応していないファイル形式です: {ext}")


def convert(src: Path, target: str, dst: Path, pdf_options: PdfOptions | None = None) -> dict:
    started = time.monotonic()
    warnings: list[str] = []
    if src.suffix.lower() not in SUPPORTED:
        raise ConversionError(f"対応していないファイル形式です: {src.suffix}")
    if not src.exists():
        raise ConversionError("入力ファイルが見つかりません。")

    dst.parent.mkdir(parents=True, exist_ok=True)
    result: dict = {}

    with tempfile.TemporaryDirectory(prefix="cadconv-") as tmp:
        dxf_path = Path(tmp) / (src.stem + ".dxf")
        to_dxf(src, dxf_path, warnings)

        if target == "pdf":
            result = dxf_to_pdf(dxf_path, dst, pdf_options or PdfOptions(), warnings)
        elif target == "dxf":
            if src.suffix.lower() == ".dxf":
                shutil.copyfile(src, dst)
            else:
                doc = load_dxf(dxf_path, warnings)
                cleanup.audit(doc, warnings)
                doc.saveas(dst)
        else:
            raise ConversionError(f"未対応の出力形式です: {target}")

    return {
        "ok": True,
        "output": str(dst),
        "size": dst.stat().st_size,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
        "warnings": warnings,
        **result,
    }
