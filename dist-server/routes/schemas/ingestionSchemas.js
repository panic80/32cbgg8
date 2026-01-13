import { z } from 'zod';
import { optionalTrimmedString } from './helpers.js';
export const ingestionRequestSchema = z
    .object({
    url: optionalTrimmedString('URL'),
    content: optionalTrimmedString('Content'),
    type: optionalTrimmedString('Type').default('web'),
    metadata: z.record(z.any()).optional(),
    forceRefresh: z.boolean().optional(),
})
    .refine((data) => data.url || data.content, {
    message: 'Either URL or content must be provided.',
    path: ['url'],
});
//# sourceMappingURL=ingestionSchemas.js.map