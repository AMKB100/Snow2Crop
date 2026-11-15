"""Estimate snow water using the image footprint and ERA5-Land snow depth."""
from functools import lru_cache
import json
from math import isfinite
from statistics import median
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

# Sample the mountain sector of the Chirchik study area.
POINTS = [(41.55, 70.15), (41.8, 70.4), (42.05, 70.65), (41.8, 71.05), (42.05, 71.35)]


@lru_cache(maxsize=64)
def snow_depth(stamp):
    query = urlencode({
        'latitude': ','.join(str(lat) for lat, _ in POINTS),
        'longitude': ','.join(str(lon) for _, lon in POINTS),
        'start_date': stamp, 'end_date': stamp, 'hourly': 'snow_depth',
        'models': 'era5_land', 'timezone': 'Asia/Tashkent',
    })
    try:
        with urlopen('https://archive-api.open-meteo.com/v1/archive?' + query, timeout=12) as response:
            grids = json.load(response)
        depths = []
        for grid in grids:
            if grid['hourly_units']['snow_depth'] != 'm':
                continue
            values = [depth for time, depth in zip(grid['hourly']['time'], grid['hourly']['snow_depth'])
                      if time[:10] == stamp and type(depth) in (int, float)
                      and isfinite(depth) and 0 <= depth < 30]
            if len(values) >= 18:
                depths.append(median(values))
        return median(depths) if len(depths) >= 3 else None
    except (URLError, OSError, ValueError, KeyError, TypeError):
        return None


def estimate(percent, footprint, depth):
    area = footprint * percent / 100
    if depth is None or (depth == 0 and area > 0):
        return area, None, None
    # Scenario density, kg/m³. Depth in metres × density gives SWE in mm.
    swe = (depth * 200, depth * 400)
    return area, swe, tuple(area * value / 1000 for value in swe)


def report(percent, footprint, depth, language):
    area, swe, stock = estimate(percent, footprint, depth)
    labels = {
        'ru': ('Экспериментальный прогноз ИИ на следующий день: {p}% снега, около {a:.1f} км².',
               'Медианная глубина ERA5-Land по горным точкам на дату снимка: {d:.2f} м. При принятой плотности 200–400 кг/м³ водный эквивалент составляет {s0:.1f}–{s1:.1f} мм, запас — около {v0:.2f}–{v1:.2f} млн м³.',
               'Для этой даты нет согласованной оценки глубины снега. Объём воды пока неизвестен.',
               'Это оценка запаса в пределах кадра. Для доставки до полей нужны сбросы и водозаборы.'),
        'en': ('Experimental next-day AI estimate: {p}% snow, about {a:.1f} km².',
               'ERA5-Land median snow depth at mountain sample points on the image date: {d:.2f} m. Assuming 200–400 kg/m³, SWE is {s0:.1f}–{s1:.1f} mm and water storage is about {v0:.2f}–{v1:.2f} million m³.',
               'Snow depth is unavailable or inconsistent for this date. Water volume is unknown.',
               'This estimates storage in the image footprint. Field delivery requires release and withdrawal data.'),
        'uz': ('Sun’iy intellektning keyingi kun uchun tajribaviy bahosi: {p}% qor, taxminan {a:.1f} km².',
               'Tasvir sanasida tog‘ nuqtalarida ERA5-Land median qor chuqurligi: {d:.2f} m. Zichlik 200–400 kg/m³ deb olinsa, qor suv ekvivalenti {s0:.1f}–{s1:.1f} mm, zaxira taxminan {v0:.2f}–{v1:.2f} mln m³.',
               'Bu sana uchun qor chuqurligi yo‘q yoki ma’lumotlar mos kelmaydi. Suv hajmi noma’lum.',
               'Bu tasvir hududidagi suv zaxirasi. Dalalarga yetkazishni hisoblash uchun suv chiqarish va olish ma’lumotlari kerak.'),
    }[language]
    detail = labels[2] if swe is None else labels[1].format(d=depth, s0=swe[0], s1=swe[1], v0=stock[0], v1=stock[1])
    return '\n'.join((labels[0].format(p=percent, a=area), detail, labels[3]))
