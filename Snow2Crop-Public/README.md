# Snow2Crop

Snow2Crop is a NASA Space Apps prototype for the Chirchik Basin and Tashkent Region. It brings satellite snow observations, weather, historical Charvak inflow and field-level water availability checks into one interface.

**[Try the live demo](https://macbook-pro-amkb100.tail77dd38.ts.net:8443/#forecast)** · Hosted on the team's Mac during judging.

1. Open **Map** to view an archived NASA GIBS / MODIS Terra image.
2. Open **Charts** to compare snow-forming precipitation with the historical average.
3. Open **AI Forecast** to check a field or expand **Other forecasts and AI chat** and choose **Ask AI**. Try: “What data are needed to estimate water delivery to a field near Tashkent?”

## Run locally

With Python 3.10 or later, run from this folder:

```sh
SNOW2CROP_MODEL_DISABLED=1 python3 server.py
```

Open [Snow2Crop on localhost](http://127.0.0.1:8765/). This mode serves the interface and data-based checks. The live chat uses a separately configured Gemma model with MLX. To connect an existing Snow2Crop inference server, replace the setting above with `SNOW2CROP_GEMMA_BACKEND=http://<host>:<port>` and start the application again. Model weights and adapters are distributed separately.

## Data and limitations

Satellite imagery comes from [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) and weather context from [NASA POWER](https://power.larc.nasa.gov/). See [data sources](DATA-SOURCES.md) for details. Historical inflow estimates and field delivery are distinct. Estimating delivery to a specific field requires reservoir releases, withdrawals and canal losses, or measured delivery for that field. Estimating shortage also requires demand for the same period.

## Team

Mukhamedjanov Arslanbek
