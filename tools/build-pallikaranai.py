#!/usr/bin/env python3
"""Render the Pallikaranai Marsh updates from data/pallikaranai-updates.json
into the two static pages, so every entry is real HTML (indexable and
usable without JavaScript).

    python3 tools/build-pallikaranai.py          # update the pages
    python3 tools/build-pallikaranai.py --check  # exit 1 if a page is out of date

It only rewrites the regions between these markers:
    <!-- PM:<NAME>:START --> ... <!-- PM:<NAME>:END -->
and the publication dates in each Pallikaranai page's JSON-LD. It also writes
pallikaranai-source-register.csv (project root; *.csv is kept off the
CDN by .assetsignore) for editorial review.

To add an update: add an object at the TOP of "updates" in the JSON
(newest first is not required — entries are sorted by event_date),
update "dates" (last_substantive_update when content changes,
last_source_verification when sources are re-checked), run this script,
review the pages, commit.

Dates: "dates.coverage_start" is the start of the research window, NOT a
creation date. "dates.page_published" stays null until the pages are
actually deployed — the pages then say "Not yet published" and their
JSON-LD carries no datePublished/dateModified. On deploy day set it to that
date and re-run this script.
Never add an entry without at least one source URL and a checked date.
"""
import csv
import datetime as dt
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "data" / "pallikaranai-updates.json").read_text(encoding="utf-8"))
DATES = DATA["dates"]
HUB = ROOT / "pallikaranai-marsh-updates.html"
GUIDE = ROOT / "pallikaranai-marsh-guide.html"
HOME = ROOT / "index.html"
INSIGHTS = ROOT / "insights.html"

CATS = DATA["categories"]
STATUS = DATA["legal_status_labels"]
VERIFY = DATA["verification_labels"]
TIERS = DATA["tier_labels"]
EVID = DATA["evidence_labels"]
TYPES = {
    "official_order": "Official order",
    "official_record": "Official record",
    "court_record": "Court record",
    "court_filing": "Court filing",
    "government_release": "Government release",
    "news_report": "News report",
    "civil_society_report": "Civil-society report",
    "portal_article": "Real-estate portal article",
}
REQUIRED = ("id", "event_date", "category", "legal_status", "headline", "summary", "sources")


def e(s):
    return html.escape(str(s or ""), quote=True)


def d(iso):
    return dt.date.fromisoformat(iso)


def fmt(iso):
    x = d(iso)
    return f"{x.day} {x.strftime('%b %Y')}"


def validate():
    errs = []
    for k in ("coverage_start", "last_substantive_update", "last_source_verification"):
        d(DATES[k])
    if DATES.get("page_published"):
        if d(DATES["page_published"]) > dt.date.today():
            errs.append("dates.page_published is in the future")
        if d(DATES["page_published"]) < d(DATES["last_substantive_update"]) - dt.timedelta(days=36500):
            errs.append("dates.page_published looks wrong")
    for group in ("updates", "background"):
        seen = set()
        for u in DATA[group]:
            for k in REQUIRED:
                if not u.get(k):
                    errs.append(f"{group}/{u.get('id', '?')}: missing {k}")
            if u.get("id") in seen:
                errs.append(f"{group}: duplicate id {u['id']}")
            seen.add(u.get("id"))
            if u.get("category") not in CATS:
                errs.append(f"{group}/{u['id']}: unknown category {u.get('category')}")
            if u.get("legal_status") not in STATUS:
                errs.append(f"{group}/{u['id']}: unknown legal_status {u.get('legal_status')}")
            d(u["event_date"])
            if group == "updates":
                if u["event_date"] < DATES["coverage_start"]:
                    errs.append(f"updates/{u['id']}: event before coverage_start — move to background")
                for k in ("changed", "not_changed"):
                    if not u.get(k):
                        errs.append(f"updates/{u['id']}: missing {k}")
            for s in u.get("sources", []):
                for k in ("title", "publisher", "url", "type", "checked", "verification"):
                    if not s.get(k):
                        errs.append(f"{group}/{u['id']}: source missing {k}")
                if not str(s.get("url", "")).startswith("https://"):
                    errs.append(f"{group}/{u['id']}: source URL must be https")
                if s.get("verification") not in VERIFY:
                    errs.append(f"{group}/{u['id']}: unknown verification {s.get('verification')}")
                if s.get("tier") not in TIERS:
                    errs.append(f"{group}/{u['id']}: source tier must be one of {list(TIERS)}")
                if s.get("type") not in TYPES:
                    errs.append(f"{group}/{u['id']}: unknown source type {s.get('type')}")
            for fl in u.get("review_flags", []):
                if not (fl.get("claim") and fl.get("issue")):
                    errs.append(f"{group}/{u['id']}: review flag needs claim and issue")
    if errs:
        sys.exit("Data errors:\n  " + "\n  ".join(errs))


def sources_html(sources, open_=False):
    items = []
    for s in sources:
        bits = [e(s["publisher"]), TYPES[s["type"]]]
        if TIERS[s["tier"]] != TYPES[s["type"]]:
            bits.append(TIERS[s["tier"]])
        if s.get("published"):
            bits.append("published " + fmt(s["published"]))
        note = ""  # Editorial verification notes remain in the internal source register.
        items.append(
            f'<li><a href="{e(s["url"])}" target="_blank" rel="noopener noreferrer">{e(s["title"])}'
            f'<span class="sr-only"> (opens in a new tab)</span></a>'
            f'<span class="pm-src-meta">{" · ".join(bits)}</span>{note}</li>'
        )
    n = len(sources)
    label = f"Source{'s' if n != 1 else ''} ({n})"
    return (f'<details class="pm-sources"{" open" if open_ else ""}><summary>{label}</summary>'
            f'<ul>{"".join(items)}</ul></details>')


def evidence(u):
    """Strongest evidence actually checked for an entry."""
    ss = u["sources"]
    if any(s["tier"] == "primary" and s["verification"] == "checked" for s in ss):
        return "primary"
    if any(s["tier"] == "news" and s["verification"] == "checked" for s in ss):
        return "news"
    if any(s["tier"] == "news" and s["verification"] == "partial" for s in ss):
        return "news_partial"
    return "secondary_only"


def flags_html(u):
    """Keep editorial review flags in the internal source register, not the public page."""
    return ""


def entry_html(u, featured=False):
    note = f' <span class="pm-dates-note">({e(u["event_date_note"])})</span>' if u.get("event_date_note") else ""
    pub = u.get("published_date") or min((s.get("published") for s in u["sources"] if s.get("published")), default="")
    dates = f'Event date: {fmt(u["event_date"])}{note}'
    if pub:
        dates += f' · Published: {fmt(pub)}'
    latest = '<span class="pm-latest-tag">Latest update</span>' if featured else ""
    return f'''<article class="pm-entry{' pm-entry--featured' if featured else ''}" id="{e(u["id"])}" data-category="{e(u["category"])}" data-month="{u["event_date"][:7]}">
  {latest}<div class="pm-meta"><time class="pm-date" datetime="{u["event_date"]}" data-pm-rel>{fmt(u["event_date"])}</time><span class="pm-cat">{e(CATS[u["category"]])}</span><span class="pm-status pm-status--{u["legal_status"]}">{e(STATUS[u["legal_status"]])}</span></div>
  <h3>{e(u["headline"])}</h3>
  <p>{e(u["summary"])}</p>
  <dl class="pm-change"><div><dt>What changed</dt><dd>{e(u["changed"])}</dd></div><div class="pm-not"><dt>What did not change</dt><dd>{e(u["not_changed"])}</dd></div></dl>
  {flags_html(u)}
  <p class="pm-dates">{dates}</p>
  {sources_html(u["sources"], open_=featured)}
</article>'''


def sorted_updates():
    return sorted(DATA["updates"], key=lambda u: (u["event_date"], u.get("published_date", "")), reverse=True)


def latest_verified():
    """Newest update backed by at least one fully checked source, within the window."""
    window = DATA.get("homepage_window_days", 45)
    cutoff = d(DATES["last_source_verification"]) - dt.timedelta(days=window)
    for u in sorted_updates():
        if u["legal_status"] == "unverified_claim":
            continue
        if evidence(u) in ("primary", "news") and d(u["event_date"]) >= cutoff:
            return u
    return None


def feature_html(where):
    u = latest_verified()
    cs = DATA["current_status"]
    if where == "home":
        eyebrow, title, hid = "Pallikaranai Ramsar Intelligence", "Pallikaranai Marsh: court and approval updates", "pmfHomeTitle"
    else:
        eyebrow, title, hid = "Insights · News &amp; Updates", "Pallikaranai Marsh News &amp; Updates", "pmfInsightsTitle"
    if u:
        latest = (f'<p class="pmf-latest"><span class="pmf-latest-label">Latest update · '
                  f'<time datetime="{u["event_date"]}" data-pm-rel>{fmt(u["event_date"])}</time></span>'
                  f'{e(u["headline"])} <span class="pmf-chip pmf-chip--{u["legal_status"]}">{e(STATUS[u["legal_status"]])}</span></p>')
    else:
        latest = (f'<p class="pmf-latest"><span class="pmf-latest-label">Latest confirmed status · '
                  f'<time datetime="{cs["as_of"]}">{fmt(cs["as_of"])}</time></span></p>')
    return f'''<div class="pmf-card">
  <div>
    <span class="pmf-eyebrow">{eyebrow}</span>
    <h2 class="pmf-title" id="{hid}">{title}</h2>
    {latest}
    <p class="pmf-status"><strong>Current status:</strong> {e(cs["text"])}</p>
    <p class="pmf-meta">Sources last checked {fmt(DATES["last_source_verification"])} · General information, not legal advice.</p>
  </div>
  <div class="pmf-actions">
    <a class="pmf-btn" href="pallikaranai-marsh-updates.html">Latest updates <span aria-hidden="true">&rarr;</span></a>
    <a class="pmf-btn pmf-btn--ghost" href="pallikaranai-marsh-guide.html">Complete guide</a>
  </div>
</div>'''


def render_regions():
    ups = sorted_updates()
    feed = "\n".join(entry_html(u, featured=(i == 0)) for i, u in enumerate(ups))
    months = sorted({u["event_date"][:7] for u in ups}, reverse=True)
    month_opts = '<option value="all">All months</option>' + "".join(
        f'<option value="{m}">{d(m + "-01").strftime("%B %Y")}</option>' for m in months)
    used = [k for k in CATS if any(u["category"] == k for u in ups)]
    chips = '<button type="button" class="pm-chip" data-cat="all" aria-pressed="true">All</button>' + "".join(
        f'<button type="button" class="pm-chip" data-cat="{k}" aria-pressed="false">{e(CATS[k])}</button>' for k in CATS)
    bg = sorted(DATA["background"], key=lambda u: u["event_date"], reverse=True)
    timeline = "\n".join(
        f'''<li><time datetime="{u["event_date"]}">{fmt(u["event_date"])}{" — " + e(u["event_date_note"]) if u.get("event_date_note") else ""}</time>
  <h3>{e(u["headline"])}</h3><p>{e(u["summary"])}</p>
  <p class="pm-dates"><span class="pm-cat">{e(CATS[u["category"]])}</span> <span class="pm-status pm-status--{u["legal_status"]}">{e(STATUS[u["legal_status"]])}</span></p>
  {flags_html(u)}{sources_html(u["sources"])}</li>''' for u in bg)
    nxt = DATA.get("next_scheduled") or {}
    pub = DATES.get("page_published")
    status = (f'<span><strong>Research coverage from:</strong> <time datetime="{DATES["coverage_start"]}">{fmt(DATES["coverage_start"])}</time></span>'
              + (f'<span><strong>Page published:</strong> <time datetime="{pub}">{fmt(pub)}</time></span>' if pub
                 else '<span><strong>Page published:</strong> Not yet published</span>')
              + f'<span><strong>Last substantive update:</strong> <time datetime="{DATES["last_substantive_update"]}">{fmt(DATES["last_substantive_update"])}</time></span>'
              + f'<span><span class="pm-dot" aria-hidden="true"></span><strong>Sources last checked:</strong> <time datetime="{DATES["last_source_verification"]}">{fmt(DATES["last_source_verification"])}</time></span>')
    if nxt:
        status += (f'<span><strong>Next listing:</strong> {fmt(nxt["date"])} — '
                   f'{"reported by a single secondary source, not confirmed" if nxt.get("evidence") == "single_secondary" else "reported"}</span>')
    latest = ups[0]
    latest_card = (f'<p><strong>{fmt(latest["event_date"])}</strong> — {e(latest["headline"])}</p>'
                   f'<a class="pm-btn pm-btn--ghost" href="pallikaranai-marsh-updates.html#{e(latest["id"])}">Read the latest update</a>')
    # Source register table (guide)
    rows = []
    for group, items in (("Update", ups), ("Background", bg)):
        for u in items:
            for s in u["sources"]:
                rows.append(f'<tr><td>{fmt(u["event_date"])}</td><td>{e(s["publisher"])}</td>'
                            f'<td><a href="{e(s["url"])}" target="_blank" rel="noopener noreferrer">{e(s["title"])}</a></td>'
                            f'<td>{TYPES[s["type"]]}</td></tr>')
    register = ('<div class="pm-table-wrap"><table class="pm-table"><thead><tr><th scope="col">Event</th><th scope="col">Publisher</th>'
                '<th scope="col">Source</th><th scope="col">Type</th></tr></thead><tbody>'
                + "".join(rows) + "</tbody></table></div>")
    legend = ("".join(f'<span class="pm-status pm-status--{k}">{e(v)}</span>' for k, v in STATUS.items()
              if any(u["legal_status"] == k for u in DATA["updates"] + DATA["background"]))
          )
    return {
        "LEGEND": legend,
        "HOME": feature_html("home"),
        "INSIGHTS": feature_html("insights"),
        "FEED": feed, "MONTHS": month_opts, "CHIPS": chips, "TIMELINE": timeline,
        "STATUS": status, "LATEST": latest_card, "REGISTER": register,
        "NEXT": (f'<p><strong>{fmt(nxt["date"])}</strong> — {e(nxt["label"])}.</p>' if nxt else ""),
        "COUNT": f"Showing all {len(ups)} updates",
    }


def jsonld_dates(raw):
    """Publication dates only once the page is really published."""
    data = json.loads(raw)
    pub = DATES.get("page_published")
    for node in data.get("@graph", [data]):
        if node.get("@type") in ("Article", "CollectionPage", "WebPage"):
            node.pop("datePublished", None)
            node.pop("dateModified", None)
            if pub:
                node["datePublished"] = pub
                node["dateModified"] = max(pub, DATES["last_substantive_update"])
    return json.dumps(data, indent=2, ensure_ascii=False)


def apply(path, regions):
    text = path.read_text(encoding="utf-8")
    for name, content in regions.items():
        pat = re.compile(rf"(<!-- PM:{name}:START -->)(.*?)(<!-- PM:{name}:END -->)", re.S)
        text = pat.sub(lambda m: m.group(1) + "\n" + content + "\n" + m.group(3), text)
    if path.name.startswith("pallikaranai-"):
        text = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)',
                      lambda m: m.group(1) + "\n" + jsonld_dates(m.group(2)) + "\n    " + m.group(3), text, flags=re.S)
    return text


def write_register():
    out = ROOT / "pallikaranai-source-register.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["group", "entry_id", "event_date", "category", "legal_status", "headline", "publisher",
                    "source_title", "url", "source_type", "tier", "published", "checked", "verification", "note", "review_flags"])
        for group in ("updates", "background"):
            for u in DATA[group]:
                for s in u["sources"]:
                    w.writerow([group, u["id"], u["event_date"], u["category"], u["legal_status"], u["headline"],
                                s["publisher"], s["title"], s["url"], s["type"], s["tier"], s.get("published", ""),
                                s["checked"], s["verification"], s.get("note", ""),
                                " | ".join(f'{f["claim"]}: {f["issue"]}' for f in u.get("review_flags", []))])


def main():
    validate()
    regions = render_regions()
    check = "--check" in sys.argv
    stale = []
    for page in (HUB, GUIDE, HOME, INSIGHTS):
        if not page.exists():
            sys.exit(f"Missing page: {page.name}")
        new = apply(page, regions)
        if new != page.read_text(encoding="utf-8"):
            stale.append(page.name)
            if not check:
                page.write_text(new, encoding="utf-8")
    if check:
        if stale:
            sys.exit("Out of date: " + ", ".join(stale))
        print("Pages up to date.")
        return
    write_register()
    print("Updated:", ", ".join(stale) if stale else "nothing (already current)")


if __name__ == "__main__":
    main()
