const gemmaForm = byId('gemma-form');
const gemmaStatus = byId('gemma-status');
const gemmaAnswer = byId('gemma-answer');
const gemmaSubmit = byId('gemma-submit');

function encodeGemmaImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const gemmaMode = byId('gemma-mode');
const gemmaQuestion = byId('gemma-question');
const gemmaDate = byId('gemma-date');
const gemmaDateLabel = byId('gemma-date-label');

const fieldDemo = byId('field-demo');
fieldDemo.addEventListener('click', () => {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tashkent' }).format(new Date());
  const tomorrow = new Date(today + 'T00:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  gemmaDate.value = tomorrow.toISOString().slice(0, 10);
  gemmaForm.requestSubmit();
});

const fieldLocation = byId('field-location');

const fieldPhoto = byId('field-photo');
const fieldPhotoPreview = byId('field-photo-preview');
let fieldPhotoUrl;
fieldPhoto.addEventListener('change', () => {
  if (fieldPhotoUrl) URL.revokeObjectURL(fieldPhotoUrl);
  fieldPhotoUrl = fieldPhoto.files[0] ? URL.createObjectURL(fieldPhoto.files[0]) : null;
  if (fieldPhotoUrl) fieldPhotoPreview.src = fieldPhotoUrl;
  else fieldPhotoPreview.removeAttribute('src');
  fieldPhotoPreview.hidden = !fieldPhotoUrl;
});

function updateGemmaMode() {
  const myField = gemmaMode.value === 'field-check';
  byId('field-location-group').hidden = !myField;
  byId('field-photo-group').hidden = !myField;
  fieldLocation.required = myField;
  const heading = byId('gemma-heading');
  heading.dataset.text = gemmaMode.selectedOptions[0].dataset.text;
  heading.textContent = t(heading.dataset.text);
  byId(myField ? 'field-date-slot' : 'forecast-date-slot').append(byId('forecast-date-group'));
  gemmaSubmit.dataset.text = myField ? 'fieldCheckButton' : 'gemmaSend';
  gemmaSubmit.textContent = t(gemmaSubmit.dataset.text);
  const charvak = gemmaMode.value === 'charvak';
  const fieldDelivery = gemmaMode.value === 'field-delivery';
  const archive = myField || charvak || fieldDelivery || gemmaMode.value === 'snow-forecast';
  fieldDemo.hidden = !fieldDelivery;
  const snowStock = gemmaMode.value === 'snow-stock';
  byId('snow-stock-hint').hidden = !snowStock;
  byId('snow-footprint-field').hidden = !snowStock;
  byId('snow-footprint').required = snowStock;
  byId('gemma-image').required = snowStock;
  gemmaQuestion.hidden = archive || snowStock;
  gemmaQuestion.required = !archive && !snowStock;
  gemmaForm.querySelector('label[for="gemma-question"]').hidden = archive || snowStock;
  gemmaForm.querySelector('[data-text="gemmaHint"]').hidden = archive || snowStock;
  byId('gemma-image-field').hidden = archive;
  byId('charvak-hint').hidden = !charvak;
  gemmaDate.required = (archive && !myField) || snowStock;
  gemmaDateLabel.dataset.text = myField ? 'fieldDate' : archive ? 'charvakDate' : 'gemmaDate';
  gemmaDateLabel.textContent = t(gemmaDateLabel.dataset.text);
  gemmaAnswer.hidden = true;
  gemmaStatus.textContent = '';
}
gemmaMode.addEventListener('change', updateGemmaMode);
updateGemmaMode();

gemmaForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (gemmaSubmit.disabled) return;
  const mode = gemmaMode.value;
  const question = mode === 'gemma' ? gemmaQuestion.value.trim() : mode;
  const file = ['gemma', 'snow-stock'].includes(mode) ? byId('gemma-image').files[0] : undefined;
  gemmaAnswer.hidden = true;
  gemmaAnswer.textContent = '';
  if (!question || file?.size > 6000000) {
    gemmaStatus.textContent = t('gemmaInputError');
    return;
  }
  gemmaStatus.textContent = t('gemmaBusy');
  gemmaSubmit.disabled = true;
  try {
    const payload = { question, language, mode, date: gemmaDate.value };
    if (mode === 'field-check') payload.location = fieldLocation.value;
    if (mode === 'snow-stock') payload.footprint = byId('snow-footprint').valueAsNumber;
    if (file) payload.image = await encodeGemmaImage(file);
    const response = await fetch('/api/gemma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      gemmaStatus.textContent = t(response.status === 400 || response.status === 413
        ? (mode === 'field-check' ? 'fieldLocationError' : 'gemmaInputError') : 'gemmaError');
      return;
    }
    gemmaAnswer.textContent = (await response.json()).answer;
    gemmaAnswer.hidden = false;
    gemmaStatus.textContent = '';
  } catch {
    gemmaStatus.textContent = t('gemmaError');
  } finally {
    gemmaSubmit.disabled = false;
  }
});

const waterAssessment = byId('water-assessment');
let waterRequest;
document.addEventListener('snow2crop:forecast-date', async ({ detail: date }) => {
  waterRequest?.abort();
  waterAssessment.textContent = '';
  if (!date) return;
  const controller = new AbortController();
  waterRequest = controller;
  waterAssessment.textContent = t('waterArchiveLoading');
  try {
    const response = await fetch('/api/gemma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ question: 'Field delivery', mode: 'field-delivery', language, date }),
    });
    if (!response.ok) throw new Error('Charvak archive unavailable');
    const { answer } = await response.json();
    if (!controller.signal.aborted) waterAssessment.textContent = answer;
  } catch {
    if (!controller.signal.aborted) waterAssessment.textContent = t('waterArchiveUnavailable');
  }
});

let dailySnapshot;
function renderDailySnapshot() {
  const image = dailySnapshot?.image;
  const weather = dailySnapshot?.weather[0];
  const photo = byId('daily-photo');
  photo.hidden = !image;
  if (image) photo.src = '/daily-images/' + image.date + '.jpg';
  byId('daily-status').textContent = image
    ? t('dailyImageStatus', displayDate(image.date), image.sensor) : t('dailyWaiting');
  byId('daily-weather').textContent = weather
    ? t('dailyWeatherStatus', displayDate(weather.date), number(weather.temperature), number(weather.precipitation))
    : t('dailyWeatherWaiting');
}

async function loadDailySnapshot() {
  try {
    const response = await fetch('/api/daily', { cache: 'no-store' });
    if (response.ok) dailySnapshot = await response.json();
  } catch {
    // Keep the last displayed snapshot while the server is unreachable.
  }
  renderDailySnapshot();
}
byId('language-choice').addEventListener('change', renderDailySnapshot);
loadDailySnapshot();
setInterval(loadDailySnapshot, 5 * 60 * 1000);
