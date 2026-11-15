"""Cache dated NASA imagery and weather for the Chirchik map."""
from datetime import datetime, timedelta
from io import BytesIO
import json
from math import isfinite
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo

CACHE = Path(__file__).resolve().parent / 'daily-cache'
ZONE = ZoneInfo('Asia/Tashkent')
GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best'
SENSORS = [('MODIS_Terra', 'Terra', '250m'), ('MODIS_Aqua', 'Aqua', '250m'),
           ('VIIRS_NOAA20', 'VIIRS NOAA-20', '250m')]


def save(path, content):
    temp = path.with_suffix('.part')
    temp.write_bytes(content)
    temp.replace(path)


def refresh():
    from PIL import Image
    CACHE.mkdir(exist_ok=True)
    now = datetime.now(ZONE)
    today = now.date()
    days = [(today - timedelta(days=i)).isoformat() for i in range(7)]
    for day in days:
        if (CACHE / f'{day}.json').is_file():
            continue
        for sensor, label, matrix in SENSORS:
            url = f'{GIBS}/{sensor}_CorrectedReflectance_TrueColor/default/{day}/{matrix}/6/10/55.jpg'
            try:
                with urlopen(url, timeout=6) as response:
                    if response.headers.get('Layer-Time-Actual', '')[:10] != day:
                        continue
                    raw = response.read(2_000_001)
                if len(raw) > 2_000_000:
                    continue
                with Image.open(BytesIO(raw), formats=['JPEG']) as tile:
                    if tile.size != (512, 512):
                        continue
                    crop = tile.crop((159, 307, 478, 455)).convert('RGB')
                    pixels = crop.resize((24, 12)).getdata()
                    if sum(max(pixel) > 15 for pixel in pixels) < 0.9 * len(pixels):
                        continue
                    output = BytesIO()
                    crop.save(output, 'JPEG', quality=92)
                save(CACHE / f'{day}.jpg', output.getvalue())
                save(CACHE / f'{day}.json', json.dumps({'date': day, 'sensor': label}).encode())
                break
            except (OSError, ValueError):
                continue
    params = urlencode(dict(parameters='T2M,PRECTOTCORR', community='AG', longitude=70.3,
                            latitude=41.65, start=days[-1].replace('-', ''), end=days[0].replace('-', ''),
                            format='JSON', **{'time-standard': 'UTC'}))
    try:
        with urlopen('https://power.larc.nasa.gov/api/temporal/daily/point?' + params, timeout=15) as response:
            data = json.load(response)
        fields = data['properties']['parameter']
        fill = data['header']['fill_value']
        weather = []
        for day in days:
            key = day.replace('-', '')
            temp = fields['T2M'].get(key)
            rain = fields['PRECTOTCORR'].get(key)
            if all(type(v) in (float, int) and isfinite(v) and v != fill for v in (temp, rain)) and rain >= 0:
                weather.append({'date': day, 'temperature': temp, 'precipitation': rain})
        if weather:
            save(CACHE / 'weather.json', json.dumps(weather).encode())
    except (OSError, ValueError, KeyError, TypeError):
        pass


def latest():
    images = sorted(CACHE.glob('????-??-??.json'), reverse=True)
    weather = CACHE / 'weather.json'
    return {'image': json.loads(images[0].read_text()) if images else None,
            'weather': json.loads(weather.read_text()) if weather.is_file() else []}
