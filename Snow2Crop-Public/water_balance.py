"""Scenario water balance for the Chirchik–Charvak irrigation corridor."""
from datetime import date, datetime, timedelta
from math import isfinite
from pathlib import Path
from zoneinfo import ZoneInfo
import json

LIMITS = {
    'area': 100_000, 'swe': 10_000, 'melt': 100, 'runoff': 100,
    'other': 100_000, 'storage': 100_000, 'gazalkent': 100_000,
    'chirchik': 100_000, 'intake': 100_000, 'loss': 100,
}


def calculate(inputs):
    if not isinstance(inputs, dict) or inputs.keys() != LIMITS.keys():
        raise ValueError('Incomplete scenario')
    for name, limit in LIMITS.items():
        value = inputs[name]
        minimum = -limit if name == 'storage' else 0
        if type(value) not in (int, float) or not minimum <= value <= limit or not isfinite(value):
            raise ValueError(name)
    snow = inputs['area'] * inputs['swe'] / 1000  # km² × mm → million m³
    melt = snow * inputs['melt'] / 100
    snow_inflow = melt * inputs['runoff'] / 100
    total_inflow = snow_inflow + inputs['other']
    release = total_inflow - inputs['storage']
    if release < 0:
        raise ValueError('Reservoir retention exceeds inflow')
    at_gazalkent = max(0, release - inputs['gazalkent'])
    at_intake = max(0, at_gazalkent - inputs['chirchik'])
    diverted = min(at_intake, inputs['intake'])
    delivered = diverted * (1 - inputs['loss'] / 100)
    return {key: round(value, 3) for key, value in {
        'snowStock': snow, 'snowMelt': melt, 'snowInflow': snow_inflow,
        'totalInflow': total_inflow, 'release': release, 'afterGazalkent': at_gazalkent,
        'atIntake': at_intake, 'diverted': diverted, 'delivered': delivered,
        'deliveryGap': inputs['intake'] * (1 - inputs['loss'] / 100) - delivered,
    }.items()}


# SIC ICWC report of 17 November: only the two daily-average columns.
BOZSU_DAILY = {'2006-11-15': 55, '2006-11-16': 51}

FIELD_MESSAGES = {
    'ru': (
        'За {day} у ГЭС № 6 на Бозсу средний расход составил {flow} м³/с. За сутки через створ прошло {gross:.3f} млн м³.',
        'Демонстрационный сценарий: если на выбранные поля направить 10–30% этого объёма уже с учётом отборов и потерь, до них дойдёт {low:.3f}–{high:.3f} млн м³.',
        'Доли 10–30% условные. Фактическая подача и дефицит неизвестны без данных о распределении, потерях и потребности полей.',
        'На выбранную дату нет подключённого суточного замера у ГЭС № 6 на Бозсу. Для примера выберите 15 или 16 ноября 2006 года.',
    ),
    'en': (
        'On {day}, mean flow at Bozsu HPP No. 6 was {flow} m³/s. The daily volume through the gauge was {gross:.3f} million m³.',
        'Illustrative scenario: if 10–30% of that volume reaches the selected fields after withdrawals and losses, delivery would be {low:.3f}–{high:.3f} million m³.',
        'The 10–30% shares are assumptions. Actual delivery and shortage require allocation, loss and field demand records.',
        'No daily Bozsu HPP No. 6 measurement is available for this date. Try 15 or 16 November 2006.',
    ),
    'uz': (
        '{day} kuni Bo‘zsuvdagi 6-GESda o‘rtacha suv sarfi {flow} m³/s bo‘lgan. Bir sutkada o‘lchov nuqtasidan {gross:.3f} mln m³ suv o‘tgan.',
        'Namuna ssenariysi: suv olish va yo‘qotishlardan so‘ng shu hajmning 10–30 foizi dalalarga yetib borsa, yetkazilgan hajm {low:.3f}–{high:.3f} mln m³ bo‘ladi.',
        '10–30% ulush shartli. Haqiqiy yetkazib berish va tanqislikni aniqlash uchun taqsimot, yo‘qotishlar va dalalar talabi kerak.',
        'Bu sana uchun Bo‘zsuvdagi 6-GESning sutkalik o‘lchovi mavjud emas. Misol uchun 2006-yil 15 yoki 16-noyabrni tanlang.',
    ),
}


def field_delivery(day, language):
    measured, scenario, caveat, unavailable = FIELD_MESSAGES[language]
    flow = BOZSU_DAILY.get(day)
    if flow is None:
        return recent_flow(day, language) if not day or day >= "2026-01-01" else unavailable
    gross = flow * 86400 / 1_000_000
    parts = (measured.format(day=day, flow=flow, gross=gross),
             scenario.format(low=gross * 0.10, high=gross * 0.30), caveat)
    return '\n\n'.join(parts)


RECENT_FLOW_FILE = Path(__file__).resolve().parent / 'data/recent-river-flow.json'
RECENT_MESSAGES = {
    'ru': (
        'Прогноз на {target}: если расход у устья Бозсу сохранится на уровне замера за {observed}, за сутки через устье пройдёт около {volume:.3f} млн м³ ({bozsu:g} м³/с).',
        'По замерам за {observed}: сброс Чарвака — {charvak:g} м³/с, Чирчик у Чиназа — {chinaz:g} м³/с, устье Бозсу — {bozsu:g} м³/с.',
        'Прогноз по последнему замеру доступен в пределах трёх суток. Последний подключённый замер — {observed}.',
        'Объём подачи на поля неизвестен. Для расчёта нужны замеры на входе в нужный канал, распределение воды и потери до полей.',
    ),
    'en': (
        'Forecast for {target}: if flow at the Bozsu mouth stays at the {observed} daily average, about {volume:.3f} million m³ will pass in one day ({bozsu:g} m³/s).',
        'Daily observations for {observed}: Charvak release {charvak:g} m³/s, Chirchik at Chinaz {chinaz:g} m³/s, Bozsu mouth {bozsu:g} m³/s.',
        'The last-observation forecast is available for up to three days. Latest usable observation: {observed}.',
        'Field delivery remains unknown. The calculation requires measurements at the relevant canal intake, allocation and downstream losses.',
    ),
    'uz': (
        '{target} uchun prognoz: Bo‘zsuv quyilish joyida suv sarfi {observed} kungi darajada qolsa, bir sutkada taxminan {volume:.3f} mln m³ suv o‘tadi ({bozsu:g} m³/s).',
        '{observed} kungi o‘lchovlar: Chorvoqdan chiqarish {charvak:g} m³/s, Chinozda Chirchiq {chinaz:g} m³/s, Bo‘zsuv quyilishida {bozsu:g} m³/s.',
        'So‘nggi o‘lchov asosidagi prognoz uch sutkagacha amal qiladi. So‘nggi mavjud o‘lchov: {observed}.',
        'Dalalarga suv yetkazish hajmi noma’lum. Hisoblash uchun kanal kirishidagi o‘lchovlar, suv taqsimoti va yo‘qotishlar kerak.',
    ),
}


def recent_flow(day, language):
    target = date.fromisoformat(day) if day else datetime.now(ZoneInfo('Asia/Tashkent')).date() + timedelta(days=1)
    rows = json.loads(RECENT_FLOW_FILE.read_text())
    observed = max((stamp for stamp in rows if stamp <= target.isoformat()), default=None)
    forecast, measured, stale, caveat = RECENT_MESSAGES[language]
    if observed is None:
        return FIELD_MESSAGES[language][-1]
    row = rows[observed]
    days_ahead = (target - date.fromisoformat(observed)).days
    parts = []
    if 0 < days_ahead <= 3:
        parts.append(forecast.format(target=target, observed=observed, volume=row['bozsu'] * 0.0864, **row))
    elif days_ahead > 3:
        parts.append(stale.format(observed=observed))
    parts += [measured.format(observed=observed, **row), caveat, row['source']]
    return '\n\n'.join(parts)
