import { app, cache, config, distPath, landingPath, adminAuthEnabled } from './app.js';
import chatLogger from './services/logger.js';

const PORT = process.env.PORT || 3000;

const logStartupInfo = () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`Cache: ${config.cacheEnabled ? 'Enabled' : 'Disabled'}`);
  console.log(
    `Rate Limiting: ${config.rateLimitEnabled ? `Enabled (${config.rateLimitMax} req/min)` : 'Disabled'}`,
  );
  console.log(`Static assets: ${distPath || 'Not found'}`);
  console.log(`Landing page: ${landingPath || 'Not found'}`);
  console.log('\nAvailable endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /api/config');
  console.log('  GET  /api/travel-instructions');
  console.log('  POST /api/gemini/generateContent');
  console.log('  POST /api/v2/chat');
  console.log('  POST /api/v2/followup');
  console.log('  POST /api/clear-cache');
  console.log('  GET  /api/deployment-info');
};

let server = null;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logStartupInfo();
    console.log('Admin auth enabled:', adminAuthEnabled);
  });
}

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }

  if (cache) {
    await cache.disconnect();
    console.log('Cache connections closed');
  }

  setTimeout(() => {
    console.log('Forcing shutdown after timeout');
    process.exit(0);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (chatLogger && config.loggingEnabled) {
    chatLogger.log({
      type: 'unhandledRejection',
      reason: reason?.toString(),
      stack: reason?.stack,
      timestamp: new Date().toISOString(),
    });
  }
});

export { server, gracefulShutdown };
export default app;
