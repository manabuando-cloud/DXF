"""JWW (JW_CAD) -> DXF.

`jww2jif` parses the binary .jww with LibreCAD's jwwlib and prints JIF
(newline-delimited JSON). The DXF is assembled here with ezdxf so the
normal DXF pipeline can be reused as-is.
"""

from __future__ import annotations

import base64
import json
import math
import re
import subprocess
from pathlib import Path

import ezdxf

from . import tools
from .errors import ConversionError

TIMEOUT = 120

# JW_CAD sometimes stores its own print settings ("Printer_Orientation = 0")
# as ordinary TEXT far away from the drawing, which ruins fit-to-page.
_INTERNAL_SETTING = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*\s*=\s*-?[\d.]+$")

# jwwlib pen widths are JW_CAD pen numbers; map roughly to DXF lineweights.
_LINEWEIGHTS = [-1, 13, 18, 25, 35, 50, 70, 100, 140, 200]


def decode_text(text_b64: str) -> str:
    raw = base64.b64decode(text_b64 or "")
    return raw.decode("cp932", errors="replace").replace("\x00", "").strip()


def is_internal_setting_text(text: str) -> bool:
    return bool(_INTERNAL_SETTING.match(text.strip()))


def jww_to_dxf(src: Path, dst: Path, warnings: list[str]) -> None:
    exe = tools.jww2jif()
    if not exe:
        raise ConversionError("JWW変換ツール(jww2jif)が見つかりません。サーバー管理者に連絡してください。")
    try:
        proc = subprocess.run([exe, str(src)], capture_output=True, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        raise ConversionError("JWWの変換がタイムアウトしました。")
    if proc.returncode != 0:
        raise ConversionError("JWWファイルを読み込めませんでした。ファイルが壊れていないか確認してください。")

    doc = build_dxf_from_jif(proc.stdout.decode("utf-8", errors="replace").splitlines(), warnings)
    doc.saveas(dst)


def build_dxf_from_jif(lines, warnings: list[str]) -> ezdxf.document.Drawing:
    doc = ezdxf.new("R2018", setup=True)
    doc.header["$INSUNITS"] = 4  # mm
    msp = doc.modelspace()
    skipped = 0
    count = 0

    for line in lines:
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        kind = rec.get("t")

        if kind == "layer":
            name = rec.get("name") or "0"
            if name not in doc.layers:
                doc.layers.add(name)
            continue

        attribs = _attribs(doc, rec)
        if kind == "line":
            msp.add_line((rec["x1"], rec["y1"]), (rec["x2"], rec["y2"]), dxfattribs=attribs)
        elif kind == "circle":
            if rec["r"] > 0:
                msp.add_circle((rec["cx"], rec["cy"]), rec["r"], dxfattribs=attribs)
        elif kind == "arc":
            if rec["r"] > 0:
                msp.add_arc((rec["cx"], rec["cy"]), rec["r"], rec["a1"], rec["a2"], dxfattribs=attribs)
        elif kind == "ellipse":
            ratio = rec.get("ratio") or 1.0
            major = (rec["mx"], rec["my"])
            if math.hypot(*major) == 0:
                continue
            if ratio > 1:  # DXF requires ratio <= 1: swap axes
                major = (-rec["my"] * ratio, rec["mx"] * ratio)
                ratio = 1 / ratio
            msp.add_ellipse(
                (rec["cx"], rec["cy"]), major_axis=major, ratio=ratio,
                start_param=rec.get("a1", 0.0), end_param=rec.get("a2", math.tau),
                dxfattribs=attribs,
            )
        elif kind == "point":
            msp.add_point((rec["x"], rec["y"]), dxfattribs=attribs)
        elif kind == "text":
            text = decode_text(rec.get("text_b64", ""))
            if not text:
                continue
            if is_internal_setting_text(text):
                skipped += 1
                continue
            height = rec.get("height") or 2.5
            msp.add_text(
                text,
                height=height,
                rotation=rec.get("angle", 0.0),
                dxfattribs={**attribs, "insert": (rec["ipx"], rec["ipy"]),
                            "width": rec.get("xscale") or 1.0},
            )
        else:
            continue
        count += 1

    if count == 0:
        raise ConversionError("JWWファイルに図形が見つかりませんでした。")
    if skipped:
        warnings.append(f"JW_CAD内部設定の文字列を{skipped}件除外しました。")
    return doc


def _attribs(doc, rec) -> dict:
    layer = rec.get("layer") or "0"
    if layer not in doc.layers:
        doc.layers.add(layer)
    attribs = {"layer": layer}
    color = rec.get("color")
    if isinstance(color, int) and 0 < color < 256:
        attribs["color"] = color
    width = rec.get("width")
    if isinstance(width, int) and 0 < width < len(_LINEWEIGHTS):
        attribs["lineweight"] = _LINEWEIGHTS[width]
    ltype = (rec.get("ltype") or "").upper()
    if ltype and ltype not in ("BYLAYER", "CONTINUOUS") and ltype in doc.linetypes:
        attribs["linetype"] = ltype
    return attribs
