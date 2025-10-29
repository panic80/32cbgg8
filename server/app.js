import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { statSync, existsSync } from 'fs';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@googlemaps/google-maps-services-js';
import { loggingMiddleware } from './middleware/logging.js';
import chatLogger, { getLogger } from './services/logger.js';
import CacheService from './services/cache.js';
import createSourcesRoutes from './routes/sources.js';
import createLogsRoutes from './routes/logs.js';
import createPerformanceHandler from './routes/performance.js';
import createAdminRoutes from './routes/admin.js';
import createIngestionRoutes from './routes/ingestion.js';
import createChatRoutes from './routes/chat.js';
import createSupportRoutes from './routes/support.js';
import createMapsRoutes from './routes/maps.js';
import createAnalyticsRoutes from './routes/analytics.js';
import { decodeUrlParams } from './utils/http.js';
import { processContent } from './utils/html.js';
import { setSseHeaders } from './utils/sse.js';
import { DEFAULT_RAG_STREAM_TIMEOUT_MS, getEnvNumber } from './config/constants.js';
import { TRAVEL_PLANNER_ADDITIONAL_INSTRUCTIONS } from './constants/travelPlannerInstructions.js';
import { pipeStreamingResponse } from './services/streaming.js';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dns from 'node:dns/promises';
import net from 'node:net';
import { loadEnvironment } from './config/environment.js';
import { createGatewayConfig } from './config/index.js';

// Load environment variables
const { nodeEnv: NODE_ENV } = loadEnvironment();
process.env.NODE_ENV = NODE_ENV;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const logger = getLogger('server:app');

const emitLog = (level, message, args) => {
  if (!logger || typeof logger[level] !== 'function') {
    return;
  }
  const meta =
    !args || args.length === 0
      ? undefined
      : args.length === 1 && typeof args[0] === 'object'
        ? args[0]
        : { data: args };
  logger[level](message, meta);
};

const log = {
  info: (message, ...args) => emitLog('info', message, args),
  warn: (message, ...args) => emitLog('warn', message, args),
  error: (message, ...args) => emitLog('error', message, args),
};

// Security middleware
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Configure Helmet with enhanced security headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // Disable COEP to allow Google Maps API
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline styles in React components
          'https://fonts.googleapis.com',
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline scripts in index.html
          "'unsafe-eval'", // Required for some React development tools
          'https://fonts.googleapis.com',
          'https://maps.googleapis.com', // Google Maps API
          'https://maps.gstatic.com', // Google Maps static content
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://r2cdn.perplexity.ai'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          'https://api.openai.com',
          'https://api.anthropic.com',
          'https://generativelanguage.googleapis.com', // Gemini API
          'https://maps.googleapis.com', // Google Maps API
          'https://maps.gstatic.com', // Google Maps static content
          'wss:', // For WebSocket connections if needed
          isDevelopment ? 'http://localhost:*' : '',
        ].filter(Boolean),
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        childSrc: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null,
        blockAllMixedContent: isProduction ? [] : null,
      },
    },
    hsts: isProduction
      ? {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        }
      : false,
    frameguard: {
      action: 'deny', // Prevent clickjacking
    },
    noSniff: true, // X-Content-Type-Options: nosniff
    xssFilter: true, // X-XSS-Protection: 1; mode=block (legacy but still useful)
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    permittedCrossDomainPolicies: false,
    dnsPrefetchControl: {
      allow: false,
    },
    ieNoOpen: true,
    originAgentCluster: true,
  }),
);

// Configure CORS with environment-specific settings
const allowedOrigins = isDevelopment
  ? [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      process.env.FRONTEND_URL,
    ].filter(Boolean)
  : ['https://32cbgg8.com', 'https://www.32cbgg8.com', process.env.FRONTEND_URL].filter(Boolean);

const allowedOriginsSet = new Set(allowedOrigins);

const buildSseCorsHeaders = (originHeader) => {
  if (!originHeader) {
    return {};
  }

  if (allowedOriginsSet.has(originHeader)) {
    return {
      'Access-Control-Allow-Origin': originHeader,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    };
  }

  return {};
};

const isPrivateIpv4 = (ip) => {
  if (typeof ip !== 'string') return false;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((segment) => Number.isNaN(segment))) {
    return false;
  }
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 0) return true;
  return false;
};

const isPrivateIpv6 = (ip) => {
  if (typeof ip !== 'string') return false;
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // Unique local
  if (normalized.startsWith('fe80') || normalized.startsWith('fec0')) return true; // Link-local/site-local
  if (normalized === '::') return true;
  return false;
};

const resolveHostAddresses = async (hostname) => {
  try {
    const results = await dns.lookup(hostname, { all: true });
    return results.map(({ address, family }) => ({ address, family }));
  } catch (error) {
    throw new Error('Unable to resolve ingestion host');
  }
};

const isAddressDisallowed = ({ address, family }) => {
  if (family === 4) {
    return isPrivateIpv4(address);
  }
  if (family === 6) {
    return isPrivateIpv6(address);
  }
  return true;
};

const validateIngestionUrl = async (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw Object.assign(new Error('Ingestion URL is required'), { statusCode: 400 });
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw Object.assign(new Error('Invalid ingestion URL format'), { statusCode: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw Object.assign(new Error('Only HTTP and HTTPS ingestion URLs are allowed'), {
      statusCode: 400,
    });
  }

  const hostname = parsed.hostname.toLowerCase();
  const disallowedHostnames = new Set(['localhost', '127.0.0.1', '::1']);
  if (disallowedHostnames.has(hostname)) {
    throw Object.assign(new Error('Ingestion URL may not target local addresses'), {
      statusCode: 400,
    });
  }

  const ipType = net.isIP(hostname);
  let addresses;
  if (ipType) {
    const family = ipType === 6 ? 6 : 4;
    addresses = [{ address: hostname, family }];
  } else {
    addresses = await resolveHostAddresses(hostname);
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw Object.assign(new Error('Unable to resolve ingestion URL host'), { statusCode: 400 });
  }

  if (addresses.some(isAddressDisallowed)) {
    throw Object.assign(new Error('Ingestion URL resolves to a private or disallowed address'), {
      statusCode: 400,
    });
  }

  return parsed.toString();
};

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        log.warn(`CORS: Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-RateLimit-Burst',
    ],
    maxAge: 86400, // Cache preflight requests for 24 hours
  }),
);

// Serve static files EARLY in the middleware chain
// This ensures favicon.ico and other static files are served before any route handlers
let distPath = existsSync(path.join(__dirname, '..', 'dist'))
  ? path.join(__dirname, '..', 'dist')
  : null;

const adminAuthEnabled =
  typeof process.env.CONFIG_PANEL_PASSWORD === 'string' &&
  process.env.CONFIG_PANEL_PASSWORD.length > 0;
if (!adminAuthEnabled) {
  throw new Error('CONFIG_PANEL_PASSWORD must be set before starting the server.');
}

const adminApiToken = process.env.ADMIN_API_TOKEN;
if (!adminApiToken || adminApiToken.trim().length === 0) {
  throw new Error('ADMIN_API_TOKEN must be set before starting the server.');
}

const adminAuthUser = process.env.CONFIG_PANEL_USER || 'admin';
const getRagAuthHeaders = () => ({ Authorization: `Bearer ${adminApiToken}` });

const requiresConfigAuth = (pathname = '') => {
  return (
    pathname === '/config' ||
    pathname.startsWith('/config/') ||
    pathname === '/chat/config' ||
    pathname.startsWith('/chat/config/') ||
    pathname === '/landing-test' ||
    pathname.startsWith('/landing-test/')
  );
};

const requireAdminAuth = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const [scheme, encoded] = authHeader.split(' ');

  if (scheme === 'Basic' && encoded) {
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex !== -1) {
        const providedUser = decoded.slice(0, separatorIndex);
        const providedPassword = decoded.slice(separatorIndex + 1);

        if (
          providedUser === adminAuthUser &&
          providedPassword === process.env.CONFIG_PANEL_PASSWORD
        ) {
          return next();
        }
      }
    } catch (error) {
      log.error('Failed to decode admin auth credentials', error);
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Config", charset="UTF-8"');
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Administrator credentials required to access this resource.',
  });
};

// Explicit favicon.ico route
app.get('/favicon.ico', (req, res) => {
  log.info('Favicon route hit!');
  const faviconPath = path.join(__dirname, '..', 'dist', 'favicon.ico');
  log.info('Looking for favicon at:', faviconPath);
  if (existsSync(faviconPath)) {
    log.info('Favicon found, sending file');
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(faviconPath);
  } else {
    log.info('Favicon not found');
    res.status(404).send('Favicon not found');
  }
});

// Guard config routes before serving static assets
app.use((req, res, next) => {
  if (requiresConfigAuth(req.path)) {
    return requireAdminAuth(req, res, next);
  }
  return next();
});

if (distPath) {
  log.info('Serving static files early from:', distPath);
  app.use((req, res, next) => {
    if (requiresConfigAuth(req.path) && adminAuthEnabled) {
      return requireAdminAuth(req, res, () => {
        express.static(distPath, {
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('.ico')) {
              res.setHeader('Content-Type', 'image/x-icon');
              res.setHeader('Cache-Control', 'public, max-age=604800');
            } else if (filePath.endsWith('.svg')) {
              res.setHeader('Content-Type', 'image/svg+xml');
              res.setHeader('Cache-Control', 'public, max-age=604800');
            } else if (filePath.endsWith('.png')) {
              res.setHeader('Content-Type', 'image/png');
              res.setHeader('Cache-Control', 'public, max-age=604800');
            }
          },
        })(req, res, next);
      });
    }

    return express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.ico')) {
          res.setHeader('Content-Type', 'image/x-icon');
          res.setHeader('Cache-Control', 'public, max-age=604800');
        } else if (filePath.endsWith('.svg')) {
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('Cache-Control', 'public, max-age=604800');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=604800');
        }
      },
    })(req, res, next);
  });
}

// Additional security headers not covered by Helmet
app.use((req, res, next) => {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  );

  // Additional CORS headers for better security
  if (isProduction) {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  }

  next();
});

// Optional lightweight request logging for debugging
const enableRequestLogging = process.env.ENABLE_REQUEST_LOGS === 'true';
if (enableRequestLogging) {
  app.use((req, res, next) => {
    log.info(`[Request Logger] ${req.method} ${req.originalUrl || req.url}`);
    next();
  });
}

// Parse JSON request bodies with increased limit
app.use(express.json({ limit: '10mb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
    parameterLimit: 10000,
  }),
);

// Environment-based configuration
const config = createGatewayConfig();

log.info('Server configuration:', {
  nodeEnv: NODE_ENV,
  port: PORT,
  cacheEnabled: config.cacheEnabled,
  rateLimitEnabled: config.rateLimitEnabled,
  loggingEnabled: config.loggingEnabled,
  logLevel: config.logLevel,
});

// Initialize unified cache service with Redis and in-memory fallback
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

// Rate limiting setup (conditionally enabled)
const rateLimitBuckets = config.rateLimitEnabled ? new Map() : null;
const apiRequestCounts = config.rateLimitEnabled ? new Map() : null;
let rateLimitSweepCursor = 0;

// Initialize AI clients
let geminiClient = null;
let openaiClient = null;
let anthropicClient = null;

// Helper function to check if API key is valid (not a placeholder)
const isValidApiKey = (key) => {
  return key && !key.includes('your-') && !key.includes('-key-here') && key.length > 10;
};

const resolveGeminiApiKey = () => {
  const primary = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (isValidApiKey(primary)) {
    return primary;
  }

  if (isValidApiKey(process.env.VITE_GEMINI_API_KEY)) {
    log.warn(
      'VITE_GEMINI_API_KEY is deprecated. Migrate to GEMINI_API_KEY to keep credentials server-side.',
    );
    return process.env.VITE_GEMINI_API_KEY;
  }

  return null;
};

const geminiApiKey = resolveGeminiApiKey();

if (geminiApiKey) {
  geminiClient = new GoogleGenerativeAI(geminiApiKey);
  log.info('Gemini API client initialized');
} else {
  log.info('Gemini API key not configured or invalid');
}

if (isValidApiKey(process.env.OPENAI_API_KEY)) {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  log.info('OpenAI API client initialized');
} else {
  log.info('OpenAI API key not configured or invalid');
}

if (isValidApiKey(process.env.ANTHROPIC_API_KEY)) {
  anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  log.info('Anthropic API client initialized');
} else {
  log.info('Anthropic API key not configured or invalid');
}

// Initialize Google Maps client
let googleMapsClient = null;
if (isValidApiKey(process.env.GOOGLE_MAPS_API_KEY)) {
  googleMapsClient = new Client({});
  log.info('Google Maps API client initialized');
} else {
  log.info('Google Maps API key not configured or invalid');
}

// Helper function to check if a model is an O-series reasoning model
const isOSeriesModel = (model) => {
  return (
    model &&
    (model.startsWith('o3') || model.startsWith('o4') || model === 'o1' || model === 'o1-mini')
  );
};

// Helper function to build OpenAI parameters based on model type
const buildOpenAIParams = (model, messages) => {
  const baseParams = {
    model: model,
    messages: messages,
  };

  const isOSeries = isOSeriesModel(model);
  log.info(`Building OpenAI params for model: ${model}, isOSeries: ${isOSeries}`);

  if (isOSeries) {
    // O-series models only support max_completion_tokens
    return {
      ...baseParams,
      max_completion_tokens: 8192,
    };
  } else {
    // Standard models support traditional parameters
    return {
      ...baseParams,
      temperature: 0.7,
    };
  }
};

// Apply logging middleware conditionally (after static assets)
if (config.loggingEnabled) {
  app.use(loggingMiddleware);
}

// Custom rate limiting middleware with optional Redis-backed shared counter
const rateLimiter = async (req, res, next) => {
  if (!config.rateLimitEnabled) {
    return next();
  }

  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = config.rateLimitWindow;
  const retryAfterSeconds = Math.ceil(windowMs / 1000);
  const limit = (config.rateLimitMax || 0) + (config.rateLimitBurst || 0);

  // Shared key per window
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowResetSec = Math.ceil((windowStart + windowMs) / 1000);

  let count = 0;
  let usedRedis = false;

  try {
    // Prefer Redis-backed counter when cache (Redis) is connected
    if (cache && cache.redisConnected && cache.redisClient) {
      const key = `rl:${clientIP}:${windowStart}`;
      // INCR and set expiry when first seen
      count = await cache.redisClient.incr(key);
      if (count === 1) {
        await cache.redisClient.pexpire(key, windowMs);
      }
      usedRedis = true;
    }
  } catch (e) {
    // Fall back to memory on Redis error
    usedRedis = false;
  }

  if (!usedRedis) {
    // In-memory fallback (per-process)
    const bucket = rateLimitBuckets.get(clientIP);
    if (!bucket || bucket.expiresAt <= now) {
      rateLimitBuckets.set(clientIP, { count: 1, expiresAt: now + windowMs });
      count = 1;
    } else {
      bucket.count += 1;
      count = bucket.count;
    }
  }

  // Track for health/debug
  if (apiRequestCounts) {
    const prev = apiRequestCounts.get(clientIP) || 0;
    apiRequestCounts.set(clientIP, Math.max(prev, count));
  }

  // Headers
  res.setHeader('X-RateLimit-Limit', String(config.rateLimitMax));
  res.setHeader('X-RateLimit-Burst', String(config.rateLimitBurst || 0));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
  res.setHeader('X-RateLimit-Reset', String(windowResetSec));

  if (count > limit) {
    if (config.loggingEnabled) {
      chatLogger.log({
        message: 'Rate limit exceeded',
        clientIP,
        path: req.path,
        requestCount: count,
        windowMs,
      });
    }
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: retryAfterSeconds });
  }

  return next();
};

const performanceHandler = createPerformanceHandler();

app.use('/api/admin', requireAdminAuth);

const adminRouter = createAdminRoutes({
  rateLimiter,
  performanceHandler,
  chatLogger,
});

app.use('/api/admin', adminRouter);

const logsRouter = createLogsRoutes({
  rateLimiter,
  requireAdminAuth,
});

app.use(logsRouter);

const ingestionRouter = createIngestionRoutes({
  rateLimiter,
  requireAdminAuth,
  validateIngestionUrl,
  getRagAuthHeaders,
  buildSseCorsHeaders,
  setSseHeaders,
  config,
});

app.use(ingestionRouter);

const chatRouter = createChatRoutes({
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
});

app.use(chatRouter);

const supportRouter = createSupportRoutes({
  rateLimiter,
  cache,
  config,
  processContent,
  geminiClient,
  openaiClient,
  anthropicClient,
});

app.use(supportRouter);

const mapsRouter = createMapsRoutes({ rateLimiter, googleMapsClient, config });
app.use(mapsRouter);

const analyticsRouter = createAnalyticsRoutes({ rateLimiter, chatLogger });
app.use(analyticsRouter);

// Advanced health check endpoint with detailed system stats
app.get('/health', async (req, res) => {
  // Get cache stats
  const cacheStats = cache ? cache.getStats() : null;
  const cacheHealth = cache ? cache.getHealth() : { status: 'disabled' };

  // Try to get travel instructions cache info
  const travelInstructionsCache = cache ? await cache.get('travel-instructions') : null;
  const cacheAge =
    travelInstructionsCache && travelInstructionsCache.timestamp
      ? Math.floor((Date.now() - travelInstructionsCache.timestamp) / 1000) + 's'
      : 'not cached';

  // Basic memory usage information
  const memoryUsage = process.memoryUsage();
  const formatMemory = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;

  // Format uptime
  const uptime = process.uptime();
  let uptimeStr;
  if (uptime < 60) {
    uptimeStr = `${Math.floor(uptime)}s`;
  } else if (uptime < 3600) {
    uptimeStr = `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`;
  } else {
    uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
  }

  // Rate limiting stats
  const activeClients = apiRequestCounts ? apiRequestCounts.size : 0;
  const clientsAtLimit = apiRequestCounts
    ? Array.from(apiRequestCounts.entries()).filter(([_, count]) => count >= config.rateLimitMax)
        .length
    : 0;

  // Check RAG service health
  let ragHealth = { status: 'unknown' };
  if (process.env.RAG_SERVICE_URL || req.query.checkRag === 'true') {
    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
      const ragResponse = await axios.get(`${ragServiceUrl}/api/v1/health`, { timeout: 5000 });
      ragHealth = ragResponse.data;
    } catch (error) {
      ragHealth = { status: 'unhealthy', error: error.message };
    }
  }

  // For detailed health checks, add API connectivity test
  const healthData = {
    status: 'healthy',
    version: '1.0.0',
    uptime: uptimeStr,
    memory: {
      rss: formatMemory(memoryUsage.rss),
      heapTotal: formatMemory(memoryUsage.heapTotal),
      heapUsed: formatMemory(memoryUsage.heapUsed),
    },
    cache: config.cacheEnabled
      ? {
          enabled: true,
          status: cacheHealth.status,
          redis: cacheHealth.redis,
          memory: cacheHealth.memory,
          performance: cacheHealth.performance,
          stats: cacheStats
            ? {
                totalHits: cacheStats.combined.totalHits,
                totalMisses: cacheStats.combined.totalMisses,
                hitRate: cacheStats.combined.hitRate,
              }
            : null,
          travelInstructions: {
            cached: !!travelInstructionsCache,
            age: cacheAge,
            size:
              travelInstructionsCache && travelInstructionsCache.content
                ? `${Math.round(travelInstructionsCache.content.length / 1024)} KB`
                : '0',
          },
        }
      : { enabled: false },
    rateLimiting: {
      enabled: config.rateLimitEnabled,
      activeClients,
      clientsAtLimit,
      limit: config.rateLimitMax,
      window: `${config.rateLimitWindow / 1000}s`,
    },
    environment: process.env.NODE_ENV || 'production',
    ragService: ragHealth,
    timestamp: new Date().toISOString(),
  };

  const publicHealthData = { ...healthData };
  delete publicHealthData.memory;
  delete publicHealthData.rateLimiting;

  if (req.query.admin === 'true') {
    return requireAdminAuth(req, res, () => {
      res.json(healthData);
    });
  }

  res.json(publicHealthData);
});

// API configuration endpoint with environment-specific settings
app.get('/api/config', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Safe configuration that doesn't expose sensitive info
  const responseConfig = {
    version: '1.0.0',
    buildTime: process.env.BUILD_TIMESTAMP || new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    features: {
      aiChat: true,
      travelInstructions: true,
      rateLimit: config.rateLimitMax,
    },
    models: {
      default: 'gpt-4.1',
      providers: {
        google: !!geminiClient,
        openai: !!openaiClient,
        anthropic: !!anthropicClient,
      },
    },
    caching: {
      enabled: config.cacheEnabled,
      duration: Math.floor(config.cacheTTL / 1000 / 60) + ' minutes',
    },
    // Public-facing URLs and endpoints
    api: {
      base: '/api',
      travelInstructions: '/api/travel-instructions',
      gemini: '/api/gemini/generateContent',
      chat: '/api/v2/chat',
      chatRag: '/api/v2/chat/rag',
      followup: '/api/v2/followup',
      ingest: '/api/v2/ingest',
      ingestCanada: '/api/v2/ingest/canada-ca',
      sources: '/api/v2/sources',
      sourcesStats: '/api/v2/sources/stats',
      health: '/health',
    },
    // RAG service info
    rag: {
      enabled: !!process.env.RAG_SERVICE_URL,
      serviceUrl: process.env.RAG_SERVICE_URL || 'http://localhost:8000',
    },
    // Client-side configuration
    client: {
      retryEnabled: true,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
    },
    timestamp: new Date().toISOString(),
  };

  // Return the safe config
  res.json(responseConfig);
});

// Deployment verification endpoint (for debugging cache issues)
app.get('/api/deployment-info', requireAdminAuth, (req, res) => {
  const buildInfo = {
    timestamp: new Date().toISOString(),
    buildTime: process.env.BUILD_TIMESTAMP,
    nodeEnv: process.env.NODE_ENV,
    processUptime: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
    // Try to read package.json version
    version: '1.0.0',
  };

  // Try to get build info from dist directory
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (existsSync(packagePath)) {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      buildInfo.version = pkg.version;
    }
  } catch (err) {
    log.info('Could not read package.json:', err.message);
  }

  // Add cache-busting headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.json(buildInfo);
});

// Cache-busting endpoint for forcing client refresh
app.post('/api/clear-cache', (req, res) => {
  // This endpoint helps with cache busting by providing a new timestamp
  const cacheBreaker = Date.now();

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.json({
    message: 'Cache busting initiated',
    timestamp: new Date().toISOString(),
    cacheBreaker,
    buildTime: process.env.BUILD_TIMESTAMP,
    instructions: {
      manual: 'Press Ctrl+F5 (or Cmd+Shift+R on Mac) to force reload',
      programmatic: `Add ?v=${cacheBreaker} to URLs to bypass cache`,
    },
  });
});

// Core middleware to handle serving the app
// Commenting out non-existent public_html directory
// app.use(express.static('public_html'));

// Use absolute paths relative to server directory
const possiblePaths = [
  path.join(__dirname, '..', 'public_html'),
  path.join(__dirname, '..', 'dist'),
  path.join(process.cwd(), 'public_html'),
  path.join(process.cwd(), 'dist'),
];

// Find the first existing directory
// distPath already declared above, reuse it
distPath = null;
for (const testPath of possiblePaths) {
  if (existsSync(testPath)) {
    try {
      const stats = statSync(testPath);
      if (stats.isDirectory()) {
        distPath = testPath;
        log.info(`Found static assets at: ${distPath}`);
        break;
      }
    } catch (err) {
      log.error(`Error checking path ${testPath}:`, err.message);
    }
  }
}
// Serve static files from dist directory
if (distPath) {
  log.info('Serving static files from:', distPath);

  // Add explicit favicon handling with correct MIME types
  app.use((req, res, next) => {
    if (req.path === '/favicon.ico') {
      res.setHeader('Content-Type', 'image/x-icon');
      res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 7 days
    } else if (req.path === '/favicon.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (req.path.endsWith('.png') && req.path.includes('icon')) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
    next();
  });

  app.use(express.static(distPath));
}

// Improved static file serving for landing page
const possiblePublicPaths = [
  path.join(__dirname, '..', 'public_html', 'landing'),
  path.join(__dirname, '..', 'dist', 'landing'),
  path.join(process.cwd(), 'public_html', 'landing'),
  path.join(process.cwd(), 'dist', 'landing'),
  // Additional fallback paths
  path.join(__dirname, 'public_html', 'landing'),
  path.join(__dirname, 'dist', 'landing'),
];

let landingPath = null;
for (const testPath of possiblePublicPaths) {
  if (existsSync(testPath)) {
    try {
      const stats = statSync(testPath);
      if (stats.isDirectory()) {
        landingPath = testPath;
        log.info(`Found landing page at: ${landingPath}`);
        break;
      }
    } catch (err) {
      log.error(`Error checking landing path ${testPath}:`, err.message);
    }
  }
}

if (landingPath) {
  // Serve landing page files with proper MIME types
  app.use(
    '/landing',
    express.static(landingPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Content-Type', 'text/html');
        }
      },
    }),
  );

  // Explicit route for landing page
  app.get('/landing', (req, res) => {
    const indexPath = path.join(landingPath, 'index.html');
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Landing page not found');
    }
  });
} else {
  log.error('Could not find public_html directory at any of these paths:', possiblePublicPaths);
}

// Handle React app routes (catch-all for client-side routing)
// This must come after specific routes but before the 404 handler
app.get('*', (req, res, next) => {
  // Skip API routes and landing routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/landing')) {
    return next();
  }

  // Serve React app for all other routes
  if (distPath) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    return next(); // Let 404 handler take over
  }
});

// Enhanced 404 error handler with helpful suggestions
app.use((req, res) => {
  const requestedUrl = req.url;
  let suggestions = [];

  // Check if URL might be close to a valid endpoint and suggest alternatives
  if (requestedUrl.includes('gemini') || requestedUrl.includes('chat')) {
    suggestions.push('/api/gemini/generateContent', '/api/v2/chat');
  }

  if (requestedUrl.includes('travel') || requestedUrl.includes('instructions')) {
    suggestions.push('/api/travel-instructions');
  }

  if (requestedUrl.includes('health') || requestedUrl.includes('status')) {
    suggestions.push('/health');
  }

  if (requestedUrl.includes('config') || requestedUrl.includes('settings')) {
    suggestions.push('/api/config');
  }

  // If it looks like an API request, provide JSON response
  if (requestedUrl.startsWith('/api/')) {
    const response = {
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.url}`,
      timestamp: new Date().toISOString(),
    };

    // Add suggestions if available
    if (suggestions.length > 0) {
      response.suggestions = suggestions;
      response.message += `. Available endpoints that might help: ${suggestions.join(', ')}`;
    } else {
      // Generic suggestion
      response.message += '. Try /api/config for available endpoints.';
    }

    return res.status(404).json(response);
  }

  // Check if this is a request for a static file
  const staticFileExtensions = [
    '.ico',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.css',
    '.js',
    '.json',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
  ];
  const hasStaticExtension = staticFileExtensions.some((ext) =>
    req.path.toLowerCase().endsWith(ext),
  );

  if (hasStaticExtension) {
    // For static files, return proper 404
    return res.status(404).send('File not found');
  }

  // For non-API, non-static requests, serve the React app if available (which will handle its own 404)
  if (distPath) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    // Plain text 404 for non-API requests when no React app is available
    res.status(404).send('404 - Page not found');
  }
});

// Global error handler with detailed logging
app.use((err, req, res, next) => {
  const errorId = Date.now().toString(36);
  const errorDetails = {
    id: errorId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body ? JSON.stringify(req.body).substring(0, 1000) : undefined,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
    },
    error: {
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
      code: err.code,
      statusCode: err.statusCode || err.status,
    },
    timestamp: new Date().toISOString(),
  };

  // Log the error with structured data
  log.error('Global error handler:', JSON.stringify(errorDetails, null, 2));
  if (chatLogger && config.loggingEnabled) {
    // Fallback to available logger method
    chatLogger.log(errorDetails);
  }

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Send appropriate response based on content type
  if (req.path.startsWith('/api/')) {
    res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal Server Error' : err.message,
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred. Please try again later.'
          : err.message,
      errorId,
      timestamp: new Date().toISOString(),
    });
  } else {
    // For non-API routes, send a simple error page
    res.status(statusCode).send(`
      <html>
        <head><title>Error ${statusCode}</title></head>
        <body>
          <h1>Error ${statusCode}</h1>
          <p>${statusCode === 500 ? 'Internal Server Error' : err.message}</p>
          <p>Error ID: ${errorId}</p>
          <p><a href="/">Go to Homepage</a></p>
        </body>
      </html>
    `);
  }
});

export { app, cache, config, distPath, landingPath, adminAuthEnabled };
