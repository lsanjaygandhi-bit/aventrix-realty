#!/usr/bin/env python3
"""Generate a source-level, per-page multilingual UI coverage report."""
from __future__ import annotations

from collections import defaultdict
from html.parser import HTMLParser
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DICTIONARY = ROOT / "locales" / "ui-translations.json"
OUTPUT = ROOT / "docs" / "MULTILINGUAL-COVERAGE.md"
LANGUAGES = ("en", "ta", "hi", "te", "kn", "ml")
KEY_ATTRIBUTES = {
    "data-i18n": None,
    "data-i18n-placeholder": "placeholder",
    "data-i18n-aria-label": "aria-label",
    "data-i18n-title": "title",
    "data-i18n-value": "value",
    "data-i18n-alt": "alt",
}
VISIBLE_LABEL_TAGS = {
    "a", "button", "dt", "em", "h1", "h2", "h3", "h4", "h5", "h6",
    "label", "legend", "option", "output", "p", "small", "span",
    "strong", "summary", "th",
}
REPORTABLE_UI_TAGS = {
    "button", "h1", "h2", "h3", "h4", "h5", "h6", "label", "legend",
    "option", "output", "summary", "th",
}
REPORTABLE_UI_ATTRIBUTES = {"aria-label", "placeholder", "title"}
IGNORED_TAGS = {"script", "style", "noscript", "textarea", "code", "pre", "svg"}
EXCLUDED_DIRS = {".git", "node_modules", "vendor"}
DYNAMIC_COMPONENTS = (
    "js/properties-search.js",
    "js/public-properties.js",
    "js/account-auth.js",
    "js/enquiry-supabase.js",
    "js/emi-calculator.js",
    "js/jv-calculator-integration.js",
    "js/plot-area-calculator.js",
    "js/properties-map.js",
    "js/ai-property-assistant.js",
)


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


class PageCoverage(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[dict] = []
        self.keys: set[str] = set()
        self.unmarked: set[str] = set()
        self.unmarked_ui: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {name.lower(): value or "" for name, value in attrs}
        for attr in REPORTABLE_UI_ATTRIBUTES:
            marker = next((key for key, value in KEY_ATTRIBUTES.items() if value == attr), None)
            value = normalize(attr_map.get(attr, ""))
            if value and marker not in attr_map:
                self.unmarked_ui.add(value)
        if self.stack:
            self.stack[-1]["has_child"] = True
        if tag.lower() not in IGNORED_TAGS:
            for marker in KEY_ATTRIBUTES:
                if marker in attr_map and attr_map[marker]:
                    self.keys.add(attr_map[marker])
        self.stack.append({
            "tag": tag.lower(),
            "attrs": attr_map,
            "text": [],
            "has_child": False,
            "ignored": tag.lower() in IGNORED_TAGS,
        })

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {name.lower(): value or "" for name, value in attrs}
        for marker in KEY_ATTRIBUTES:
            if marker in attr_map and attr_map[marker]:
                self.keys.add(attr_map[marker])

    def handle_data(self, data: str) -> None:
        if self.stack and not self.stack[-1]["ignored"]:
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
            frame["tag"] in VISIBLE_LABEL_TAGS
            and not frame["ignored"]
            and not frame["has_child"]
            and "data-i18n" not in frame["attrs"]
        ):
            text = normalize("".join(frame["text"]))
            if text:
                self.unmarked.add(text)
                if frame["tag"] in REPORTABLE_UI_TAGS:
                    self.unmarked_ui.add(text)
        del self.stack[match_index:]


def pages() -> list[Path]:
    return sorted(
        path for path in ROOT.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".html", ".htm"}
        and not EXCLUDED_DIRS.intersection(path.relative_to(ROOT).parts)
    )


def source_for(key: str, data: dict) -> str:
    return data.get("ui_keys", {}).get(key) or data.get("home_ui_keys", {}).get(key) or key


def resolved(data: dict, key: str, language: str) -> tuple[bool, bool]:
    ui = data.get("ui", {}).get(key) or data.get("home_ui", {}).get(key) or {}
    if language in ui:
        return True, False
    source = source_for(key, data)
    if source in data.get(language, {}):
        return True, False
    if language == "en" and any(source in data.get(code, {}) for code in LANGUAGES[1:]):
        return True, False
    if source in data.get("en", {}) or source != key:
        return True, language != "en"
    return False, False


def page_family(path: Path) -> str:
    name = path.relative_to(ROOT).as_posix()
    if name == "index.html":
        return "Homepage: shared navigation, hero, search and page sections"
    if name.startswith("admin/") or name == "account.html":
        return "Account and administration UI"
    if "about-chennai/" in name or name.startswith("land-knowledge/"):
        return "Editorial/local-area and land-knowledge content"
    if any(token in name for token in ("calculator", "valuation", "joint-venture", "jv-", "property-tools", "checklists")):
        return "Forms, calculators and property tools"
    if any(token in name for token in ("propert", "shortlist", "wishlist", "realtor", "sanjay", "gnanasekaran")):
        return "Property search/details, saved items and profiles"
    if any(token in name for token in ("privacy", "terms", "sitemap")):
        return "Legal and utility content"
    if any(token in name for token in ("about", "services", "contact", "enquiry", "seller", "brokerage", "commercial", "nri", "government")):
        return "Company, services and lead-generation content"
    return "Editorial and informational content"


def dynamic_keys(path: Path) -> set[str]:
    source = path.read_text(encoding="utf-8")
    keys = {
        key for key in re.findall(r'data-i18n(?:-[a-z-]+)?\s*=\s*["\']([^"\']+)["\']', source)
        if "${" not in key
    }
    keys.update(key for key in re.findall(
        r'setAttribute\(\s*["\']data-i18n(?:-[a-z-]+)?["\']\s*,\s*["\']([^"\']+)["\']',
        source,
    ) if "${" not in key)
    keys.update(key for key in re.findall(
        r'setI18nText\([^,\n]+,\s*["\']([^"\']+)["\']\s*\)',
        source,
    ) if "${" not in key)
    fallback = re.search(r'FALLBACK_TEXT\s*=\s*["\']([^"\']+)["\']', source)
    if fallback:
        keys.add(fallback.group(1))
    return keys


def main() -> None:
    data = json.loads(DICTIONARY.read_text(encoding="utf-8"))
    rows = []
    dynamic_rows = []
    global_unmarked_ui: set[str] = set()
    global_untranslated: dict[str, set[str]] = defaultdict(set)
    for path in pages():
        parser = PageCoverage()
        parser.feed(path.read_text(encoding="utf-8"))
        global_unmarked_ui.update(parser.unmarked_ui)
        fallbacks = {}
        unavailable = {}
        for language in LANGUAGES:
            fallbacks[language] = []
            unavailable[language] = []
            for key in sorted(parser.keys):
                covered, used_fallback = resolved(data, key, language)
                if used_fallback:
                    fallbacks[language].append(key)
                    global_untranslated[language].add(key)
                elif not covered:
                    unavailable[language].append(key)
                    global_untranslated[language].add(key)
        rows.append((path, parser.keys, parser.unmarked, parser.unmarked_ui, fallbacks, unavailable))
    for relative_path in DYNAMIC_COMPONENTS:
        path = ROOT / relative_path
        keys = dynamic_keys(path) if path.is_file() else set()
        unresolved = {
            language: sorted(key for key in keys if not resolved(data, key, language)[0])
            for language in LANGUAGES
        }
        fallbacks = {
            language: sorted(key for key in keys if resolved(data, key, language)[1])
            for language in LANGUAGES
        }
        dynamic_rows.append((relative_path, keys, unresolved, fallbacks))

    output = [
        "# Multilingual UI coverage audit",
        "",
        f"Generated from {sum(not path.relative_to(ROOT).as_posix().startswith('partials/') for path, *_ in rows)} HTML pages and {sum(path.relative_to(ROOT).as_posix().startswith('partials/') for path, *_ in rows)} shared HTML partial(s). Languages: {', '.join(LANGUAGES)} (English is the default).",
        "",
        "## Coverage rules",
        "",
        "- `data-i18n*` attributes are the supported explicit static UI keys. A key is counted as translated only when its locale has an explicit value or an exact dictionary translation.",
        "- `Fallback` means the key is displayed in English for that locale; these keys need translation. `Unavailable` means the key has no explicit source/default and requires correction.",
        "- `Unmarked visible text candidates` counts visible leaf text without `data-i18n`, including body copy. To avoid duplicating long-form/business/property content into the report, only control labels, headings, and accessibility/placeholder attributes are listed below as UI gaps.",
        "- All pages remain `PARTIAL / NOT BROWSER VERIFIED` until their complete visible content and interactions are inspected. This is an inventory, not a declaration of full-site translation.",
        "",
        "## Page-by-page status",
        "",
        "| Page/partial | UI family | Unique explicit keys | Unmarked visible text candidates | Unkeyed UI strings | English fallback keys by locale | QA status |",
        "|---|---|---:|---:|---|---|",
    ]
    for path, keys, unmarked, unmarked_ui, fallbacks, unavailable in rows:
        path_text = path.relative_to(ROOT).as_posix()
        key_cell = ", ".join(
            f"{language}: {len(fallbacks[language]) + len(unavailable[language])}"
            for language in LANGUAGES if language != "en"
        ) or "none"
        output.append(
            f"| `{path_text}` | {page_family(path)} | {len(keys)} unique | {len(unmarked)} | {len(unmarked_ui)} | "
            f"{key_cell} | PARTIAL / NOT BROWSER VERIFIED |"
        )
    output.extend([
        "",
        "",
        "## JavaScript-rendered components",
        "",
        "The scanner reports explicit keys it can recognize in the listed render modules. A zero unresolved count does not mean all dynamic strings are instrumented; unmarked JS literals, provider responses and runtime states still require code and browser review.",
        "",
        "| Module | Recognized explicit keys | Unresolved keys by locale | QA status |",
        "|---|---:|---|---|",
    ])
    for module, keys, unresolved, _ in dynamic_rows:
        counts = ", ".join(f"{language}: {len(unresolved[language])}" for language in LANGUAGES)
        output.append(f"| `{module}` | {len(keys)} | {counts} | PARTIAL / NOT BROWSER VERIFIED |")
    output.extend([
        "",
        "## Explicit keys using English fallback or lacking a value",
        "",
        "Fallbacks below are reported separately by locale. A zero count here means the explicitly marked keys on that page have dictionary coverage; it does not include unmarked text.",
        "",
    ])
    for language in LANGUAGES[1:]:
        keys = sorted(global_untranslated[language])
        dynamic_fallbacks = sorted({
            key for _, _, _, fallbacks in dynamic_rows for key in fallbacks[language]
        })
        unavailable_dynamic = sorted({
            key for _, _, unavailable, _ in dynamic_rows for key in unavailable[language]
        })
        output.append(f"### {language} ({len(keys)} static-page keys; {len(dynamic_fallbacks)} dynamic fallbacks; {len(unavailable_dynamic)} dynamic unavailable)")
        if keys or dynamic_fallbacks or unavailable_dynamic:
            for key in keys:
                output.append(f"- Static page: `{key}`")
            for key in dynamic_fallbacks:
                output.append(f"- Dynamic fallback: `{key}`")
            for key in unavailable_dynamic:
                output.append(f"- Dynamic unavailable: `{key}`")
        else:
            output.append("- None in recognized explicit keys.")
        output.append("")
    output.extend([
        "## Unkeyed UI strings by page",
        "",
        "These exact control/heading/accessibility strings lack explicit translation keys. Page prose is counted above but not copied into this report; long-form/legal/property-specific content is separately flagged for human translation/review.",
        "",
    ])
    for path, _, _, unmarked_ui, _, _ in rows:
        output.append(f"### `{path.relative_to(ROOT).as_posix()}`")
        if unmarked_ui:
            output.extend(f"- `{text}`" for text in sorted(unmarked_ui))
        else:
            output.append("- None found by the static control/heading scan.")
        output.append("")
    output.extend([
        "",
        "## Dynamic UI requiring separate integration and browser review",
        "",
        "- Search results, property cards, filters, map controls/popups, saved searches, wishlist/shortlist and property detail data.",
        "- Forms, validation, submission confirmations/errors, login/account states, and dynamically populated dropdowns.",
        "- EMI, JV and plot-area calculators, including results, assumptions, dialogs and units.",
        "- Chatbot interface, suggestions, loading/error states and responses.",
        "- Other JavaScript-rendered editorial, testimonial and realtor content.",
        "",
        "Keep names, addresses, property-specific facts, prices and user-provided descriptions unchanged. Legal/privacy terms, fee/valuation/investment claims, calculator assumptions, government-record guidance and environmental/legal statements require qualified human translation/review.",
        "",
    ])
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(output), encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} for {len(rows)} HTML pages.")
    for language in LANGUAGES:
        print(f"{language}: {len(global_untranslated[language])} explicitly keyed fallback/unavailable keys")
    print(f"Unmarked visible text candidates: {sum(len(row[2]) for row in rows)} page/value pairs")
    print(f"Unkeyed UI strings: {len(global_unmarked_ui)} unique values")


if __name__ == "__main__":
    main()
