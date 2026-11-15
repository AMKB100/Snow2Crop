(() => {
  const card = document.getElementById('power-trends');
  const select = document.getElementById('trend-variable');
  const plot = document.getElementById('trend-plot');
  const results = document.getElementById('trend-results');
  const names = ['temperature', 'precipitation', 'coldPrecipitation'];
  const labels = {
    en: ['Earth system trends', 'Variable', 'Annual mean air temperature', 'Annual precipitation', 'Annual precipitation on days below 2 °C', 'Chirchik area · NASA POWER grid point', 'Sen slope', 'per decade', 'Statistically significant', 'No statistically significant trend', 'Two-sided Mann–Kendall test (α = 0.05). Annual values from complete calendar years. The test assumes independent annual observations. Cold-day precipitation is a proxy, not measured snowfall.'],
    ru: ['Многолетние тренды', 'Показатель', 'Среднегодовая температура', 'Годовые осадки', 'Годовые осадки в дни холоднее 2 °C', 'Район Чирчика · точка сетки NASA POWER', 'Наклон Сена', 'за десятилетие', 'Статистически значимый тренд', 'Статистически значимого тренда нет', 'Двусторонний тест Манна–Кендалла (α = 0,05). Взяты полные календарные годы. Тест предполагает независимость годовых наблюдений. Осадки в холодные дни — косвенный показатель снегопада.'],
    uz: ['Ko‘p yillik trendlar', 'Ko‘rsatkich', 'O‘rtacha yillik havo harorati', 'Yillik yog‘in miqdori', '2 °C dan sovuq kunlardagi yillik yog‘in', 'Chirchiq hududi · NASA POWER to‘r nuqtasi', 'Sen qiyaligi', 'har o‘n yilda', 'Statistik jihatdan ahamiyatli trend', 'Statistik jihatdan ahamiyatli trend yo‘q', 'Ikki tomonlama Mann–Kendall testi (α = 0,05). To‘liq kalendar yillari ishlatildi. Test yillik kuzatuvlar mustaqil deb hisoblaydi. Sovuq kunlardagi yog‘in qor miqdorining bilvosita ko‘rsatkichidir.'],
  };

  function trend(rows, key) {
    const slopes = [];
    const ties = new Map();
    let score = 0;
    rows.forEach((row, i) => {
      const value = row[key];
      ties.set(value, (ties.get(value) || 0) + 1);
      for (let j = i + 1; j < rows.length; j++) {
        const delta = rows[j][key] - value;
        score += Math.sign(delta);
        slopes.push(delta / (rows[j].year - row.year));
      }
    });
    slopes.sort((a, b) => a - b);
    const mid = Math.floor(slopes.length / 2);
    const slope = slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
    const n = rows.length;
    const tieCorrection = [...ties.values()].reduce((sum, t) => sum + t * (t - 1) * (2 * t + 5), 0);
    const variance = (n * (n - 1) * (2 * n + 5) - tieCorrection) / 18;
    const z = score && variance ? Math.abs(score - Math.sign(score)) / Math.sqrt(variance) : 0;
    const t = 1 / (1 + 0.2316419 * z);
    const tail = Math.exp(-(z ** 2) / 2) / Math.sqrt(2 * Math.PI) * t *
      (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return { slope, p: Math.min(1, 2 * tail) };
  }

  function svg(name, attrs, value) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, val] of Object.entries(attrs)) element.setAttribute(key, val);
    if (value !== undefined) element.textContent = value;
    return element;
  }

  function drawChart(rows, key, slope, format, unit) {
    const values = rows.map(row => row[key]);
    const first = rows[0].year;
    const last = rows.at(-1).year;
    const intercepts = rows.map(row => row[key] - slope * (row.year - first)).sort((a, b) => a - b);
    const middle = Math.floor(intercepts.length / 2);
    const intercept = intercepts.length % 2 ? intercepts[middle] : (intercepts[middle - 1] + intercepts[middle]) / 2;
    const end = intercept + slope * (last - first);
    const low = Math.min(...values, intercept, end);
    const high = Math.max(...values, intercept, end);
    const x = year => 75 + 660 * (year - first) / (last - first);
    const y = value => 205 - 174 * (value - low) / (high - low || 1);
    plot.replaceChildren();
    for (const fraction of [0, 0.5, 1]) {
      const v = low + fraction * (high - low);
      plot.append(svg('line', {x1: 75, y1: y(v), x2: 735, y2: y(v), stroke: 'currentColor', opacity: 0.18}),
        svg('text', {x: 68, y: y(v) + 5, 'text-anchor': 'end', fill: 'currentColor', 'font-size': 20}, format(v)));
    }
    plot.append(svg('text', {x: 75, y: 23, fill: 'currentColor', 'font-size': 20}, unit));
    for (const year of [first, Math.round((first + last) / 2), last]) {
      plot.append(svg('text', {x: x(year), y: 235, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': 20}, year));
    }
    plot.append(svg('polyline', {points: rows.map(row => `${x(row.year)},${y(row[key])}`).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5}),
      svg('line', {x1: x(first), y1: y(intercept), x2: x(last), y2: y(end), stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-dasharray': '8 6'}));
  }

  const embedded = document.getElementById('embedded-power-trends');
  const data = embedded ? Promise.resolve().then(() => JSON.parse(embedded.textContent)) : fetch('./data/power-trends.json').then(response => {
    if (!response.ok) throw new Error('Trend data unavailable');
    return response.json();
  });
  data.then(({rows, coordinates}) => {
    const render = () => {
      const lang = document.documentElement.lang;
      const l = labels[lang] || labels.en;
      const key = select.value || names[0];
      const format = value => new Intl.NumberFormat(lang, {maximumFractionDigits: 2}).format(value);
      select.replaceChildren(...names.map((name, i) => new Option(l[i + 2], name, false, name === key)));
      document.getElementById('trend-title').textContent = l[0];
      document.getElementById('trend-variable-label').textContent = l[1];
      document.getElementById('trend-location').textContent =
        `${l[5]} · ${coordinates[1]}° N, ${coordinates[0]}° E · ${rows[0].year}–${rows.at(-1).year}`;
      document.getElementById('trend-method').textContent = l[10];
      const {slope, p} = trend(rows, key);
      const unit = key === 'temperature' ? '°C' : 'mm';
      results.replaceChildren(...[`${l[6]}: ${slope > 0 ? '+' : ''}${format(slope * 10)} ${unit} ${l[7]}`,
        `p ${p < 0.001 ? '< 0.001' : '= ' + p.toFixed(3)}`, p < 0.05 ? l[8] : l[9]].map(text => {
        const span = document.createElement('span');
        span.textContent = text;
        return span;
      }));
      drawChart(rows, key, slope, format, unit);
    };
    select.addEventListener('change', render);
    new MutationObserver(render).observe(document.documentElement, {attributeFilter: ['lang']});
    render();
    card.hidden = false;
  }).catch(error => console.warn(error));
})();
