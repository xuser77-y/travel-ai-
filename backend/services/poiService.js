const axios = require('axios');

const getActivities = async (lat, lon, interests) => {
  try {
    // 1. Define broader search categories to ensure we have real coordinates for everything
    const categories = [
      '["amenity"~"restaurant|cafe|fast_food"]', // Food
      '["tourism"~"attraction|museum|viewpoint|hotel"]', // Landmarks & Tourism
      '["historic"~"monument|memorial|castle"]', // History
      '["leisure"~"park|garden|beach_resort"]' // Nature/Leisure
    ];

    // Build a union query to get a diverse set of real locations
    const unionQuery = categories.map(cat => `nwr(around:10000,${lat},${lon})${cat};`).join('');
    const query = `[out:json][timeout:25];(${unionQuery});out center 50;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Travio/1.1 (contact@travio.com)' }
    });
    
    const pois = response.data.elements.map(el => ({
      name: el.tags.name || 'Interesting Place',
      category: el.tags.amenity || el.tags.tourism || el.tags.historic || el.tags.leisure || 'point_of_interest',
      lat: el.lat || (el.center ? el.center.lat : null),
      lon: el.lon || (el.center ? el.center.lon : null),
      address: el.tags['addr:street'] ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}` : null,
      description: el.tags.description || el.tags.note || `Verified ${el.tags.amenity || 'location'} in ${el.tags['addr:city'] || 'the area'}.`
    })).filter(el => el.lat && el.lon && el.name !== 'Interesting Place');

    // Remove duplicates by name
    return Array.from(new Map(pois.map(item => [item.name, item])).values()).slice(0, 40);
    
  } catch (error) {
    console.error('Error fetching deep POIs:', error.message);
    return [];
  }
};

module.exports = { getActivities };
