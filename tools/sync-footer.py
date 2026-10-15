#!/usr/bin/env python3
"""Copy the shared footer (partials/footer.html) into every public page.

The site is plain static HTML, so each page carries the footer markup
itself (good for SEO and works without JavaScript). This script keeps
those copies identical:

    python3 tools/sync-footer.py          # update pages
    python3 tools/sync-footer.py --check  # exit 1 if any page is out of date

For each top-level *.html page it replaces either the existing
<!-- SITE-FOOTER:START --> ... <!-- SITE-FOOTER:END --> block or a legacy
<footer class="premium-footer"> ... </footer>, and adds the
css/site-footer.css link just before css/site-fixes.css.
Skipped: admin/, partials/, and "* 2.html" duplicate copies.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PARTIAL = (ROOT / "partials" / "footer.html").read_text(encoding="utf-8").strip()
CSS_VERSION = "20261015b"
CSS_LINK = f'<link rel="stylesheet" href="css/site-footer.css?v={CSS_VERSION}">'

BLOCK = re.compile(r"<!-- SITE-FOOTER:START.*?<!-- SITE-FOOTER:END -->", re.S)
LEGACY = re.compile(r'<footer class="premium-footer"[^>]*>.*?</footer>', re.S)
CSS_ANY = re.compile(r'[ \t]*<link rel="stylesheet" href="css/site-footer\.css[^"]*">\n?')
FIXES = re.compile(r'([ \t]*)(<link rel="stylesheet" href="css/site-fixes\.css[^"]*">)')


def render(text):
    if BLOCK.search(text):
        text = BLOCK.sub(lambda m: PARTIAL, text, count=1)
    elif LEGACY.search(text):
        text = LEGACY.sub(lambda m: PARTIAL, text, count=1)
    else:
        return None
    text = CSS_ANY.sub("", text)
    if FIXES.search(text):
        text = FIXES.sub(lambda m: f"{m.group(1)}{CSS_LINK}\n{m.group(1)}{m.group(2)}", text, count=1)
    else:
        text = text.replace("</head>", f"    {CSS_LINK}\n</head>", 1)
    return text


def main():
    check = "--check" in sys.argv
    changed, skipped = [], []
    pages = sorted(p for p in ROOT.glob("*.html") if not p.name.endswith(" 2.html"))
    for page in pages:
        old = page.read_text(encoding="utf-8")
        new = render(old)
        if new is None:
            skipped.append(page.name)
            continue
        if new != old:
            changed.append(page.name)
            if not check:
                page.write_text(new, encoding="utf-8")
    print(f"{len(pages)} pages, {len(changed)} {'out of date' if check else 'updated'}, {len(skipped)} without a footer")
    for n in changed:
        print("  ~", n)
    for n in skipped:
        print("  - no footer:", n)
    if check and changed:
        sys.exit(1)


if __name__ == "__main__":
    main()
