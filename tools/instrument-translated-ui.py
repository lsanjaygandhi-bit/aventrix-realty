#!/usr/bin/env python3
"""Add explicit i18n attributes to static UI text already translated in all locales."""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "locales" / "ui-translations.json"
LANGUAGES = ("en", "ta", "hi", "te", "kn", "ml")
UI_TAGS = {
    "a", "button", "div", "dt", "em", "h1", "h2", "h3", "h4", "h5", "h6",
    "label", "legend", "option", "output", "small", "span", "strong",
    "p", "summary", "th",
}
TRANSLATABLE_ATTRIBUTES = {
    "aria-label": "data-i18n-aria-label",
    "placeholder": "data-i18n-placeholder",
    "title": "data-i18n-title",
}
SKIPPED_DIRS = {".git", "node_modules", "vendor"}
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


class MarkerParser(HTMLParser):
    def __init__(self, source: str, phrase_keys: dict[str, str]) -> None:
        super().__init__(convert_charrefs=True)
        self.source = source
        self.phrase_keys = phrase_keys
        self.stack: list[dict] = []
        self.insertions: list[tuple[int, str]] = []
        self.line_offsets = [0]
        for match in re.finditer("\n", source):
            self.line_offsets.append(match.end())

    def source_offset(self, position: tuple[int, int]) -> int:
        line, column = position
        return self.line_offsets[line - 1] + column

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self.stack:
            self.stack[-1]["has_child"] = True
        raw = self.get_starttag_text()
        attr_names = {name.lower() for name, _ in attrs}
        frame = {
            "tag": tag.lower(),
            "position": self.source_offset(self.getpos()),
            "raw": raw,
            "attrs": attr_names,
            "has_child": False,
            "text": [],
            "eligible": tag.lower() in UI_TAGS
            and not any(name.startswith("data-i18n") for name in attr_names),
        }
        if tag.lower() in {"script", "style", "textarea", "title", "noscript", "code", "pre"}:
            frame["eligible"] = False
        if tag.lower() not in {"script", "style", "title", "noscript", "code", "pre"}:
            additions = []
            for attr, marker in TRANSLATABLE_ATTRIBUTES.items():
                if attr not in attr_names or marker in attr_names:
                    continue
                value = next((value for name, value in attrs if name.lower() == attr), None)
                phrase = normalize(value) if value is not None else ""
                if phrase in self.phrase_keys:
                    additions.append((marker, self.phrase_keys[phrase]))
            self._add_markers(frame, additions)
        if tag.lower() not in VOID_TAGS:
            self.stack.append(frame)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self.stack:
            self.stack[-1]["has_child"] = True
        raw = self.get_starttag_text()
        attr_names = {name.lower() for name, _ in attrs}
        frame = {
            "position": self.source_offset(self.getpos()),
            "raw": raw,
            "attrs": attr_names,
        }
        additions = []
        for attr, marker in TRANSLATABLE_ATTRIBUTES.items():
            if attr not in attr_names or marker in attr_names:
                continue
            value = next((value for name, value in attrs if name.lower() == attr), None)
            phrase = normalize(value) if value is not None else ""
            if phrase in self.phrase_keys:
                additions.append((marker, self.phrase_keys[phrase]))
        self._add_markers(frame, additions)

    def _add_markers(self, frame: dict, markers: list[tuple[str, str]]) -> None:
        if not markers:
            return
        raw = frame["raw"]
        end = raw.rfind(">")
        if end > 0 and raw[:end].rstrip().endswith("/"):
            end = raw[:end].rstrip().rfind("/")
        insertion = "".join(
            f' {name}="{html.escape(value, quote=True)}"' for name, value in markers
        )
        self.insertions.append((frame["position"] + end, insertion))

    def handle_data(self, data: str) -> None:
        if self.stack and self.stack[-1]["eligible"]:
            self.stack[-1]["text"].append(data)

    def handle_endtag(self, tag: str) -> None:
        match_index = next(
            (index for index in range(len(self.stack) - 1, -1, -1)
             if self.stack[index]["tag"] == tag.lower()),
            None,
        )
        if match_index is None:
            return
        frame = self.stack[match_index]
        if (
            frame["eligible"]
            and not frame["has_child"]
            and "data-i18n" not in frame["attrs"]
        ):
            phrase = normalize("".join(frame["text"]))
            if phrase in self.phrase_keys:
                raw = frame["raw"]
                end = raw.rfind(">")
                self.insertions.append(
                    (
                        frame["position"] + end,
                        f' data-i18n="{html.escape(self.phrase_keys[phrase], quote=True)}"',
                    )
                )
        del self.stack[match_index:]


def html_files() -> list[Path]:
    return sorted(
        path for path in ROOT.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".html", ".htm"}
        and not SKIPPED_DIRS.intersection(path.relative_to(ROOT).parts)
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="report eligible untranslated UI without editing")
    args = parser.parse_args()

    dictionary = json.loads(LOCALES.read_text(encoding="utf-8"))
    phrase_keys = {
        phrase: phrase
        for phrase in set.intersection(*(set(dictionary.get(code, {})) for code in LANGUAGES[1:]))
    }
    for key, source in dictionary.get("ui_keys", {}).items():
        values = dictionary.get("ui", {}).get(key, {})
        if all(code in values for code in LANGUAGES):
            phrase_keys.setdefault(source, key)
    changed = 0
    for path in html_files():
        original = path.read_text(encoding="utf-8")
        marker_parser = MarkerParser(original, phrase_keys)
        marker_parser.feed(original)
        if not marker_parser.insertions:
            continue
        if args.check:
            print(f"{path.relative_to(ROOT)}: {len(marker_parser.insertions)} eligible UI markers")
            changed += len(marker_parser.insertions)
            continue
        updated = original
        for position, insertion in sorted(marker_parser.insertions, reverse=True):
            updated = updated[:position] + insertion + updated[position:]
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    print(("Eligible existing markers:" if args.check else "Updated HTML files:"), changed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
