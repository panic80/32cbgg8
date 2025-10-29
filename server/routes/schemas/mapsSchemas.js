import { z } from 'zod';
import { optionalTrimmedString, trimmedString } from './helpers.js';

export const distanceRequestSchema = z.object({
  origin: trimmedString('Origin'),
  destination: trimmedString('Destination'),
  mode: optionalTrimmedString('Mode').refine(
    (value) => !value || ['driving', 'walking', 'bicycling', 'transit'].includes(value),
    'Mode must be one of driving, walking, bicycling, or transit.',
  ),
});
