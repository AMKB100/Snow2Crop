# NASA Space Apps 2026 submission

## Project Summary

Snow2Crop helps users detect long-term weather trends near the Chirchik River basin in Uzbekistan. Users choose a NASA POWER variable, explore annual changes from 1981 to 2025, and check the direction, size and statistical significance of each trend. NASA MODIS Terra imagery provides geographic context. An irrigation case shows what additional records are needed to estimate water delivery to a field.

## NASA Data

- NASA POWER Daily API — https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- NASA GIBS / MODIS Terra satellite imagery — https://nasa-gibs.github.io/gibs-api-docs/

## Space Agency Partner & Other Data

- Uzhydromet archive, station 16924 — https://hydrosolutions.github.io/caham_book/discharge_station_data.html
- Open-Meteo Forecast API — https://open-meteo.com/en/docs
- ERA5-Land snow depth via Open-Meteo — https://open-meteo.com/en/docs/historical-weather-api

## Use of AI

The live prototype uses Gemma with MLX and fine-tuned adapters. It combines model tasks with deterministic calculations and source-backed chat responses. Trend statistics are computed independently from the NASA POWER time series.

## Links

- Final Project: public GitHub repository on the main branch.
- Project Demo: public link to the seven-slide presentation. Verify it in a private browser window.
- Optional interactive demo: publish the repository's docs folder through GitHub Pages. It runs without credentials or a model server.
