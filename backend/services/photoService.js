const axios = require('axios');
require('dotenv').config();

const getDestinationPhoto = async (query) => {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      console.warn('PEXELS_API_KEY is missing');
      return 'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg'; // High-end fallback
    }

    // Try primary search (the destination name)
    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: { 
        query: `${query} city landscape`, 
        per_page: 1,
        orientation: 'landscape'
      },
      headers: { Authorization: apiKey }
    });

    if (response.data.photos.length > 0) {
      return response.data.photos[0].src.large2x;
    }

    // Fallback: search for a generic luxury travel image if destination has no hits
    const fallbackRes = await axios.get('https://api.pexels.com/v1/search', {
      params: { query: 'luxury travel city', per_page: 1 },
      headers: { Authorization: apiKey }
    });

    return fallbackRes.data.photos[0]?.src?.large2x || 'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg';

  } catch (error) {
    console.error('Pexels API Error:', error.message);
    return 'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg';
  }
};

module.exports = { getDestinationPhoto };
