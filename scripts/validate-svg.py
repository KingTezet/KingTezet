#!/usr/bin/env python3
"""Validate profile SVG assets and README local asset references.

Checks (stdlib only, XML parsed with xml.etree.ElementTree):
  - at least one SVG; every SVG parses; root is <svg> in the SVG namespace
  - viewBox / width / height present and consistent
  - required dark/light pairs exist with expected, matching dimensions
  - <title>/<desc> present; IDs unique per file
  - no <script>, <foreignObject>, on* attributes, or external href resources
  - README.md local src / srcset / Markdown image paths resolve in the repo
"""
from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
SVG_DIR = ROOT / "assets" / "svg"
SVG_NS = "{http://www.w3.org/2000/svg}"
EXPECTED = {
    "hero": (1200, 300),
    "stack": (1200, 250),
    "projects": (1200, 540),
    "activity": (1200, 260),
}
THEMES = ("dark", "light")
FORBIDDEN_TAGS = {"script", "foreignobject", "iframe", "object", "embed"}

errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)
    print(f"INVALID: {msg}")


def local(tag: str) -> str:
    return tag.split("}", 1)[-1].lower()


def check_svg(path: Path) -> tuple[str, str, str] | None:
    rel = path.relative_to(ROOT)
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        err(f"{rel}: XML parse error: {exc}")
        return None
    if root.tag != f"{SVG_NS}svg":
        err(f"{rel}: root element is not svg in SVG namespace ({root.tag})")
        return None
    vb, w, h = root.get("viewBox"), root.get("width"), root.get("height")
    if not vb or not w or not h:
        err(f"{rel}: missing viewBox/width/height")
        return None
    parts = vb.split()
    if len(parts) != 4 or parts[0] != "0" or parts[1] != "0" or parts[2] != w or parts[3] != h:
        err(f"{rel}: viewBox '{vb}' does not match width/height {w}x{h}")

    ids: set[str] = set()
    has_title = has_desc = False
    for el in root.iter():
        name = local(el.tag)
        if name in FORBIDDEN_TAGS:
            err(f"{rel}: forbidden element <{name}>")
        if name == "title":
            has_title = True
        if name == "desc":
            has_desc = True
        for attr, value in el.attrib.items():
            aname = local(attr)
            if aname.startswith("on"):
                err(f"{rel}: event handler attribute '{aname}'")
            if aname == "href" and value and not value.startswith("#"):
                err(f"{rel}: external href resource '{value}'")
            if aname == "style" and re.search(r"url\(\s*['\"]?(?!#)", value):
                err(f"{rel}: external url() in style")
            if aname == "id":
                if value in ids:
                    err(f"{rel}: duplicate id '{value}'")
                ids.add(value)
        if name == "style" and el.text and re.search(r"@import|url\(\s*['\"]?(?!#)", el.text):
            err(f"{rel}: external resource in <style>")
    if not has_title or not has_desc:
        err(f"{rel}: missing <title> or <desc>")
    print(f"VALID: {rel} ({w}x{h})")
    return vb, w, h


class RefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[str] = []
        self.pictures = 0

    def handle_starttag(self, tag, attrs):
        if tag == "picture":
            self.pictures += 1
        for k, v in attrs:
            if not v:
                continue
            if k == "src":
                self.refs.append(v)
            elif k == "srcset":
                self.refs.extend(c.strip().split()[0] for c in v.split(",") if c.strip())


def check_readme() -> None:
    readme = ROOT / "README.md"
    if not readme.exists():
        err("README.md not found")
        return
    content = readme.read_text(encoding="utf-8")
    parser = RefParser()
    parser.feed(content)
    refs = parser.refs + re.findall(r"!\[[^\]]*\]\(\s*<?([^)\s>]+)", content)
    checked = 0
    for ref in refs:
        parsed = urlparse(ref)
        if parsed.scheme or ref.startswith("//") or ref.startswith("#"):
            continue
        target = (ROOT / parsed.path.lstrip("/")).resolve()
        if ROOT not in target.parents and target != ROOT:
            err(f"README.md: path escapes repository: {ref}")
            continue
        if not target.is_file():
            err(f"README.md: missing local asset: {ref}")
            continue
        checked += 1
    for comp in EXPECTED:
        for theme in THEMES:
            if f"assets/svg/{comp}-{theme}.svg" not in content:
                err(f"README.md: does not reference assets/svg/{comp}-{theme}.svg")
    if parser.pictures < len(EXPECTED):
        err(f"README.md: expected >= {len(EXPECTED)} <picture> elements, found {parser.pictures}")
    print(f"VALID: README.md ({checked} local asset references resolved, {parser.pictures} <picture>)")


def main() -> int:
    files = sorted(SVG_DIR.glob("*.svg"))
    if not files:
        print("ERROR: no SVG files found")
        return 1
    dims = {}
    for path in files:
        result = check_svg(path)
        if result:
            dims[path.stem] = result
    for comp, (ew, eh) in EXPECTED.items():
        pair = []
        for theme in THEMES:
            key = f"{comp}-{theme}"
            if key not in dims:
                err(f"missing or invalid required asset assets/svg/{key}.svg")
                continue
            vb, w, h = dims[key]
            if (w, h) != (str(ew), str(eh)):
                err(f"{key}.svg: expected {ew}x{eh}, got {w}x{h}")
            pair.append(dims[key])
        if len(pair) == 2 and pair[0] != pair[1]:
            err(f"{comp}: dark/light dimensions differ {pair[0]} vs {pair[1]}")
    check_readme()
    if errors:
        print(f"FAILED: {len(errors)} problem(s)")
        return 1
    print("SVG XML validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
