"""Build an offline and GitHub Pages compatible demo from the app's trend view."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "index.html").read_text()
start = page.index('      <article class="card trend-card"')
card = page[start:page.index("</article>", start) + len("</article>")]
data = json.dumps(json.loads((root / "data/power-trends.json").read_text()), separators=(",", ":"))
script = (root / "trends.js").read_text()
styles = (root / "style.css").read_text()
(root / "docs/index.html").write_text(f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Snow2Crop · Earth System Trend Detective</title>
  <style>{styles}
  .jury {{ max-width: 1060px; margin: auto; padding: clamp(16px, 5vw, 52px); }}
  .jury h1 {{ margin: 0; font-size: clamp(36px, 6vw, 64px); line-height: 1.1; }}
  .jury header {{ margin-bottom: 1rem; }}
  .jury .card-heading {{ margin-bottom: 0; }}
  </style>
</head>
<body>
<main class="jury">
  <header><h1>Snow2Crop</h1><p>Detect long-term weather trends near the Chirchik River basin using NASA POWER.</p></header>
  {card}
  <details>
    <summary>Recorded AI example</summary>
    <p><strong>Question:</strong> Can a satellite image of the Chirchik basin tell me how much water reaches my field near Tashkent? What data would you need?</p>
    <p><strong>Snow2Crop answer:</strong> Delivery to a particular field is unknown. Releases, withdrawals and losses along the route, or measured delivery to the field, are needed. Assessing a shortage also requires demand for the same period.</p>
    <p>This example was captured from the running Snow2Crop prototype. This page runs trend calculations in your browser. Live chat requires the separate Gemma and MLX server.</p>
  </details>
</main>
<script type="application/json" id="embedded-power-trends">{data}</script>
<script>{script}</script>
</body>
</html>
""")
