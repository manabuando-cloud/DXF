"""DWG -> DXF using ODA File Converter (preferred) or LibreDWG's dwg2dxf."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from . import tools
from .errors import ConversionError

TIMEOUT = 180


def dwg_to_dxf(src: Path, dst: Path, warnings: list[str]) -> None:
    oda = tools.oda_converter()
    if oda:
        try:
            _via_oda(oda, src, dst)
            return
        except ConversionError as exc:
            warnings.append(f"ODA File Converter failed, falling back to LibreDWG: {exc}")

    exe = tools.dwg2dxf()
    if not exe:
        raise ConversionError("DWG変換ツール(dwg2dxf)が見つかりません。サーバー管理者に連絡してください。")

    dst.unlink(missing_ok=True)
    try:
        proc = subprocess.run(
            [exe, "-y", "-o", str(dst), str(src)],
            capture_output=True, text=True, timeout=TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        raise ConversionError("DWGの変換がタイムアウトしました。")
    # dwg2dxf exits non-zero on recoverable warnings too; trust the output file.
    if not dst.exists() or dst.stat().st_size == 0:
        detail = (proc.stderr or proc.stdout).strip().splitlines()[-1:] or [""]
        raise ConversionError(f"DWGファイルを読み込めませんでした。{detail[0]}".strip())
    strip_null_handles(dst)


def strip_null_handles(path: Path) -> int:
    """Drop `5 / 0` handle tags that LibreDWG sometimes writes.

    ezdxf refuses handle 0 even in recover mode; without the tag it simply
    assigns a fresh handle to the entity.
    """
    raw = path.read_bytes()
    newline = b"\r\n" if b"\r\n" in raw[:4096] else b"\n"
    lines = raw.split(newline)
    out: list[bytes] = []
    removed = 0
    i = 0
    while i + 1 < len(lines):
        code, value = lines[i], lines[i + 1]
        if code.strip() in (b"5", b"105") and value.strip() == b"0":
            removed += 1
        else:
            out += (code, value)
        i += 2
    out += lines[i:]
    if removed:
        path.write_bytes(newline.join(out))
    return removed


def _via_oda(exe: str, src: Path, dst: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp_in, tempfile.TemporaryDirectory() as tmp_out:
        shutil.copy(src, Path(tmp_in) / src.name)
        try:
            subprocess.run(
                [exe, tmp_in, tmp_out, "ACAD2018", "DXF", "0", "1", "*.DWG"],
                capture_output=True, timeout=TIMEOUT,
            )
        except subprocess.TimeoutExpired:
            raise ConversionError("timeout")
        produced = next(Path(tmp_out).glob("*.dxf"), None)
        if not produced:
            raise ConversionError("no output")
        shutil.move(str(produced), dst)
