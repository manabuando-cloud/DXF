"""Repairs that keep real-world drawings from breaking fit-to-page printing."""

from __future__ import annotations


def remove_empty_text(doc) -> int:
    """Blank TEXT/MTEXT entities still count toward the drawing extents."""
    removed = 0
    for layout in doc.layouts:
        for entity in list(layout.query("TEXT MTEXT ATTDEF")):
            if entity.dxftype() == "MTEXT":
                content = entity.plain_text()
            else:
                content = entity.dxf.get("text", "")
            if not content or not content.strip():
                layout.delete_entity(entity)
                removed += 1
    return removed


def audit(doc, warnings: list[str]) -> None:
    auditor = doc.audit()
    if auditor.has_errors:
        warnings.append(f"図面の構造エラーを{len(auditor.errors)}件検出しました（可能な範囲で修復済み）。")
