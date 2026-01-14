export const loggingMiddleware = (req, res, next) => {
    // Store the original send method
    const originalSend = res.send;
    // Override send method to capture responses
    res.send = function (body) {
        res.locals.responseData = body;
        return originalSend.call(this, body);
    };
    // Continue to next middleware
    next();
};
//# sourceMappingURL=logging.js.map