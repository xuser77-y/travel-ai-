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
    photoUrl: '/assets/stadiums/casablanca_stadium.png',
    description: 'Set to become the largest football stadium in the world, the Grand Stade de Casablanca is inspired by the traditional Moroccan tent. It will serve as the crown jewel of the 2030 World Cup, hosting the tournament\'s final match.'
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
    photoUrl: '/assets/stadiums/tangier_stadium.jpg',
    description: 'Located at the gateway between Africa and Europe, this coastal stadium offers breathtaking views of the Atlantic. The renovation includes a modern digital skin and expanded capacity for major international matches.'
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
    photoUrl: '/assets/stadiums/rabat_stadium.jpg',
    description: 'A masterpiece of sustainable architecture, the Prince Moulay Abdellah Stadium in Rabat features a massive solar panel array that powers the entire complex. It is the heart of Morocco\'s sporting infrastructure.'
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
    photoUrl: '/assets/stadiums/adrar_stadium.jpg',
    description: 'Nestled between the Atlas Mountains and the Atlantic, Adrar Stadium is famous for its earthquake-resistant design. The renovation focuses on sustainability and fan experience with a stunning natural backdrop.'
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
    photoUrl: '/assets/stadiums/marrakech_stadium.jfif',
    description: 'Echoing the architecture of the "Red City," Marrakech Stadium features a unique rectangular design with ventilated walls to ensure natural cooling. It includes an on-site museum celebrating Moroccan football heritage.'
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
    photoUrl: '/assets/stadiums/fez_stadium.avif',
    description: 'The Fez Stadium modernization project blends the city\'s centuries-old traditional craftsmanship with cutting-edge technology. It features intricate Zellij tile patterns and high-speed fan connectivity.'
  }
];

router.get('/cities', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await Promise.all(CITIES.map(async (city) => {
      const weather = await getForecast(city.lat, city.lon, today, today);
      return {
        ...city,
        temp: weather ? weather.temperature_2m_max[0] : null,
        weatherCode: weather ? weather.weathercode[0] : null
      };
    }));
    res.json(data);
  } catch (error) {
    console.error('WorldCup Route Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch World Cup data' });
  }
});

module.exports = router;
