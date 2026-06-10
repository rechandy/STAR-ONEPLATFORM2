#!/usr/bin/env python3
"""
Render docs/architecture/06-prototype-architecture.md to a PDF, with the Mermaid
diagrams rasterized to PNG (via mermaid.ink) and embedded. Pure-Python pipeline
(markdown -> HTML -> xhtml2pdf), no headless browser required.

  python docs/architecture/_md_to_pdf.py
"""
import base64
import json
import os
import re
import ssl
import sys
import tempfile
import zlib
from pathlib import Path

import httpx
import truststore
import markdown
from xhtml2pdf import pisa

HERE = Path(__file__).resolve().parent
SRC = HERE / "06-prototype-architecture.md"
OUT = HERE / "06-prototype-architecture.pdf"

CSS = """
@page { size: letter; margin: 1.6cm 1.5cm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 9.5pt; color: #0a2540; line-height: 1.45; }
h1 { font-size: 20pt; color: #0a2540; margin: 0 0 2pt 0; }
h2 { font-size: 13pt; color: #0b5cab; border-bottom: 1.5pt solid #0b5cab; padding-bottom: 2pt; margin: 16pt 0 6pt 0; }
h3 { font-size: 11pt; color: #0a2540; margin: 10pt 0 4pt 0; }
p { margin: 4pt 0; }
code { font-family: Courier, monospace; font-size: 8.5pt; background: #f1f5fa; color: #0a2540; }
strong { color: #0a2540; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0; }
th { background: #0b5cab; color: #ffffff; font-size: 8pt; text-align: left; padding: 4pt 5pt; border: 0.5pt solid #cdd7e2; }
td { font-size: 8pt; padding: 4pt 5pt; border: 0.5pt solid #cdd7e2; vertical-align: top; }
.diagram { width: 460px; margin: 6pt 0; }
.cap { color: #5b6b7b; font-size: 8pt; font-style: italic; }
hr { border: none; border-top: 0.5pt solid #d7e0ea; }
"""


def render_mermaid(diagram: str, client: httpx.Client) -> bytes:
    payload = json.dumps({"code": diagram, "mermaid": {"theme": "default"}}).encode()
    b = base64.urlsafe_b64encode(zlib.compress(payload, 9)).decode()
    r = client.get(f"https://mermaid.ink/img/pako:{b}?type=png&width=1600")
    r.raise_for_status()
    return r.content


def main() -> None:
    md_text = SRC.read_text(encoding="utf-8")
    blocks = re.findall(r"```mermaid\n(.*?)```", md_text, re.DOTALL)
    print(f"Rendering {len(blocks)} Mermaid diagrams via mermaid.ink …")

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        ctx = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        with httpx.Client(verify=ctx, timeout=httpx.Timeout(120.0)) as client:
            png_paths = []
            for i, blk in enumerate(blocks):
                png = render_mermaid(blk, client)
                p = td / f"diagram_{i}.png"
                p.write_bytes(png)
                png_paths.append(p)
                print(f"  diagram {i + 1}: {len(png) // 1024} KB")

        # Replace each ```mermaid block with a placeholder (in order), then swap
        # placeholders for <img> after the markdown->HTML conversion.
        idx = {"n": 0}
        def sub(_m):
            i = idx["n"]; idx["n"] += 1
            return f"\n\n[[DIAGRAM_{i}]]\n\n"
        stripped = re.sub(r"```mermaid\n.*?```", sub, md_text, flags=re.DOTALL)

        html_body = markdown.markdown(stripped, extensions=["tables", "fenced_code", "sane_lists"])
        for i, p in enumerate(png_paths):
            html_body = html_body.replace(
                f"[[DIAGRAM_{i}]]",
                f'<div><img class="diagram" src="{p.as_posix()}" alt="diagram {i + 1}"/></div>',
            )

        html = f"<html><head><style>{CSS}</style></head><body>{html_body}</body></html>"

        def link_callback(uri, rel):
            return uri if os.path.isfile(uri) else uri

        with open(OUT, "wb") as f:
            result = pisa.CreatePDF(html, dest=f, link_callback=link_callback, encoding="utf-8")
        if result.err:
            sys.exit(f"PDF generation reported {result.err} error(s)")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
