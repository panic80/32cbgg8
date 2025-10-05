import { Router } from 'express';

const createMapsRoutes = ({ rateLimiter, googleMapsClient }) => {
  const router = Router();

  router.post('/api/maps/distance', rateLimiter, async (req, res) => {
    try {
      const { origin, destination, mode = 'driving' } = req.body;

      if (!origin || !destination) {
        return res.status(400).json({
          error: 'Both origin and destination are required',
        });
      }

      if (!googleMapsClient) {
        return res.status(503).json({
          error: 'Google Maps service is not configured',
        });
      }

      console.log(`[Maps API] Calculating distance from ${origin} to ${destination} via ${mode}`);

      const response = await googleMapsClient.distancematrix({
        params: {
          origins: [origin],
          destinations: [destination],
          mode,
          units: 'metric',
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
        timeout: 5000,
      });

      const data = response.data;

      if (!data?.rows?.[0]?.elements?.[0]) {
        console.warn('[Maps API] Unexpected response structure:', data);
        return res.status(502).json({
          error: 'Distance matrix response missing data',
        });
      }

      const element = data.rows[0].elements[0];

      if (element.status !== 'OK') {
        console.warn('[Maps API] Element status not OK:', element.status);
        return res.status(422).json({
          error: element.status,
          message: element.error_message || 'Failed to calculate distance',
        });
      }

      const result = {
        distance: element.distance,
        duration: element.duration,
        origin: data.origin_addresses?.[0] ?? origin,
        destination: data.destination_addresses?.[0] ?? destination,
        mode,
      };

      if (mode === 'driving') {
        const { distance, duration } = data.rows
          .flatMap((row) => row.elements)
          .reduce(
            (acc, curr) => {
              if (curr.status === 'OK') {
                if (curr.distance?.value) acc.totalDistance += curr.distance.value;
                if (curr.duration?.value) acc.totalDuration += curr.duration.value;
              }
              return acc;
            },
            { totalDistance: 0, totalDuration: 0 },
          );

        result.totalDistance = distance;
        result.totalDuration = duration;
      }

      return res.json(result);
    } catch (error) {
      if (error.response) {
        console.error('[Maps API] Error response:', error.response.status, error.response.data);
      } else {
        console.error('[Maps API] Error:', error.message);
      }

      if (error.response?.status === 403) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Ensure the Google Maps API key has Distance Matrix API enabled.',
        });
      }

      return res.status(500).json({
        error: 'Failed to calculate distance',
        message: error.message,
      });
    }
  });

  return router;
};

export default createMapsRoutes;
