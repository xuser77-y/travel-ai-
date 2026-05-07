const express = require('express');
const router = express.Router();
const { getForecast } = require('../services/weatherService');
const { getDestinationPhoto } = require('../services/photoService');

// World Cup endpoints are PUBLIC. Restriction is enforced on the
// frontend via <FreemiumGate>: once a free user is locked, the entire
// page renders blurred behind an upgrade modal — no API call leaks
// premium content because the modal blocks pointer-events. We
// intentionally don't gate the GET because:
//   1. Browsing alone shouldn't consume one of the 3 free uses.
//   2. SEO + landing-page links to /worldcup should still 200.
// Mutating actions (none today, but future "join fan zone" etc.)
// MUST add `requireAuth + requireFeature(...)` individually.

const CITIES = [
  { 
    name: 'Casablanca', 
    lat: 33.5731, 
    lon: -7.5898, 
    stadium: 'Grand Stade de Casablanca', 
    capacity: '115,000',
    architect: 'Populous + Oualalou + Choi',
    status: 'New Build (In Progress)',
    features: ['World\'s Largest Football Stadium', 'Moroccan Tent Inspired Design', 'Retractable Roof'],
    photoUrl: '/assets/stadiums/stade_casablanca_2030_1777279994901.png'
  },
  { 
    name: 'Tangier', 
    lat: 35.7595, 
    lon: -5.8340, 
    stadium: 'Ibn Batouta Stadium', 
    capacity: '65,000',
    architect: 'L’Atelier d’Architecture Y.M.',
    status: 'Expansion & Renovation',
    features: ['Panoramic Coastal Views', 'Olympic Grade Track', 'High-Tech Digital Skin'],
    photoUrl: '/assets/stadiums/stade_tangier_2030_1777280029831.png'
  },
  { 
    name: 'Rabat', 
    lat: 34.0209, 
    lon: -6.8416, 
    stadium: 'Prince Moulay Abdellah Stadium', 
    capacity: '52,000',
    architect: 'AIA Life Designers',
    status: 'Major Renovation',
    features: ['Solar Panel Energy Hub', 'Integrated Fan Zone', 'Modern VIP Suites'],
    photoUrl: '/assets/stadiums/stade_rabat_2030_1777280069519.png'
  },
  { 
    name: 'Agadir', 
    lat: 30.4278, 
    lon: -9.5981, 
    stadium: 'Adrar Stadium', 
    capacity: '45,000',
    architect: 'Vittorio Gregotti',
    status: 'Renovation',
    features: ['Earthquake-Resistant Structure', 'Atlas Mountains Backdrop', 'Sustainable Water Recycling'],
    photoUrl: 'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg'
  },
  { 
    name: 'Marrakech', 
    lat: 31.6295, 
    lon: -7.9811, 
    stadium: 'Marrakech Stadium', 
    capacity: '45,000',
    architect: 'Sua Kay Architects',
    status: 'Renovation',
    features: ['Iconic Red Wall Design', 'Ventilated Cooling System', 'Cultural Museum On-site'],
    photoUrl: 'https://images.pexels.com/photos/1841819/pexels-photo-1841819.jpeg'
  },
  { 
    name: 'Fez', 
    lat: 34.0331, 
    lon: -5.0003, 
    stadium: 'Fez Stadium', 
    capacity: '45,000',
    architect: 'IDOM',
    status: 'Modernization',
    features: ['Traditional Tile Accents', 'Digital Fan Engagement Hub', 'Expanded Media Wing'],
    photoUrl: 'https://images.pexels.com/photos/2387418/pexels-photo-2387418.jpeg'
  }
];

router.get('/cities', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await Promise.all(CITIES.map(async (city) => {
      const weather = await getForecast(city.lat, city.lon, today, today);
      const cityPhoto = await getDestinationPhoto(city.name);
      return {
        ...city,
        temp: weather ? weather.temperature_2m_max[0] : null,
        weatherCode: weather ? weather.weathercode[0] : null,
        cityPhoto // Real city photo from Pexels
      };
    }));
    res.json(data);
  } catch (error) {
    console.error('WorldCup Route Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch World Cup data' });
  }
});

module.exports = router;
