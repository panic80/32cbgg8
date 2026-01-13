import { ZodError } from 'zod';
export const validateRequest = (schema) => (req, res, next) => {
    try {
        const parsed = schema.parse(req.body ?? {});
        req.body = parsed;
        return next();
    }
    catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Validation failed',
                details: error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            });
        }
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid request payload.',
        });
    }
};
//# sourceMappingURL=validate.js.map