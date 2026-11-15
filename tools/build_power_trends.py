"""Aggregate complete calendar years from a NASA POWER Daily API point response."""
import argparse
import calendar
import json
from collections import defaultdict
from pathlib import Path
from statistics import mean


def aggregate(source):
    series = source["properties"]["parameter"]
    missing = source["header"]["fill_value"]
    years = defaultdict(list)
    for date, temp in sorted(series["T2M"].items()):
        precip = series["PRECTOTCORR"].get(date, missing)
        if temp != missing and precip != missing and precip >= 0:
            years[int(date[:4])].append((temp, precip))
    return {
        "coordinates": source["geometry"]["coordinates"][:2],
        "rows": [
            {"year": year, "temperature": round(mean(t for t, _ in days), 4),
             "precipitation": round(sum(p for _, p in days), 2),
             "coldPrecipitation": round(sum(p for t, p in days if t < 2), 2)}
            for year, days in sorted(years.items())
            if len(days) == 365 + calendar.isleap(year)
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.write_text(json.dumps(aggregate(json.loads(args.source.read_text())), indent=2) + "\n")
