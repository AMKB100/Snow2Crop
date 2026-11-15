"""Field weather and water delivery based on distinct sources."""
from datetime import datetime, timedelta
import json
from math import isfinite
import re
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import urlopen
from zoneinfo import ZoneInfo

SOURCE = 'https://open-meteo.com/en/docs'
MESSAGES = {
    'ru': ('Подача воды неизвестна. Нужны данные оператора о подаче именно на ваше поле.',
           '{day}: ожидаемые осадки — {rain:g} мм. Испарение с эталонной травы — {et:g} мм. Для решения о поливе нужны культура, влажность почвы и данные о подаче.',
           'Прогноз погоды на эту дату недоступен. Попробуйте позже.'),
    'en': ('Water delivery is unknown. Ask the operator for delivery records for your field.',
           '{day}: expected precipitation is {rain:g} mm. Reference grass evapotranspiration is {et:g} mm. Irrigation decisions also need crop, soil moisture and delivery data.',
           'Weather for this date is unavailable. Try again later.'),
    'uz': ('Suv yetkazib berish hajmi noma’lum. Dalangizga suv yetkazish ma’lumotlarini operatordan so‘rang.',
           '{day}: kutilayotgan yog‘in {rain:g} mm. Etalon o‘t qoplamasidan bug‘lanish {et:g} mm. Sug‘orish uchun ekin, tuproq namligi va suv yetkazish ma’lumotlari ham kerak.',
           'Bu sana uchun ob-havo prognozi mavjud emas. Keyinroq urinib ko‘ring.'),
}


def coordinates(value):
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError('location')
    if value.startswith(('https://', 'http://')):
        link = urlsplit(value)
        if link.hostname in {'google.com', 'www.google.com', 'maps.google.com'} and (link.path.startswith('/maps') or link.hostname == 'maps.google.com'):
            params = parse_qs(link.query)
            pin = re.search(r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)', link.path)
            value = ', '.join(pin.groups()) if pin else (params.get('query') or params.get('q') or [''])[0]
        else:
            raise ValueError('location')
    match = re.fullmatch(r'\s*(-?\d{1,3}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)\s*', value)
    if not match:
        raise ValueError('location')
    lat, lon = map(float, match.groups())
    if not -90 < lat < 90 or not -180 <= lon <= 180:
        raise ValueError('location')
    return round(lat, 2), round(lon, 2)


def weather(lat, lon, day):
    query = urlencode({'latitude': lat, 'longitude': lon, 'timezone': 'auto',
                       'forecast_days': 7, 'daily': 'precipitation_sum,et0_fao_evapotranspiration'})
    try:
        with urlopen('https://api.open-meteo.com/v1/forecast?' + query, timeout=8) as response:
            data = json.load(response)
        daily = data['daily']
        index = daily['time'].index(day)
        if any(data['daily_units'][key] != 'mm' for key in ('precipitation_sum', 'et0_fao_evapotranspiration')):
            return None
        values = tuple(daily[key][index] for key in ('precipitation_sum', 'et0_fao_evapotranspiration'))
        if all(type(value) in (int, float) and isfinite(value) and value >= 0 for value in values):
            return values
    except (OSError, ValueError, KeyError, IndexError, TypeError):
        pass
    return None


def field_answer(location, day, language):
    lat, lon = coordinates(location)
    day = day or (datetime.now(ZoneInfo('Asia/Tashkent')).date() + timedelta(days=1)).isoformat()
    delivery, forecast, missing = MESSAGES[language]
    values = weather(lat, lon, day)
    if values is None:
        return f'{delivery}\n\n{missing}'
    rain, et = values
    return f'{delivery}\n\n{forecast.format(day=day, rain=rain, et=et)}\nOpen-Meteo: {SOURCE}'
