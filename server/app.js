/**
 * Express application entry point.
 * Composes middleware, routes, and services.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';

// Services and configuration
import { loggingMiddleware } from './middleware/logging.js';
import chatLogger, { getLogger } from './services/logger.js';
import CacheService from './services/cache.js';
import { loadEnvironment } from './config/environment.js';
import { createGatewayConfig } from './config/index.js';
import { DEFAULT_RAG_STREAM_TIMEOUT_MS, getEnvNumber } from './config/constants.js';
import { TRAVEL_PLANNER_ADDITIONAL_INSTRUCTIONS } from './constants/travelPlannerInstructions.js';

// Extracted modules
import { createHelmetConfig, createCorsConfig, createSecurityHeadersMiddleware, buildSseCorsHeaders } from './config/security.js';
import { validateIngestionUrl } from './utils/urlValidation.js';
import { createAdminAuthMiddleware, requiresConfigAuth, getRagAuthHeaders } from './middleware/adminAuth.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { initializeAiClients, buildOpenAIParams } from './services/aiClients.js';
import createSystemRoutes from './routes/system.js';
import { createNotFoundHandler, createGlobalErrorHandler } from './middleware/errorHandlers.js';
import {
  findDistPath,
  findLandingPath,
  createFaviconHandler,
  createProtectedStaticMiddleware,
  createMimeTypeMiddleware,
  setupLandingRoutes,
  createSpaCatchAllHandler,
} from './middleware/staticFiles.js';

// Route factories
import createSourcesRoutes from './routes/sources.js';
import createModelConfigRoutes from './routes/model-config.js';
import createLogsRoutes from './routes/logs.js';
import createPerformanceHandler from './routes/performance.js';
import createAdminRoutes from './routes/admin.js';
import createIngestionRoutes from './routes/ingestion.js';
import createChatRoutes from './routes/chat.js';
import createSupportRoutes from './routes/support.js';
import createMapsRoutes from './routes/maps.js';
import createAnalyticsRoutes from './routes/analytics.js';

// Utilities
import { decodeUrlParams } from './utils/http.js';
import { processContent } from './utils/html.js';
import { setSseHeaders } from './utils/sse.js';
import { pipeStreamingResponse } from './services/streaming.js';

// Load environment variables
const { nodeEnv: NODE_ENV } = loadEnvironment();
process.env.NODE_ENV = NODE_ENV;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const logger = getLogger('server:app');

// Gateway configuration
const config = createGatewayConfig();

logger.info('Server configuration:', {
  nodeEnv: NODE_ENV,
  port: PORT,
  cacheEnabled: config.cacheEnabled,
  rateLimitEnabled: config.rateLimitEnabled,
  loggingEnabled: config.loggingEnabled,
  logLevel: config.logLevel,
});

// Initialize cache service
const cache = config.cacheEnabled
  ? new CacheService({
      redisUrl:
        process.env.REDIS_URL ||
        'redis://default:' + process.env.REDIS_PASSWORD + '@localhost:6379',
      redisEnabled: config.cacheEnabled,
      defaultTTL: config.cacheTTL,
      memoryCleanupInterval: config.cacheCleanupInterval,
      enableLogging: config.loggingEnabled,
    })
  : null;

// Initialize AI clients
const aiClients = initializeAiClients();
const { geminiClient, openaiClient, anthropicClient, openrouterClient, googleMapsClient } = aiClients;

// Initialize admin auth middleware
const { requireAdminAuth, adminAuthEnabled } = createAdminAuthMiddleware();

// Initialize rate limiter
const { rateLimiter, apiRequestCounts } = createRateLimiter({
  config,
  cache,
  chatLogger,
});

// Find static asset paths
const distPath = findDistPath(__dirname);
const landingPath = findLandingPath(__dirname);

// =============================================================================
// MIDDLEWARE STACK
// =============================================================================

// Security: Helmet with CSP
app.use(helmet(createHelmetConfig()));

// Security: CORS
app.use(cors(createCorsConfig()));

// Security: Additional headers (Permissions-Policy, etc.)
app.use(createSecurityHeadersMiddleware());

// Favicon handler (before static files)
if (distPath) {
  app.get('/favicon.ico', createFaviconHandler(distPath));
}

// Protected static file serving (after security, before body parsing)
if (distPath) {
  logger.info('Serving static files from:', distPath);
  app.use(
    createProtectedStaticMiddleware({
      distPath,
      requiresConfigAuth,
      requireAdminAuth,
    })
  );
}

// Optional request logging
if (process.env.ENABLE_REQUEST_LOGS === 'true') {
  app.use((req, res, next) => {
    logger.info(`[Request Logger] ${req.method} ${req.originalUrl || req.url}`);
    next();
  });
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 10000 }));

// Logging middleware (after body parsing)
if (config.loggingEnabled) {
  app.use(loggingMiddleware);
}

// =============================================================================
// ROUTES
// =============================================================================

// Admin routes
app.use('/api/admin', requireAdminAuth);
app.use('/api/admin', createAdminRoutes({
  rateLimiter,
  performanceHandler: createPerformanceHandler(),
  chatLogger,
}));

// Logs routes
app.use(createLogsRoutes({ rateLimiter, requireAdminAuth }));

// Ingestion routes
app.use(createIngestionRoutes({
  rateLimiter,
  requireAdminAuth,
  validateIngestionUrl,
  getRagAuthHeaders,
  buildSseCorsHeaders,
  setSseHeaders,
  config,
}));

// Chat routes
app.use(createChatRoutes({
  rateLimiter,
  config,
  chatLogger,
  getRagAuthHeaders,
  decodeUrlParams,
  geminiClient,
  openaiClient,
  anthropicClient,
  buildOpenAIParams,
  buildSseCorsHeaders,
  setSseHeaders,
  pipeStreamingResponse,
  getEnvNumber,
  DEFAULT_RAG_STREAM_TIMEOUT_MS,
  TRAVEL_PLANNER_ADDITIONAL_INSTRUCTIONS,
}));

// Support routes
app.use(createSupportRoutes({
  rateLimiter,
  cache,
  config,
  processContent,
  geminiClient,
  openaiClient,
  anthropicClient,
}));

// Maps routes
app.use(createMapsRoutes({ rateLimiter, googleMapsClient, config }));

// Analytics routes
app.use(createAnalyticsRoutes({ rateLimiter, chatLogger }));

// Sources routes
app.use(createSourcesRoutes({ rateLimiter, requireAdminAuth, getRagAuthHeaders }));

// Model config routes
app.use(createModelConfigRoutes({ rateLimiter, requireAdminAuth }));

// System routes (health, config, deployment-info, clear-cache)
app.use(createSystemRoutes({
  config,
  cache,
  requireAdminAuth,
  chatLogger,
  aiClients,
  apiRequestCounts,
}));

// =============================================================================
// STATIC FILES & SPA FALLBACK
// =============================================================================

// MIME type middleware for icons
if (distPath) {
  app.use(createMimeTypeMiddleware());
  app.use(express.static(distPath));
}

// Landing page routes
setupLandingRoutes({ app, landingPath });

// SPA catch-all for React routes
app.get('*', createSpaCatchAllHandler({ distPath }));

// =============================================================================
// ERROR HANDLERS
// =============================================================================

// 404 handler
app.use(createNotFoundHandler({ distPath }));

// Global error handler
app.use(createGlobalErrorHandler({
  chatLogger,
  loggingEnabled: config.loggingEnabled,
}));

// =============================================================================
// EXPORTS
// =============================================================================

export { app, cache, config, distPath, landingPath, adminAuthEnabled };
