"""Japanese-capable font setup for PDF rendering.

DWG/DXF files usually reference SHX fonts (and big fonts for Japanese)
that aren't available on the server. Every text style is pointed at one
CJK TrueType font so Japanese annotations always render.
"""

from __future__ import annotations

import os
from pathlib import Path

CANDIDATES = [
    "/usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
    "C:/Windows/Fonts/msgothic.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
]

_configured: str | None = None


def cjk_font_path() -> Path | None:
    explicit = os.environ.get("CADCONV_FONT")
    if explicit and Path(explicit).exists():
        return Path(explicit)
    for candidate in CANDIDATES:
        if Path(candidate).exists():
            return Path(candidate)
    return None


def configure() -> str | None:
    """Register the CJK font with ezdxf and return its file name."""
    global _configured
    if _configured is not None:
        return _configured or None
    path = cjk_font_path()
    if not path:
        _configured = ""
        return None
    from ezdxf.fonts import fonts

    manager = fonts.font_manager
    if not manager.has_font(path.name):
        manager.scan_folder(path.parent)
    manager._fallback_font_name = path.name  # noqa: SLF001 - no public setter
    _configured = path.name
    return path.name


def apply_to_document(doc) -> None:
    name = configure()
    if not name:
        return
    for style in doc.styles:
        style.dxf.font = name
        if style.dxf.hasattr("bigfont"):
            style.dxf.discard("bigfont")
