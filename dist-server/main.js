import { app, cache, config, distPath, landingPath, adminAuthEnabled } from './app.js';
import chatLogger, { getLogger } from './services/logger.js';
const PORT = process.env.PORT || 3000;
const logger = getLogger('server:main');
const logStartupInfo = () => {
    logger.info('Server startup details', {
        port: Number(PORT),
        environment: process.env.NODE_ENV || 'production',
        cacheEnabled: Boolean(config.cacheEnabled),
        rateLimiting: {
            enabled: Boolean(config.rateLimitEnabled),
            max: config.rateLimitMax,
        },
        staticAssets: distPath || null,
        landingPage: landingPath || null,
        endpoints: [
            { method: 'GET', path: '/health' },
            { method: 'GET', path: '/api/config' },
            { method: 'GET', path: '/api/travel-instructions' },
            { method: 'POST', path: '/api/gemini/generateContent' },
            { method: 'POST', path: '/api/v2/chat' },
            { method: 'POST', path: '/api/v2/followup' },
            { method: 'POST', path: '/api/clear-cache' },
            { method: 'GET', path: '/api/deployment-info' },
        ],
    });
};
let server = null;
if (process.env.NODE_ENV !== 'test') {
    server = app.listen(PORT, () => {
        logStartupInfo();
        logger.info('Admin authentication status', { enabled: Boolean(adminAuthEnabled) });
    });
}
const gracefulShutdown = async (signal) => {
    logger.warn('Shutdown signal received', { signal });
    if (server) {
        server.close(() => {
            logger.info('HTTP server closed');
        });
    }
    if (cache) {
        await cache.disconnect();
        logger.info('Cache connections closed');
    }
    setTimeout(() => {
        logger.error('Forcing shutdown after timeout');
        process.exit(0);
    }, 10000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason, _promise) => {
    const err = reason;
    logger.error('Unhandled promise rejection', {
        reason: err instanceof Error ? err.message : String(reason),
    });
    if (chatLogger && config.loggingEnabled) {
        chatLogger.log({
            type: 'unhandledRejection',
            reason: String(reason),
            stack: err?.stack,
            timestamp: new Date().toISOString(),
        });
    }
});
export { server, gracefulShutdown };
export default app;
//# sourceMappingURL=main.js.map