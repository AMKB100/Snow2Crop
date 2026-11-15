# Snow2Crop · Earth System Trend Detective

Snow2Crop is a NASA Space Apps 2026 prototype for investigating long-term weather trends near the Chirchik River basin in Uzbekistan. The irrigation scenario shows why changes in weather matter to farmers and what additional information is needed to assess water delivery to an individual field.

## Try the demo

Download or clone this repository and open **[`docs/index.html`](docs/index.html)** in a browser. The interactive trend demo works offline. For a public browser link, GitHub Pages can serve the `/docs` folder. The page includes a recorded Snow2Crop chat example. Live chat requires the full application and its separate model server.

In the demo, choose annual mean air temperature, total annual precipitation or precipitation on days below 2 °C. The tool plots 45 complete calendar years (1981–2025) for one NASA POWER grid point (41.63° N, 70.03° E).

| Variable | Sen slope per decade | Two-sided Mann–Kendall p-value |
| --- | ---: | ---: |
| Annual mean air temperature | +0.19 °C | 0.017 |
| Annual precipitation | +53.83 mm | < 0.001 |
| Annual precipitation on days below 2 °C | +31.26 mm | < 0.001 |

The test uses a 0.05 significance threshold for each variable and assumes independent annual observations. The analysis covers one point and does not establish a trend for the entire basin. Cold-day precipitation is a proxy for snowfall. These trends alone cannot determine how much water will reach a field.

## NASA data

- [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) provides daily air temperature (T2M) and corrected precipitation (PRECTOTCORR). These are aggregated into annual values and used in the trend test.
- [NASA GIBS / MODIS Terra imagery](https://nasa-gibs.github.io/gibs-api-docs/) provides geographic context and the archived map image. MOD10 snow-cover measurements are outside the current analysis.

## Other data

- [Uzhydromet discharge archive, station 16924](https://hydrosolutions.github.io/caham_book/discharge_station_data.html), used for historical Charvak inflow estimates (1990–2015).
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs), used for weather context in field checks.
- [ERA5-Land snow depth via Open-Meteo](https://open-meteo.com/en/docs/historical-weather-api), used in the experimental snow-water scenario.

See [DATA-SOURCES.md](DATA-SOURCES.md) for the data inventory and gaps in the water-delivery calculation.

## Use of AI

The live prototype uses Gemma with MLX and fine-tuned adapters for model tasks, alongside source-backed responses and deterministic calculations. The trend calculations run in JavaScript independently of Gemma. The historical inflow estimate is based on archived observations. Field-level delivery still requires reservoir releases, water withdrawals and canal losses or measured delivery. Assessing a shortage also requires demand for the same period.

## Run the full prototype locally

From the repository root, with Python 3.10 or newer:

```sh
SNOW2CROP_MODEL_DISABLED=1 python3 server.py
```

Open [localhost:8765](http://127.0.0.1:8765/). This mode runs the interface, trends and data-based checks. To use live chat with an existing Snow2Crop inference service, set `SNOW2CROP_GEMMA_BACKEND` to its base URL and restart the app. Model weights and adapters are outside this repository.

To rebuild the offline demo after changing the trend code or data, run `python3 tools/build_jury_demo.py`. To regenerate the annual data from a NASA POWER Daily response containing T2M and PRECTOTCORR, run `python3 tools/build_power_trends.py power.json data/power-trends.json` first.

Snow2Crop source code is licensed under [Apache 2.0](LICENSE). Third-party imagery and datasets retain their original terms.
