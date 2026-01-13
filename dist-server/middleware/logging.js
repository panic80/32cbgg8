export const loggingMiddleware = (req, res, next) => {
    // Store the original send method
    const originalSend = res.send;
    // Override send method to capture responses
    res.send = function (data) {
        res.locals.responseData = data;
        return originalSend.apply(res, arguments);
    };
    // Continue to next middleware
    next();
};
//# sourceMappingURL=logging.js.map