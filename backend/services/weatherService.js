const axios = require('axios');
const http = require('http');
const https = require('https');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Force IPv4 to avoid the same AAAA-lookup `ENOTFOUND` issue we saw on
// Pexels. Open-Meteo serves over IPv6 too but on some ISPs the IPv6 path
// is unreliable and Node sticks with the broken record.
const ipv4HttpsAgent = new https.Agent({ family: 4, keepAlive: true });
const ipv4HttpAgent = new http.Agent({ family: 4, keepAlive: true });

// Open-Meteo's free `/v1/forecast` endpoint supports up to ~16 days
// ahead of "today". Requesting beyond that returns HTTP 400
// (`ERR_BAD_REQUEST`), which we surfaced as a noisy "Weather fetch
// failed" warning. Clamp here instead.
const FORECAST_HORIZON_DAYS = 16;

const toYmd = (d) => new Date(d).toISOString().split('T')[0];

const clampForecastWindow = (startStr, endStr) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + FORECAST_HORIZON_DAYS);

  const start = new Date(startStr);
  const end = new Date(endStr);

  // If the trip starts after the horizon, no forecast is available at all.
  if (start > horizon) return null;

  // Don't ask for a past start date — Open-Meteo would 400 on that too.
  const clampedStart = start < today ? today : start;
  const clampedEnd = end > horizon ? horizon : end;

  if (clampedEnd < clampedStart) return null;
  return { start: toYmd(clampedStart), end: toYmd(clampedEnd) };
};

// Errors that are worth retrying once — usually a flaky connection or DNS
// hiccup, not a real upstream outage. ECONNRESET in particular fires when
// the server closes the keep-alive socket while we were waiting on it.
const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ECONNABORTED',
  'EPIPE'
]);

const isTransient = (err) => {
  const code = err?.code || err?.cause?.code;
  if (TRANSIENT_CODES.has(code)) return true;
  // Axios surfaces its own "timeout exceeded" as message, not code.
  if (err?.message && /timeout/i.test(err.message)) return true;
  // 5xx from upstream is retryable too.
  const status = err?.response?.status;
  return status >= 500 && status < 600;
};

/**
 * Open-Meteo daily forecast.
 * Returns the raw `daily` block: { time[], weathercode[], temperature_2m_max[], temperature_2m_min[], precipitation_sum[] }
 *
 * Resilient against transient network errors (ECONNRESET, ETIMEDOUT, 5xx)
 * with a single backoff retry. On terminal failure, returns null and logs
 * a single concise warning so the trip flow degrades gracefully (the
 * itinerary just goes out without per-day weather verdicts).
 */
const getForecast = async (lat, lon, startDate, endDate) => {
  // Clamp to the API's 16-day horizon. If the trip is fully beyond it,
  // skip the network call entirely and return null (caller handles that).
  const window = clampForecastWindow(startDate, endDate);
  if (!window) {
    console.warn(
      `Weather skipped: trip dates (${toYmd(startDate)} → ${toYmd(endDate)}) are beyond the ${FORECAST_HORIZON_DAYS}-day forecast horizon.`
    );
    return null;
  }

  const params = {
    latitude: lat,
    longitude: lon,
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max',
    timezone: 'auto',
    start_date: window.start,
    end_date: window.end
  };

  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params,
        httpAgent: ipv4HttpAgent,
        httpsAgent: ipv4HttpsAgent,
        timeout: 8000 // open-meteo is fast; 8s is generous
      });
      return response.data.daily;
    } catch (error) {
      lastErr = error;
      if (attempt === 0 && isTransient(error)) {
        await sleep(500);
        continue;
      }
      break;
    }
  }

  // Quiet, single-line warning instead of a noisy stack — the caller
  // already handles `null` by skipping the weather summary.
  console.warn(`Weather fetch failed (${lastErr?.code || lastErr?.message || 'unknown'}); itinerary will be generated without forecast.`);
  return null;
};

// WMO weather code -> { label, icon, isPrecip, isSevere }
// Reference: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
const CODE_MAP = {
  0:  { label: 'Clear sky',          icon: '☀️' },
  1:  { label: 'Mainly clear',       icon: '🌤️' },
  2:  { label: 'Partly cloudy',      icon: '⛅' },
  3:  { label: 'Overcast',           icon: '☁️' },
  45: { label: 'Fog',                icon: '🌫️' },
  48: { label: 'Rime fog',           icon: '🌫️' },
  51: { label: 'Light drizzle',      icon: '🌦️', isPrecip: true },
  53: { label: 'Drizzle',            icon: '🌦️', isPrecip: true },
  55: { label: 'Dense drizzle',      icon: '🌧️', isPrecip: true },
  61: { label: 'Light rain',         icon: '🌦️', isPrecip: true },
  63: { label: 'Rain',               icon: '🌧️', isPrecip: true },
  65: { label: 'Heavy rain',         icon: '🌧️', isPrecip: true, isSevere: true },
  71: { label: 'Light snow',         icon: '🌨️', isPrecip: true },
  73: { label: 'Snow',               icon: '❄️',  isPrecip: true },
  75: { label: 'Heavy snow',         icon: '❄️',  isPrecip: true, isSevere: true },
  77: { label: 'Snow grains',        icon: '🌨️', isPrecip: true },
  80: { label: 'Rain showers',       icon: '🌦️', isPrecip: true },
  81: { label: 'Heavy showers',      icon: '🌧️', isPrecip: true, isSevere: true },
  82: { label: 'Violent showers',    icon: '⛈️',  isPrecip: true, isSevere: true },
  85: { label: 'Snow showers',       icon: '🌨️', isPrecip: true },
  86: { label: 'Heavy snow showers', icon: '❄️',  isPrecip: true, isSevere: true },
  95: { label: 'Thunderstorm',       icon: '⛈️',  isPrecip: true, isSevere: true },
  96: { label: 'Thunder + hail',     icon: '⛈️',  isPrecip: true, isSevere: true },
  99: { label: 'Severe thunder',     icon: '⛈️',  isPrecip: true, isSevere: true }
};

/**
 * Rate a single day's weather and return a verdict the UI/AI can consume.
 * Returns: { date, code, label, icon, tmin, tmax, precipitation, wind, rating, score, isGood, advice }
 *  - rating: "excellent" | "good" | "fair" | "poor"
 *  - isGood: boolean (rating excellent or good)
 *  - advice: short string the AI can use to plan indoor/outdoor activities
 */
const rateDay = ({ date, code, tmin, tmax, precipitation, wind }) => {
  const meta = CODE_MAP[code] || { label: 'Unknown', icon: '🌡️' };
  const tavg = (Number(tmin) + Number(tmax)) / 2;

  // Score from 0..100. Penalize precip / severe weather / extreme temps / strong wind.
  let score = 100;
  if (meta.isSevere) score -= 55;
  else if (meta.isPrecip) score -= 25;
  if (precipitation >= 10) score -= 20;
  else if (precipitation >= 3) score -= 10;
  if (tavg < 0)  score -= 25;
  else if (tavg < 8)  score -= 12;
  else if (tavg > 35) score -= 25;
  else if (tavg > 30) score -= 10;
  if (wind >= 50) score -= 20;
  else if (wind >= 30) score -= 8;
  score = Math.max(0, Math.min(100, score));

  let rating;
  if (score >= 80) rating = 'excellent';
  else if (score >= 65) rating = 'good';
  else if (score >= 45) rating = 'fair';
  else rating = 'poor';

  let advice;
  if (meta.isSevere) advice = 'Severe weather expected — prefer fully indoor activities and reschedule outdoor plans.';
  else if (meta.isPrecip) advice = 'Rain/snow likely — favour museums, indoor experiences and covered restaurants.';
  else if (tavg > 32) advice = 'Hot day — plan early-morning or evening outdoor activities, stay hydrated.';
  else if (tavg < 5) advice = 'Cold day — pack warm layers, prefer indoor experiences during the coldest hours.';
  else advice = 'Great day for outdoor activities and walking tours.';

  return {
    date,
    code,
    label: meta.label,
    icon: meta.icon,
    tmin: Number(tmin),
    tmax: Number(tmax),
    precipitation: Number(precipitation) || 0,
    wind: Number(wind) || 0,
    score,
    rating,
    isGood: rating === 'excellent' || rating === 'good',
    advice
  };
};

/**
 * Build a per-day summary array from the raw open-meteo `daily` block.
 * The result is small enough to embed in prompts and store on the trip.
 */
const summarizeForecast = (daily) => {
  if (!daily || !Array.isArray(daily.time)) return [];
  return daily.time.map((date, i) => rateDay({
    date,
    code: daily.weathercode?.[i],
    tmin: daily.temperature_2m_min?.[i],
    tmax: daily.temperature_2m_max?.[i],
    precipitation: daily.precipitation_sum?.[i],
    wind: daily.windspeed_10m_max?.[i]
  }));
};

module.exports = { getForecast, rateDay, summarizeForecast, CODE_MAP };

