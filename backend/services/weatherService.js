const axios = require('axios');

const getForecast = async (lat, lon, startDate, endDate) => {
  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lon,
        daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum',
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

module.exports = { getForecast };
