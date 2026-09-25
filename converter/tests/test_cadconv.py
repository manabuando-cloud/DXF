import base64
import json
import shutil
import subprocess
from pathlib import Path

import ezdxf
import pytest

from cadconv import tools
from cadconv.__main__ import main
from cadconv.convert import convert
from cadconv.dwg import strip_null_handles
from cadconv.errors import ConversionError
from cadconv.jww import build_dxf_from_jif, decode_text, is_internal_setting_text
from cadconv.pdf import PdfOptions

NATIVE = Path(__file__).resolve().parents[1] / "native" / "jww2jif"


def b64_sjis(text: str) -> str:
    return base64.b64encode(text.encode("cp932")).decode()


@pytest.fixture
def sample_dxf(tmp_path) -> Path:
    doc = ezdxf.new(setup=True)
    msp = doc.modelspace()
    msp.add_lwpolyline([(0, 0), (400, 0), (400, 250), (0, 250)], close=True)
    msp.add_circle((200, 125), 50)
    msp.add_text("合番：206（A）", height=10, dxfattribs={"insert": (20, 20)})
    msp.add_text("   ", dxfattribs={"insert": (1e6, 1e6)})  # must not affect extents
    path = tmp_path / "sample.dxf"
    doc.saveas(path)
    return path


def test_decode_shift_jis_text():
    assert decode_text(b64_sjis("φ10-2")) == "φ10-2"
    assert decode_text("") == ""


@pytest.mark.parametrize("text,expected", [
    ("Printer_Orientation = 0", True),
    ("PaperSize=3", True),
    ("Scale = -1.5", True),
    ("φ10-2", False),
    ("合番：206（A）", False),
    ("R = 5 typ.", False),
])
def test_internal_setting_filter(text, expected):
    assert is_internal_setting_text(text) is expected


def test_build_dxf_from_jif():
    lines = [
        json.dumps({"t": "layer", "name": "0-0"}),
        json.dumps({"t": "line", "layer": "0-0", "color": 4, "width": 1, "ltype": "CONTINUOUS",
                    "x1": 0, "y1": 0, "x2": 10, "y2": 0}),
        json.dumps({"t": "arc", "layer": "0-0", "color": 256, "cx": 0, "cy": 0, "r": 5, "a1": 0, "a2": 90}),
        json.dumps({"t": "text", "layer": "0-1", "color": 256, "ipx": 1, "ipy": 2, "height": 3,
                    "angle": 0, "text_b64": b64_sjis("合番：206（A）")}),
        json.dumps({"t": "text", "layer": "0-1", "ipx": 0, "ipy": -1000, "height": 3,
                    "angle": 0, "text_b64": b64_sjis("Printer_Orientation = 0")}),
        "garbage line",
    ]
    warnings = []
    doc = build_dxf_from_jif(lines, warnings)
    msp = doc.modelspace()
    assert [e.dxftype() for e in msp] == ["LINE", "ARC", "TEXT"]
    assert msp.query("TEXT")[0].dxf.text == "合番：206（A）"
    assert msp.query("TEXT")[0].dxf.layer == "0-1"
    assert warnings and "1件" in warnings[0]
    assert not doc.audit().has_errors


def test_empty_jif_is_an_error():
    with pytest.raises(ConversionError):
        build_dxf_from_jif([json.dumps({"t": "layer", "name": "0-0"})], [])


def test_dxf_to_pdf(sample_dxf, tmp_path):
    out = tmp_path / "out.pdf"
    result = convert(sample_dxf, "pdf", out, PdfOptions(paper="A3"))
    assert result["ok"] and result["pages"] == 1
    assert result["paper"] == "A3 landscape"
    import pymupdf

    with pymupdf.open(out) as pdf:
        page = pdf[0]
        assert abs(page.rect.width - 1190.6) < 1.5 and abs(page.rect.height - 841.9) < 1.5
        # Drawing is fit to the page, so the blank far-away text was dropped.
        box = page.get_drawings()[0]["rect"]
        assert box.width > page.rect.width * 0.8


def test_dxf_passthrough(sample_dxf, tmp_path):
    out = tmp_path / "copy.dxf"
    convert(sample_dxf, "dxf", out)
    assert out.read_bytes() == sample_dxf.read_bytes()


def test_unsupported_extension(tmp_path):
    src = tmp_path / "a.txt"
    src.write_text("x")
    with pytest.raises(ConversionError):
        convert(src, "pdf", tmp_path / "a.pdf")


def test_strip_null_handles(tmp_path):
    path = tmp_path / "h.dxf"
    path.write_bytes(b"  0\nLINE\n  5\n0\n  8\n0\n  5\nAB\n")
    assert strip_null_handles(path) == 1
    assert path.read_bytes() == b"  0\nLINE\n  8\n0\n  5\nAB\n"


def test_cli_reports_json_error(tmp_path, capsys):
    code = main([str(tmp_path / "missing.dxf"), "--to", "pdf", "--out", str(tmp_path / "x.pdf")])
    result = json.loads(capsys.readouterr().out)
    assert code == 1 and result["ok"] is False and result["error"]


@pytest.mark.skipif(not tools.jww2jif() or not shutil.which("g++"), reason="jww2jif not built")
def test_jww_end_to_end(tmp_path):
    maker = tmp_path / "make_sample_jww"
    subprocess.run(
        ["g++", "-std=c++17", "-w", f"-I{NATIVE}", f"-I{NATIVE / 'jwwlib'}", "-o", str(maker),
         str(NATIVE / "make_sample_jww.cpp"), str(NATIVE / "jwwlib" / "jwwdoc.cpp")],
        check=True,
    )
    jww = tmp_path / "206(A).jww"
    subprocess.run([str(maker), str(jww)], check=True)

    dxf = tmp_path / "out.dxf"
    result = convert(jww, "dxf", dxf)
    texts = sorted(e.dxf.text for e in ezdxf.readfile(dxf).modelspace().query("TEXT"))
    assert texts == ["φ10-2", "合番：206（Ａ）"]
    assert result["warnings"]

    pdf = tmp_path / "out.pdf"
    assert convert(jww, "pdf", pdf)["pages"] == 1


@pytest.mark.skipif(not tools.dwg2dxf() or not shutil.which("dxf2dwg"), reason="LibreDWG not installed")
def test_dwg_end_to_end(tmp_path):
    src = tmp_path / "src.dxf"
    doc = ezdxf.new("R2000")
    doc.modelspace().add_line((0, 0), (300, 200))
    doc.saveas(src)
    dwg = tmp_path / "src.dwg"
    subprocess.run(["dxf2dwg", "-y", "-o", str(dwg), str(src)], capture_output=True)
    assert convert(dwg, "pdf", tmp_path / "out.pdf")["pages"] == 1
