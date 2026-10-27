"""Build a separate, auditable price-variation study from the classified ledger."""

import csv
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "analysis/.cache/retail.sqlite"
OUTPUT = ROOT / "assets/data"


def percentile(values, fraction):
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def main():
    if not DATABASE.exists():
        raise SystemExit("Build the main pipeline first: analysis/.cache/retail.sqlite is missing")
    connection = sqlite3.connect(DATABASE)
    groups = defaultdict(list)
    descriptions = {}
    for sku, description, price in connection.execute(
        "SELECT sku, description, unit_price_units FROM raw_lines WHERE disposition = 'sale'"
    ):
        groups[sku].append(price)
        if description and sku not in descriptions:
            descriptions[sku] = description.strip()
    rows = []
    for sku, prices in groups.items():
        if len(prices) < 100:
            continue
        p10, median, p90 = (percentile(prices, p) / 10000 for p in (.1, .5, .9))
        rows.append({
            "sku": sku,
            "description": descriptions.get(sku, "Unnamed product"),
            "sale_lines": len(prices),
            "distinct_prices": len(set(prices)),
            "p10_gbp": round(p10, 4),
            "median_gbp": round(median, 4),
            "p90_gbp": round(p90, 4),
            "p90_to_p10": round(p90 / p10, 3),
        })
    rows.sort(key=lambda row: (-row["p90_to_p10"], -row["sale_lines"], row["sku"]))
    flagged = [row for row in rows if row["p90_to_p10"] >= 3]
    summary = {
        "source": "UCI Online Retail, Daqing Chen (2015)",
        "rule": "Accepted positive-quantity merchandise sale lines only; SKUs with at least 100 lines; flag if p90/p10 >= 3",
        "sale_lines": sum(map(len, groups.values())),
        "skus": len(groups),
        "eligible_skus": len(rows),
        "flagged_skus": len(flagged),
        "examples": flagged[:12],
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with (OUTPUT / "pricing-variation.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    (OUTPUT / "pricing-study.js").write_text(
        "window.PRICING_STUDY = " + json.dumps(summary, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(json.dumps({key: summary[key] for key in ("sale_lines", "skus", "eligible_skus", "flagged_skus")}, indent=2))


if __name__ == "__main__":
    main()
