const axios = require('axios');

/**
 * Open-Meteo daily forecast.
 * Returns the raw `daily` block: { time[], weathercode[], temperature_2m_max[], temperature_2m_min[], precipitation_sum[] }
 */
const getForecast = async (lat, lon, startDate, endDate) => {
  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lon,
        daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max',
        timezone: 'auto',
        start_date: startDate.split('T')[0],
        end_date: endDate.split('T')[0]
      }
    });
    return response.data.daily;
  } catch (error) {
    console.error('Error fetching weather:', error.message);
    return null;
  }
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

