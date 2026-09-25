# cadconv — CAD drawing converter

Python package used by the Laravel app (`App\Services\DrawingConverter`) to
convert DWG / DXF / JWW drawings.

```bash
python -m cadconv INPUT --to pdf|dxf --out OUTPUT \
    [--paper A4|A3|A2|A1|A0|B4|B5|LETTER] [--orientation auto|landscape|portrait] \
    [--color mono|color] [--layouts model|all] [--margin 10]
```

It always prints exactly one JSON line on stdout:

```json
{"ok": true, "output": "...", "size": 5337, "elapsed_ms": 140, "warnings": ["..."], "pages": 1, "paper": "A4 landscape"}
{"ok": false, "error": "DWGファイルを読み込めませんでした。"}
```

Exit codes: `0` success, `1` user-facing conversion error, `2` unexpected failure.

## Pipeline

| Input | Step 1 (→ DXF) | Step 2 |
| --- | --- | --- |
| `.dxf` | copy | PDF: ezdxf drawing add-on → PyMuPDF vector PDF, fit to page |
| `.dwg` | ODA File Converter if installed, else LibreDWG `dwg2dxf` (null handles stripped) | same |
| `.jww` | `jww2jif` → JIF (JSON lines) → ezdxf document | same |

All text styles are pointed at one CJK TrueType font before rendering because
the SHX / big fonts referenced by real drawings are never on the server.

## External tools

Looked up in this order: the `CADCONV_*` environment variable, `converter/bin/`,
`converter/native/jww2jif/`, then `PATH`.

| Env var | Tool |
| --- | --- |
| `CADCONV_DWG2DXF` | LibreDWG `dwg2dxf` |
| `CADCONV_ODA` | ODA File Converter (optional, better linetype fidelity) |
| `CADCONV_JWW2JIF` | `jww2jif` (build with `native/jww2jif/build.sh`) |
| `CADCONV_FONT` | CJK font file (defaults to IPAex Gothic / Noto Sans CJK if present) |

## JIF (JWW Intermediate Format)

```json
{"t":"layer","name":"0-0"}
{"t":"line","layer":"0-0","color":4,"width":1,"ltype":"CONTINUOUS","x1":0,"y1":0,"x2":400,"y2":0}
{"t":"circle","layer":"0-0","color":4,"cx":200,"cy":125,"r":50}
{"t":"arc","layer":"0-0","color":4,"cx":320,"cy":125,"r":30,"a1":0,"a2":90}
{"t":"text","layer":"0-1","color":4,"ipx":20,"ipy":20,"height":10,"angle":0,"text_b64":"jYeU1IFG..."}
```

`text_b64` is the raw Shift-JIS bytes from the file, decoded as cp932 in Python.

## Tests

```bash
native/jww2jif/build.sh     # optional: enables the JWW end-to-end test
python -m pytest -q
```

`native/jww2jif/make_sample_jww.cpp` writes a small .jww with jwwlib's own
writer so the reader path can be tested without shipping customer drawings.
