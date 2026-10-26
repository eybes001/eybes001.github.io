"""Write GitHub Pages directory entry points for clean homepage section URLs."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
TITLE = "<title>Eyad Aly — Pricing & Data Intelligence</title>"
ROUTES = {
    "dashboard": "Dashboard — Eyad Aly",
    "work": "Case study — Eyad Aly",
    "expertise": "Expertise — Eyad Aly",
    "about": "About — Eyad Aly",
    "process": "Process — Eyad Aly",
    "contact": "Contact — Eyad Aly",
}

if SOURCE.count("<head>") != 1 or SOURCE.count(TITLE) != 1:
    raise SystemExit("Homepage template changed; update build_routes.py before regenerating routes")

for slug, title in ROUTES.items():
    page = SOURCE.replace("<head>", '<head>\n  <base href="/">', 1)
    page = page.replace(TITLE, f"<title>{title}</title>", 1)
    destination = ROOT / slug / "index.html"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(page, encoding="utf-8")
    print(destination.relative_to(ROOT))
