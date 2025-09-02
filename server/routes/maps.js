import express from 'express';
import axios from 'axios';

const router = express.Router();

// Google Places Autocomplete proxy
router.get('/api/maps/autocomplete', async (req, res) => {
  try {
    const { input, sessiontoken, components } = req.query;
    
    if (!input) {
      return res.status(400).json({ error: 'Input parameter is required' });
    }

    const params = new URLSearchParams({
      input: input.toString(),
      key: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY,
      sessiontoken: sessiontoken?.toString() || '',
      components: components?.toString() || 'country:ca',
      types: 'geocode|establishment',
      language: 'en'
    });

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Autocomplete error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch autocomplete suggestions',
      details: error.response?.data || error.message
    });
  }
});

// Google Places Details proxy
router.get('/api/maps/place-details', async (req, res) => {
  try {
    const { place_id, sessiontoken } = req.query;
    
    if (!place_id) {
      return res.status(400).json({ error: 'place_id parameter is required' });
    }

    const params = new URLSearchParams({
      place_id: place_id.toString(),
      key: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY,
      sessiontoken: sessiontoken?.toString() || '',
      fields: 'formatted_address,name,geometry,address_components,place_id'
    });

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Place details error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch place details',
      details: error.response?.data || error.message
    });
  }
});

export default router;