const byId = (id) => document.getElementById(id);
const setText = (id, value) => { byId(id).textContent = value; };
const languages = { en: 'en', ru: 'ru-RU', uz: 'uz-Latn-UZ' };
const themes = ['light', 'dark', 'system'];
const storageKey = 'snow2crop.settings';

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

const saved = readSettings();
let language = Object.hasOwn(languages, saved.language) ? saved.language : 'en';
let theme = themes.includes(saved.theme) ? saved.theme : 'light';
let clickVolume = Number.isInteger(saved.clickVolume) && saved.clickVolume >= 0 && saved.clickVolume <= 100
  ? saved.clickVolume : 30;
const feedback = createInteractionFeedback(() => clickVolume);
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let numberFormat;
let dateFormat;

function t(key, ...values) {
  const index = ['en', 'ru', 'uz'].indexOf(language);
  return translations[key][index].replace(/\{(\d+)\}/g, (_, position) => values[position] ?? '');
}

function number(value) {
  return Number.isFinite(value) ? numberFormat.format(value) : '—';
}

function applyTheme() {
  document.documentElement.dataset.theme = theme === 'system'
    ? (systemTheme.matches ? 'dark' : 'light')
    : theme;
  byId('theme-choice').value = theme;
}

function saveSettings() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ language, theme, clickVolume }));
  } catch {
    // Preferences still work for this page if the browser blocks storage.
  }
}

const isoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const uzMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

function displayDate(value) {
  const day = new Date(value);
  if (language !== 'uz') return dateFormat.format(day);
  return `${day.getUTCDate()}-${uzMonths[day.getUTCMonth()]} ${day.getUTCFullYear()}`;
}
const tabs = ['map', 'charts', 'forecast', 'settings'];
const slider = byId('date-slider');
const yearSelect = byId('archive-year');
const modeSelect = byId('archive-mode');
let dailyRows = [];
let dailyLoad;
let activeTab = 'map';
let clearDaily = [];
let clearMonthly = [];
const latestImageButton = byId('latest-image');
let dailyMode = false;
let selectedIndex = -1;
let years = new Map();
const monthButtons = Array.from({ length: 12 }, (_, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.disabled = true;
  button.addEventListener('click', () => chooseMonth(index + 1));
  byId('archive-months').append(button);
  return button;
});
let observations = [];
let forecasts = new Map();
let latestForecastIndex = -1;
let failures = [];

function mapIndices() {
  return dailyMode ? clearDaily : clearMonthly;
}

function dateAt(index) {
  if (activeTab === 'map') return dailyRows[mapIndices()[index]]?.[0];
  return dailyMode ? dailyRows[index]?.[0] : observations[index]?.date;
}

function dateCount() {
  if (activeTab === 'map') return mapIndices().length;
  return dailyMode ? dailyRows.length : observations.length;
}

function selectDate(stamp) {
  rebuildMonths();
  const indices = Array.from({ length: dateCount() }, (_, index) => index);
  const exact = indices.find((index) => dateAt(index) === stamp);
  const month = stamp ? years.get(stamp.slice(0, 4))?.get(Number(stamp.slice(5, 7))) : undefined;
  const previous = stamp ? indices.findLast((index) => dateAt(index) < stamp) : undefined;
  selectedIndex = exact ?? month ?? previous ?? dateCount() - 1;
}

function rebuildMonths() {
  years = new Map();
  for (let index = 0; index < dateCount(); index++) {
    const stamp = dateAt(index);
    const year = stamp.slice(0, 4);
    const month = Number(stamp.slice(5, 7));
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    const previous = months.get(month);
    const preferDate = activeTab !== 'map' && previous !== undefined
      && (dailyMode ? stamp.endsWith('-15') : !observations[previous].image && observations[index].image);
    if (previous === undefined || preferDate) {
      months.set(month, index);
    }
  }
  yearSelect.replaceChildren(...[...years.keys()].reverse().map((year) => new Option(year, year)));
  yearSelect.disabled = !years.size;
}

function chooseMonth(month) {
  const index = years.get(yearSelect.value)?.get(month);
  if (index !== undefined) selectIndex(index);
}

function updateMonthLabels() {
  const full = new Intl.DateTimeFormat(languages[language], { month: 'long', timeZone: 'UTC' });
  const short = new Intl.DateTimeFormat(languages[language], { month: 'short', timeZone: 'UTC' });
  monthButtons.forEach((button, index) => {
    const month = new Date(Date.UTC(2020, index, 1));
    button.textContent = language === 'uz' ? uzMonths[index].slice(0, 3) : short.format(month);
    button.setAttribute('aria-label', language === 'uz' ? uzMonths[index] : full.format(month));
  });
}

function syncTimeline(stamp) {
  const maximum = Math.max(0, dateCount() - 1);
  slider.max = maximum;
  slider.value = Math.max(0, selectedIndex);
  slider.disabled = maximum === 0;
  slider.setAttribute('aria-valuetext', stamp ? displayDate(stamp) : t('awaitData'));
  slider.style.setProperty('--timeline-progress', maximum ? `${100 * selectedIndex / maximum}%` : '0%');
  yearSelect.value = stamp?.slice(0, 4) ?? '';
  const activeMonth = Number(stamp?.slice(5, 7));
  const months = years.get(yearSelect.value);
  monthButtons.forEach((button, index) => {
    const month = index + 1;
    button.disabled = !months?.has(month);
    button.setAttribute('aria-pressed', String(month === activeMonth));
  });
}

function selectIndex(index) {
  if (index < 0 || index >= dateCount() || index === selectedIndex) return;
  selectedIndex = index;
  render();
}

function applyLanguage() {
  document.documentElement.lang = languages[language];
  document.title = t('pageTitle');
  numberFormat = new Intl.NumberFormat(language === 'uz' ? 'ru-RU' : languages[language], { maximumFractionDigits: 1 });
  dateFormat = new Intl.DateTimeFormat(languages[language], { dateStyle: 'medium', timeZone: 'UTC' });
  byId('language-choice').value = language;
  for (const element of document.querySelectorAll('[data-text]')) element.textContent = t(element.dataset.text);
  for (const element of document.querySelectorAll('[data-label]')) element.setAttribute('aria-label', t(element.dataset.label));
  for (const element of document.querySelectorAll('[data-alt]')) element.alt = t(element.dataset.alt);
  updateMonthLabels();
  render();
}

function changeTab() {
  const hash = location.hash.slice(1);
  const active = tabs.includes(hash) ? hash : 'map';
  if (active !== activeTab) {
    const stamp = dateAt(selectedIndex);
    activeTab = active;
    selectDate(stamp);
    render();
  }
  byId('date-toolbar').hidden = !['map', 'charts'].includes(active);
  byId('data-status').hidden = active === 'settings';
  byId('recent-imagery').hidden = active !== 'map';
  for (const tab of tabs) {
    byId(tab).hidden = tab !== active;
    const link = document.querySelector(`nav a[href="#${tab}"]`);
    if (tab === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function imagePlaceholder(label) {
  byId('satellite').hidden = true;
  byId('satellite-frame').hidden = true;
  byId('map-placeholder').hidden = false;
  setText('map-status', t(label));
  setText('map-placeholder-text', t(label));
  setText('image-source', t('imageSource'));
  setText('image-date', '');
}

function showImage(image, noImageLabel) {
  const element = byId('satellite');
  element.onload = null;
  element.onerror = null;
  element.removeAttribute('src');
  imagePlaceholder(image ? 'awaitImage' : noImageLabel);
  if (!isoDate(image?.date)) return;
  const path = typeof image.path === 'string' ? image.path : '';
  const archived = /^data\/(raw\/expanded\/(daily|replacements)\/terra-rgb\/|mlx\/\d{4}-\d{2}-\d{2}\/input-\d{4}-\d{2}-\d{2}\/)[a-z0-9/_-]+\.jpg$/i;
  const displayAsset = /^assets\/[a-z0-9/_-]+\.(jpe?g|png|webp)$/i;
  if (!displayAsset.test(path) && !(image.tile && archived.test(path))) {
    imagePlaceholder('imageUnavailable');
    return;
  }
  const frame = byId('satellite-frame');
  frame.classList.toggle('tile', Boolean(image.tile));
  element.onload = () => {
    element.hidden = false;
    frame.hidden = false;
    byId('map-placeholder').hidden = true;
    setText('map-status', t('image'));
    setText('image-source', image.source || t('imageSource'));
    setText('image-date', displayDate(image.date));
  };
  element.onerror = () => imagePlaceholder('imageUnavailable');
  element.src = path;
}

function showChart(series, cutoff) {
  const svg = byId('chart-svg');
  svg.replaceChildren();
  const points = (Array.isArray(series) ? series : [])
    .filter((point) => isoDate(point?.date) && point.date <= cutoff
      && Number.isFinite(point.seasonMm) && point.seasonMm >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const hasChart = points.length > 1 && points[0].date !== points.at(-1).date;
  svg.toggleAttribute('hidden', !hasChart);
  byId('chart-empty').hidden = hasChart;
  const labels = byId('chart-dates');
  labels.replaceChildren();
  if (!hasChart) return;

  const width = 700;
  const height = 230;
  const left = 45;
  const right = width - 14;
  const bottom = height - 15;
  const top = 12;
  const first = Date.parse(points[0].date);
  const duration = Date.parse(points.at(-1).date) - first;
  const peak = points.reduce((max, point) => Math.max(max, point.seasonMm,
    Number.isFinite(point.averageMm) ? point.averageMm : 0), 0);
  const step = Math.max(1, Math.ceil(peak / 4));
  const x = (date) => left + (Date.parse(date) - first) / duration * (right - left);
  const y = (value) => bottom - value / (step * 4) * (bottom - top);
  const add = (name, attributes, label) => {
    const item = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, value);
    if (label !== undefined) item.textContent = label;
    svg.append(item);
  };
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  for (let i = 0; i <= 4; i++) {
    const axisY = y(step * i);
    add('line', { x1: left, x2: right, y1: axisY, y2: axisY, stroke: 'var(--line)' });
    add('text', { x: left - 7, y: axisY + 4, 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 12 }, number(step * i));
  }
  for (const [field, stroke] of [['averageMm', 'var(--historical)'], ['seasonMm', 'var(--accent)']]) {
    let path = '';
    let started = false;
    for (const point of points) {
      const value = point[field];
      if (!Number.isFinite(value) || value < 0) {
        started = false;
        continue;
      }
      path += `${started ? 'L' : 'M'}${x(point.date)},${y(value)} `;
      started = true;
    }
    add('path', {
      d: path.trim(), fill: 'none', stroke, 'stroke-width': 2.5,
      'stroke-dasharray': field === 'averageMm' ? '5 4' : 'none',
    });
  }
  for (const point of [points[0], points.at(-1)]) {
    const label = document.createElement('span');
    label.textContent = displayDate(point.date);
    labels.append(label);
  }
}

const forecastText = new Map([
  ...['weatherModel', 'satelliteModel', 'legacyModel', 'weatherNote', 'satelliteNote', 'legacyNote',
    'dateReason', 'earlyReason', 'modelReason'].map((key) => [translations[key][0], key]),
  ['Forecasts are evaluated on the 15th of each month from December through April.', 'dateReason'],
  ['The model did not outperform both historical benchmarks on earlier seasons.', 'modelReason'],
]);

function translatedForecastText(value, fallback) {
  const key = forecastText.get(value);
  return key ? t(key) : value || t(fallback);
}

function showForecast(forecast) {
  const validation = forecast?.validation;
  const verified = forecast?.status === 'validated' && Number.isFinite(forecast.totalMm)
    && forecast.totalMm >= 0 && Number.isFinite(validation?.maeMm)
    && validation.maeMm >= 0 && Number.isFinite(validation.baselineMaeMm)
    && validation.maeMm < validation.baselineMaeMm
    && Number.isInteger(validation.seasons) && validation.seasons > 0;
  const range = forecast?.rangeMm;
  const hasRange = verified && Number.isFinite(range?.low) && Number.isFinite(range?.high)
    && range.low >= 0 && range.low <= forecast.totalMm && range.high >= forecast.totalMm;
  const unit = t('mm');
  setText('forecast-status', t(verified ? 'validated' : 'awaitValidation'));
  setText('forecast-value', verified ? number(forecast.totalMm) : '—');
  setText('forecast-range', hasRange ? t('range', number(range.low), number(range.high), unit)
    : t(verified ? 'noRange' : 'rangePending'));
  setText('forecast-method', verified
    ? translatedForecastText(forecast.method, 'genericModel') : t('forecastPending'));
  setText('forecast-note', verified ? translatedForecastText(forecast.note, 'genericNote')
    : translatedForecastText(forecast?.reason, 'forecastHelp'));
  const analog = Number.isFinite(validation?.analogMaeMm) ? t('analog', number(validation.analogMaeMm), unit) : '';
  setText('forecast-validation', verified
    ? t('validation', number(validation.maeMm), number(validation.baselineMaeMm),
      number(validation.seasons), unit, analog)
    : '');
}

function dailyRecord(index) {
  const row = dailyRows[index];
  if (!row) return undefined;
  const [date, weather, image] = row;
  const [snowMm, normalSnowMm, meanTempC] = weather || [];
  const startYear = Number(date.slice(0, 4)) - (date.slice(5, 7) < '10' ? 1 : 0);
  const seasonStart = `${startYear}-10-01`;
  const series = weather ? dailyRows.slice(Math.max(0, index - 366), index + 1)
    .filter(([day, values]) => day >= seasonStart && values)
    .map(([day, values]) => ({ date: day, seasonMm: values[0], averageMm: values[1] })) : [];
  return { date, snowMm, normalSnowMm, meanTempC, series, image: image ? { ...image, date } : undefined };
}

function render() {
  const index = selectedIndex;
  const record = activeTab === 'map' ? dailyRecord(mapIndices()[index])
    : dailyMode ? dailyRecord(index) : observations[index];
  const lastIndex = dateCount() - 1;
  syncTimeline(record?.date);
  latestImageButton.disabled = !clearDaily.length;
  setText('recent-image-status', clearDaily.length
    ? t('clearLatest', displayDate(dailyRows[clearDaily.at(-1)][0])) : '');
  byId('previous').disabled = !record || index === 0;
  byId('next').disabled = !record || index === lastIndex;
  setText('data-status', failures.map((failure) => t(failure)).join(' '));
  setText('date-label', record ? displayDate(record.date) : t('awaitData'));
  if (activeTab === 'forecast') {
    document.dispatchEvent(new CustomEvent('snow2crop:forecast-date', { detail: record?.date }));
  }
  setText('snow', number(record?.snowMm));
  setText('temperature', number(record?.meanTempC));
  setText('cover', number(record?.snowCover?.percent));
  setText('coverage', Number.isFinite(record?.snowCover?.validAreaPercent)
    ? t('coverage', number(record.snowCover.validAreaPercent))
    : t('coverPending'));
  const normal = record?.normalSnowMm;
  setText('comparison', Number.isFinite(record?.snowMm) && Number.isFinite(normal)
    ? normal < 1 ? t('tooEarly') : t('comparison', number((record.snowMm / normal - 1) * 100), number(normal), t('mm'))
    : t(dailyMode && record ? 'dailyNoWeather' : 'comparisonHelp'));
  if (activeTab === 'map') showImage(record?.image, 'noClearImage');
  showChart(record?.series, record?.date);
  showForecast(forecasts.get(record?.date));
  byId('latest-forecast').hidden = latestForecastIndex < 0 || observations[latestForecastIndex].date === record?.date;
}

async function loadFile(file, key) {
  const response = await fetch(`./data/${file}.json`);
  if (!response.ok) throw new Error(file);
  const data = await response.json();
  if (data.schemaVersion !== 1 || !Array.isArray(data[key])) throw new Error(file);
  return data[key];
}

async function load() {
  const [history, outlook, archive] = await Promise.allSettled([
    loadFile('observations', 'observations'), loadFile('forecasts', 'forecasts'), loadClearArchive(),
  ]);
  if (archive.status === 'rejected') failures.push('clearArchiveError');
  if (outlook.status === 'fulfilled') {
    forecasts = new Map(outlook.value.filter((item) => isoDate(item?.date)).map((item) => [item.date, item]));
  }
  if (history.status === 'fulfilled') {
    const unique = new Map(history.value.filter((item) => isoDate(item?.date)).map((item) => [item.date, item]));
    observations = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  latestForecastIndex = observations.reduce((latest, item, index) =>
    forecasts.get(item.date)?.status === 'validated' ? index : latest, -1);
  selectDate(dateAt(selectedIndex));
  modeSelect.disabled = false;
  if (history.status === 'rejected') failures.push('observationError');
  if (outlook.status === 'rejected') failures.push('forecastError');
  render();
}

async function ensureDailyRows() {
  if (dailyRows.length) return;
  dailyLoad ||= loadFile('daily-map', 'days').then((rows) => {
    if (!rows.length) throw new Error('Empty archive');
    dailyRows = rows;
  }).finally(() => { dailyLoad = undefined; });
  await dailyLoad;
}

async function loadClearArchive() {
  const [, frames] = await Promise.all([ensureDailyRows(), loadFile('clear-imagery', 'frames')]);
  const accepted = new Map(frames);
  const byMonth = new Map();
  clearDaily = [];
  const distance = (date) => Math.abs(Number(date.slice(8, 10)) - 15);
  dailyRows.forEach(([stamp, , image], index) => {
    if (!image || accepted.get(stamp) !== image.path) return;
    clearDaily.push(index);
    const key = stamp.slice(0, 7);
    const previous = byMonth.get(key);
    if (previous === undefined || distance(stamp) < distance(dailyRows[previous][0])) {
      byMonth.set(key, index);
    }
  });
  clearMonthly = [...byMonth.values()];
}

async function changeDateMode() {
  const requestedDaily = modeSelect.value === 'daily';
  if (requestedDaily && !dailyRows.length) {
    modeSelect.disabled = true;
    try {
      await ensureDailyRows();
      failures = failures.filter((key) => key !== 'dailyError');
    } catch {
      modeSelect.value = 'monthly';
      if (!failures.includes('dailyError')) failures.push('dailyError');
      render();
      return;
    } finally {
      modeSelect.disabled = false;
    }
  }
  const stamp = dateAt(selectedIndex);
  dailyMode = requestedDaily;
  selectDate(stamp);
  render();
}

latestImageButton.addEventListener('click', async () => {
  modeSelect.value = 'daily';
  await changeDateMode();
  if (activeTab === 'map') selectIndex(dateCount() - 1);
});
window.addEventListener('hashchange', changeTab);
modeSelect.addEventListener('change', changeDateMode);
yearSelect.addEventListener('change', () => {
  const months = years.get(yearSelect.value);
  if (!months?.size) return;
  const currentMonth = Number(dateAt(selectedIndex)?.slice(5, 7)) || 1;
  const nearest = [...months.keys()].reduce((best, month) =>
    Math.abs(month - currentMonth) < Math.abs(best - currentMonth) ? month : best);
  chooseMonth(nearest);
});
slider.addEventListener('input', () => {
  const index = Number(slider.value);
  if (index !== selectedIndex) feedback.play('tick');
  selectIndex(index);
});
byId('previous').addEventListener('click', () => selectIndex(selectedIndex - 1));
byId('next').addEventListener('click', () => selectIndex(selectedIndex + 1));
window.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    || byId('date-toolbar').hidden || event.target.closest?.('input, select, textarea, button, a, [contenteditable]')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const index = selectedIndex + (event.key === 'ArrowLeft' ? -1 : 1);
    if (index >= 0 && index < dateCount()) feedback.play('tick');
    selectIndex(index);
  }
});
byId('latest-forecast').addEventListener('click', () => {
  const date = observations[latestForecastIndex]?.date;
  if (date) selectIndex(dailyMode ? dailyRows.findIndex(([day]) => day === date) : latestForecastIndex);
});
byId('theme-choice').addEventListener('change', (event) => {
  theme = event.target.value;
  applyTheme();
  saveSettings();
});
byId('language-choice').addEventListener('change', (event) => {
  language = event.target.value;
  applyLanguage();
  saveSettings();
});
const volumeSlider = byId('click-volume');
volumeSlider.value = clickVolume;
setText('click-volume-value', `${clickVolume}%`);
volumeSlider.addEventListener('input', () => {
  clickVolume = Number(volumeSlider.value);
  setText('click-volume-value', `${clickVolume}%`);
  feedback.play('tick');
});
volumeSlider.addEventListener('change', saveSettings);
document.addEventListener('click', (event) => {
  if (event.target.closest?.('button:not(:disabled), a[href^="#"]')) feedback.play('tap');
});
document.addEventListener('change', (event) => {
  if (event.target.matches?.('select')) feedback.play('tap');
});
document.addEventListener('pointerup', (event) => {
  // On touch devices the audio gesture becomes active on release.
  if (event.pointerType === 'touch' && event.target.matches?.('input[type="range"]')) feedback.play('touch-release');
});
systemTheme.addEventListener('change', () => {
  if (theme === 'system') applyTheme();
});
applyTheme();
applyLanguage();
changeTab();
load();
