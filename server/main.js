import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync, readFileSync } from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@googlemaps/google-maps-services-js';
import { loggingMiddleware } from './middleware/logging.js';
import chatLogger from './services/logger.js';
import CacheService from './services/cache.js';
import mapsRoutes from './routes/maps.js';
import createSourcesRoutes from './routes/sources.js';
import createLogsRoutes from './routes/logs.js';
import dotenv from 'dotenv';
import { decodeUrlParams } from './utils/http.js';
import { processContent } from './utils/html.js';
import { setSseHeaders } from './utils/sse.js';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { PassThrough } from 'stream';
import dns from 'node:dns/promises';
import net from 'node:net';

// Load secure secrets first (if file exists)
const secureEnvPath = '/etc/cbthis/env';
if (existsSync(secureEnvPath)) {
  try {
    const secureEnv = readFileSync(secureEnvPath, 'utf8');
    secureEnv.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.startsWith('#') || !line.trim()) return;
      
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
    console.log('Loaded secure environment variables from', secureEnvPath);
  } catch (error) {
    console.error('Failed to load secure environment variables:', error.message);
  }
} else {
  console.warn('Secure environment file not found at', secureEnvPath);
}

// Load environment variables based on NODE_ENV
const NODE_ENV = process.env.NODE_ENV || 'development';

// Load environment-specific .env file (for non-sensitive config)
dotenv.config({ path: `.env.${NODE_ENV}` });

// Fallback to .env if environment-specific file doesn't exist
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Configure Helmet with enhanced security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Disable COEP to allow Google Maps API
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline styles in React components
        "https://fonts.googleapis.com"
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline scripts in index.html
        "'unsafe-eval'", // Required for some React development tools
        "https://fonts.googleapis.com",
        "https://maps.googleapis.com", // Google Maps API
        "https://maps.gstatic.com" // Google Maps static content
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.openai.com",
        "https://api.anthropic.com",
        "https://generativelanguage.googleapis.com", // Gemini API
        "https://maps.googleapis.com", // Google Maps API
        "https://maps.gstatic.com", // Google Maps static content
        "wss:", // For WebSocket connections if needed
        isDevelopment ? "http://localhost:*" : ""
      ].filter(Boolean),
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      childSrc: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null,
      blockAllMixedContent: isProduction ? [] : null
    },
  },
  hsts: isProduction ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  frameguard: {
    action: 'deny' // Prevent clickjacking
  },
  noSniff: true, // X-Content-Type-Options: nosniff
  xssFilter: true, // X-XSS-Protection: 1; mode=block (legacy but still useful)
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  permittedCrossDomainPolicies: false,
  dnsPrefetchControl: {
    allow: false
  },
  ieNoOpen: true,
  originAgentCluster: true
}));

// Configure CORS with environment-specific settings
const allowedOrigins = isDevelopment ? [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean) : [
  'https://32cbgg8.com',
  'https://www.32cbgg8.com',
  process.env.FRONTEND_URL
].filter(Boolean);

const allowedOriginsSet = new Set(allowedOrigins);

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
    throw Object.assign(new Error('Only HTTP and HTTPS ingestion URLs are allowed'), { statusCode: 400 });
  }

  const hostname = parsed.hostname.toLowerCase();
  const disallowedHostnames = new Set(['localhost', '127.0.0.1', '::1']);
  if (disallowedHostnames.has(hostname)) {
    throw Object.assign(new Error('Ingestion URL may not target local addresses'), { statusCode: 400 });
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
    throw Object.assign(new Error('Ingestion URL resolves to a private or disallowed address'), { statusCode: 400 });
  }

  return parsed.toString();
};

const buildSseCorsHeaders = (originHeader) => {
  if (!originHeader) {
    return {};
  }

  if (allowedOriginsSet.has(originHeader)) {
    return {
      'Access-Control-Allow-Origin': originHeader,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin'
    };
  }

  return {};
};

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Serve static files EARLY in the middleware chain
// This ensures favicon.ico and other static files are served before any route handlers
let distPath = existsSync(path.join(__dirname, '..', 'dist')) ? path.join(__dirname, '..', 'dist') : null;

const adminAuthEnabled = typeof process.env.CONFIG_PANEL_PASSWORD === 'string' && process.env.CONFIG_PANEL_PASSWORD.length > 0;
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
  return pathname === '/config' || pathname.startsWith('/config/') ||
    pathname === '/chat/config' || pathname.startsWith('/chat/config/');
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

        if (providedUser === adminAuthUser && providedPassword === process.env.CONFIG_PANEL_PASSWORD) {
          return next();
        }
      }
    } catch (error) {
      console.error('Failed to decode admin auth credentials', error);
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Config", charset="UTF-8"');
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Administrator credentials required to access this resource.'
  });
};

// Explicit favicon.ico route
app.get('/favicon.ico', (req, res) => {
  console.log('Favicon route hit!');
  const faviconPath = path.join(__dirname, '..', 'dist', 'favicon.ico');
  console.log('Looking for favicon at:', faviconPath);
  if (existsSync(faviconPath)) {
    console.log('Favicon found, sending file');
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(faviconPath);
  } else {
    console.log('Favicon not found');
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
  console.log("Serving static files early from:", distPath);
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
          }
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
      }
    })(req, res, next);
  });
}

// Additional security headers not covered by Helmet
app.use((req, res, next) => {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy', 
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
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
    console.log(`[Request Logger] ${req.method} ${req.originalUrl || req.url}`);
    next();
  });
}

// Parse JSON request bodies with increased limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 10000
}));

// Environment-based configuration
const config = {
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 10000, // 10 seconds
  retryDelay: parseInt(process.env.RETRY_DELAY) || 1000, // 1 second in milliseconds
  
  // Cache configuration
  cacheEnabled: process.env.ENABLE_CACHE === 'true',
  cacheTTL: parseInt(process.env.CACHE_TTL) || 3600000, // 1 hour in milliseconds
  cacheCleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL) || 300000, // 5 minutes
  
  // Rate limiting configuration  
  rateLimitEnabled: process.env.ENABLE_RATE_LIMIT === 'true',
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 60, // 60 requests per minute
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute in milliseconds
  
  // Logging configuration
  loggingEnabled: process.env.ENABLE_LOGGING === 'true',
  logLevel: process.env.LOG_LEVEL || 'debug',
  logDir: process.env.LOG_DIR || './logs',
  
  // External services
  canadaCaUrl: process.env.CANADA_CA_URL || 'https://www.canada.ca/en/department-national-defence/services/benefits-military/pay-pension-benefits/benefits/canadian-forces-temporary-duty-travel-instructions.html'
};

app.use('/api/admin', requireAdminAuth);

console.log('Server configuration:', {
  nodeEnv: NODE_ENV,
  port: PORT,
  cacheEnabled: config.cacheEnabled,
  rateLimitEnabled: config.rateLimitEnabled,
  loggingEnabled: config.loggingEnabled,
  logLevel: config.logLevel
});
console.log('Admin auth enabled:', adminAuthEnabled);

// Initialize unified cache service with Redis and in-memory fallback
const cache = config.cacheEnabled ? new CacheService({
  redisUrl: process.env.REDIS_URL || "redis://default:" + process.env.REDIS_PASSWORD + "@localhost:6379",
  redisEnabled: config.cacheEnabled,
  defaultTTL: config.cacheTTL,
  memoryCleanupInterval: config.cacheCleanupInterval,
  enableLogging: config.loggingEnabled
}) : null;

// Rate limiting setup (conditionally enabled)
const rateLimitBuckets = config.rateLimitEnabled ? new Map() : null;
let rateLimitSweepCursor = 0;


// Initialize AI clients
let geminiClient = null;
let openaiClient = null;
let anthropicClient = null;

// Helper function to check if API key is valid (not a placeholder)
const isValidApiKey = (key) => {
  return key && 
         !key.includes('your-') && 
         !key.includes('-key-here') && 
         key.length > 10;
};

const resolveGeminiApiKey = () => {
  const primary = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (isValidApiKey(primary)) {
    return primary;
  }

  if (isValidApiKey(process.env.VITE_GEMINI_API_KEY)) {
    console.warn('VITE_GEMINI_API_KEY is deprecated. Migrate to GEMINI_API_KEY to keep credentials server-side.');
    return process.env.VITE_GEMINI_API_KEY;
  }

  return null;
};

const geminiApiKey = resolveGeminiApiKey();

if (geminiApiKey) {
  geminiClient = new GoogleGenerativeAI(geminiApiKey);
  console.log('Gemini API client initialized');
} else {
  console.log('Gemini API key not configured or invalid');
}

if (isValidApiKey(process.env.OPENAI_API_KEY)) {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('OpenAI API client initialized');
} else {
  console.log('OpenAI API key not configured or invalid');
}

if (isValidApiKey(process.env.ANTHROPIC_API_KEY)) {
  anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  console.log('Anthropic API client initialized');
} else {
  console.log('Anthropic API key not configured or invalid');
}

// Initialize Google Maps client
let googleMapsClient = null;
if (isValidApiKey(process.env.GOOGLE_MAPS_API_KEY)) {
  googleMapsClient = new Client({});
  console.log('Google Maps API client initialized');
} else {
  console.log('Google Maps API key not configured or invalid');
}

// Helper function to check if a model is an O-series reasoning model
const isOSeriesModel = (model) => {
  return model && (
    model.startsWith('o3') || 
    model.startsWith('o4') ||
    model === 'o1' ||
    model === 'o1-mini'
  );
};

// Helper function to build OpenAI parameters based on model type
const buildOpenAIParams = (model, messages) => {
  const baseParams = {
    model: model,
    messages: messages
  };
  
  const isOSeries = isOSeriesModel(model);
  console.log(`Building OpenAI params for model: ${model}, isOSeries: ${isOSeries}`);
  
  if (isOSeries) {
    // O-series models only support max_completion_tokens
    return {
      ...baseParams,
      max_completion_tokens: 8192
    };
  } else {
    // Standard models support traditional parameters
    return {
      ...baseParams,
      temperature: 0.7
    };
  }
};

// Apply logging middleware conditionally (after static assets)
if (config.loggingEnabled) {
  app.use(loggingMiddleware);
}

// Custom rate limiting middleware (simpler than express-rate-limit)
const rateLimiter = (req, res, next) => {
  if (!config.rateLimitEnabled) {
    return next();
  }

  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = config.rateLimitWindow;
  const retryAfterSeconds = Math.ceil(windowMs / 1000);

  const bucket = rateLimitBuckets.get(clientIP);

  if (!bucket || bucket.expiresAt <= now) {
    rateLimitBuckets.set(clientIP, {
      count: 1,
      expiresAt: now + windowMs
    });
    rateLimitSweepCursor++;
    if (rateLimitSweepCursor >= 500) {
      rateLimitSweepCursor = 0;
      for (const [ip, entry] of rateLimitBuckets.entries()) {
        if (entry.expiresAt <= now) {
          rateLimitBuckets.delete(ip);
        }
      }
    }
    return next();
  }

  if (bucket.count >= config.rateLimitMax) {
    if (config.loggingEnabled) {
      chatLogger.log({
        message: 'Rate limit exceeded',
        clientIP,
        path: req.path,
        requestCount: bucket.count,
        windowMs
      });
    }
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: retryAfterSeconds
    });
  }

  bucket.count += 1;
  next();
};

// Legacy chat middleware for backward compatibility
app.use('/api/chat', async (req, res, next) => {
  if (req.method === 'POST') {
    console.log('Legacy /api/chat endpoint called, redirecting to /api/gemini/generateContent');
    req.url = '/api/gemini/generateContent';
    // Decode URL encoded body params if present
    if (req.body) {
      req.body = decodeUrlParams(req.body);
    }
    
    // Handle both old and new parameter names
    if (req.body.query && !req.body.prompt) {
      req.body.prompt = req.body.query;
    }
    
    return app._router.handle(req, res, next);
  }
  next();
});

// Gemini chat endpoint (existing)
app.post('/api/gemini/generateContent', rateLimiter, async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Prompt is required and must be a non-empty string' 
      });
    }

    if (!geminiClient) {
      return res.status(500).json({ 
        error: 'Configuration Error', 
        message: 'Gemini API key is not configured.' 
      });
    }

    const model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    res.json({ response: text });
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
});

// RAG-enhanced chat endpoint
app.post('/api/v2/chat/rag', rateLimiter, async (req, res, next) => {
  const { message, model, provider, chatHistory, conversationId, useRAG = true } = req.body;

  // Validate input
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'Message must be a non-empty string.' 
    });
  }

  try {
    console.log('Processing RAG chat request', {
      message: message?.substring(0, 50),
      model,
      provider,
      hasHistory: !!chatHistory,
      conversationId
    });
    
    // Forward to RAG service
    const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
    const ragResponse = await axios.post(`${ragServiceUrl}/api/v1/chat`, {
      message: message.trim(),
      chat_history: chatHistory || [],
      conversation_id: conversationId,
      provider: provider || 'openai',
      model: model,
      use_rag: useRAG,
      include_sources: true
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...getRagAuthHeaders()
      }
    });

    // Return RAG response
    res.json(ragResponse.data);

  } catch (error) {
    console.error('RAG chat error:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack
    });
    
    if (error.response) {
      // Forward error from RAG service
      return res.status(error.response.status).json(error.response.data);
    }
    
    // Fallback to regular chat if RAG service is unavailable
    console.log('RAG service unavailable, falling back to regular chat');
    
    // Call the regular chat endpoint
    const { message, model, provider } = req.body;
    try {
      let response = '';
      
      switch (provider) {
        case 'google':
          if (!geminiClient) {
            return res.status(500).json({ 
              error: 'Configuration Error', 
              message: 'Google API key is not configured.' 
            });
          }
          
          const geminiModel = geminiClient.getGenerativeModel({ model: model });
          const geminiResult = await geminiModel.generateContent(message.trim());
          const geminiResponse = await geminiResult.response;
          response = geminiResponse.text();
          break;
          
        case 'openai':
          if (!openaiClient) {
            return res.status(500).json({ 
              error: 'Configuration Error', 
              message: 'OpenAI API key is not configured.' 
            });
          }
          
          const openaiParams = buildOpenAIParams(
            model,
            [{ role: 'user', content: message.trim() }]
          );
          
          const openaiCompletion = await openaiClient.chat.completions.create(openaiParams);
          
          response = openaiCompletion.choices[0].message.content;
          break;
          
        case 'anthropic':
          if (!anthropicClient) {
            return res.status(500).json({ 
              error: 'Configuration Error', 
              message: 'Anthropic API key is not configured.' 
            });
          }
          
          const anthropicMessage = await anthropicClient.messages.create({
            model: model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: message.trim() }],
          });
          
          response = anthropicMessage.content[0].text;
          break;
          
        default:
          return res.status(400).json({ 
            error: 'Bad Request', 
            message: `Unsupported provider: ${provider}` 
          });
      }
      
      // Send response
      res.json({
        response: response,
        sources: [], // No sources without RAG
        conversation_id: null,
        model: model
      });
    } catch (fallbackError) {
      console.error('Fallback chat error:', fallbackError);
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Both RAG and fallback chat services failed.' 
      });
    }
  }
});

// New unified chat endpoint that supports multiple providers
app.post('/api/v2/chat', rateLimiter, async (req, res) => {
  const { message, model, provider } = req.body;

  // Validate input message
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'Message must be a non-empty string.' 
    });
  }

  // Validate required parameters
  if (!model) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'Model parameter is required.' 
    });
  }
  
  if (!provider) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'Provider parameter is required.' 
    });
  }

  try {
    console.log('Processing chat request with model:', model, 'provider:', provider);
    
    let response = '';
    
    // Process based on provider
    switch (provider) {
      case 'google':
        if (!geminiClient) {
          return res.status(500).json({ 
            error: 'Configuration Error', 
            message: 'Google API key is not configured.' 
          });
        }
        
        const geminiModel = geminiClient.getGenerativeModel({ model: model });
        const geminiResult = await geminiModel.generateContent(message.trim());
        const geminiResponse = await geminiResult.response;
        response = geminiResponse.text();
        break;
        
      case 'openai':
        if (!openaiClient) {
          return res.status(500).json({ 
            error: 'Configuration Error', 
            message: 'OpenAI API key is not configured.' 
          });
        }
        
        const openaiParams = buildOpenAIParams(
          model,
          [{ role: 'user', content: message.trim() }]
        );
        
        const openaiCompletion = await openaiClient.chat.completions.create(openaiParams);
        
        response = openaiCompletion.choices[0].message.content;
        break;
        
      case 'anthropic':
        if (!anthropicClient) {
          return res.status(500).json({ 
            error: 'Configuration Error', 
            message: 'Anthropic API key is not configured.' 
          });
        }
        
        const anthropicMessage = await anthropicClient.messages.create({
          model: model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: message.trim() }],
        });
        
        response = anthropicMessage.content[0].text;
        break;
        
      default:
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: `Unsupported provider: ${provider}` 
        });
    }
    
    if (config.loggingEnabled) {
      const loggedAt = new Date().toISOString();
      chatLogger.logChat(req, {
        timestamp: loggedAt,
        question: message.trim(),
        answer: response,
        model,
        provider,
        ragEnabled: false,
        metadata: {
          route: '/api/v2/chat'
        }
      });
    }

    // Send response
    res.json({
      response: response,
      sources: [], // No sources without RAG
      conversation_id: null,
      model: model
    });

  } catch (error) {
    console.error('Error processing chat request:', error);
    
    if (config.loggingEnabled) {
      chatLogger.logChat(req, {
        timestamp: new Date().toISOString(),
        question: message.trim(),
        answer: null,
        model,
        provider,
        ragEnabled: false,
        metadata: {
          route: '/api/v2/chat',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }

    // Handle specific error cases
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests to the AI provider. Please try again later.'
      });
    }
    
    if (error.status === 401) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Invalid API key for the selected provider.'
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'An error occurred while processing your request.' 
    });
  }
});

// Document ingestion endpoints
// Proxy route for /api/rag/ingest to /api/v2/ingest
app.post('/api/rag/ingest', requireAdminAuth, rateLimiter, async (req, res) => {
  const { url, content, type = 'web', metadata, forceRefresh = false } = req.body;
  const ingestionUrl = typeof url === 'string' ? url : undefined;

  // Validate input
  if (!ingestionUrl && !content) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'Either URL or content must be provided.' 
    });
  }

  let sanitizedIngestionUrl;

  try {
    if (ingestionUrl) {
      sanitizedIngestionUrl = await validateIngestionUrl(ingestionUrl);
    }
  } catch (validationError) {
    console.error('Rejected ingestion URL:', validationError.message);
    return res.status(validationError.statusCode || 400).json({
      error: 'Bad Request',
      message: validationError.message
    });
  }

  try {
    // Forward to RAG service
    const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
    console.log('Forwarding ingestion request to RAG service:', {
      url: sanitizedIngestionUrl || 'N/A',
      type,
      hasContent: !!content,
      forceRefresh
    });

    const ragResponse = await axios.post(`${ragServiceUrl}/api/v1/ingest`, {
      url: sanitizedIngestionUrl,
      content,
      type,
      metadata: metadata || {},
      force_refresh: forceRefresh
    }, {
      timeout: 300000, // 5 minute timeout for complex documents
      headers: {
        'Content-Type': 'application/json',
        ...getRagAuthHeaders()
      }
    });

    res.json(ragResponse.data);

  } catch (error) {
    console.error('Document ingestion error:', error);
    
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to ingest document.' 
    });
  }
});

// SSE endpoint for ingestion progress - proxy to RAG service
const proxyIngestionProgress = async (req, res) => {
  const { url } = req.query;
  const targetUrl = Array.isArray(url) ? url[0] : url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  let sanitizedTargetUrl;

  try {
    sanitizedTargetUrl = await validateIngestionUrl(targetUrl);
  } catch (validationError) {
    console.error('Rejected ingestion progress URL:', validationError.message);
    return res.status(validationError.statusCode || 400).json({
      error: 'Bad Request',
      message: validationError.message
    });
  }

  try {
    const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

    const response = await axios.get(
      `${ragServiceUrl}/api/v1/ingest/progress`,
      {
        params: { url: sanitizedTargetUrl },
        responseType: 'stream',
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...getRagAuthHeaders(),
        },
      }
    );

    const corsHeaders = buildSseCorsHeaders(req.headers.origin);
    setSseHeaders(res, {
      ...corsHeaders,
      'X-Accel-Buffering': 'no',
    });

    response.data.pipe(res);

    req.on('close', () => {
      response.data.destroy();
    });
  } catch (error) {
    console.error('Progress streaming error:', error);
    res.status(500).json({ error: 'Failed to connect to progress stream' });
  }
};

app.get('/api/rag/ingest/progress', requireAdminAuth, proxyIngestionProgress);
app.get('/api/v2/ingest/progress', requireAdminAuth, proxyIngestionProgress);

app.post('/api/v2/ingest', requireAdminAuth, rateLimiter, async (req, res) => {
  const { url, content, type = 'web', metadata, forceRefresh = false } = req.body;
  const ingestionUrl = typeof url === 'string' ? url : undefined;

  // Validate input
  if (!ingestionUrl && !content) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'Either URL or content must be provided.' 
    });
  }

  let sanitizedIngestionUrl;

  try {
    if (ingestionUrl) {
      sanitizedIngestionUrl = await validateIngestionUrl(ingestionUrl);
    }
  } catch (validationError) {
    console.error('Rejected ingestion URL:', validationError.message);
    return res.status(validationError.statusCode || 400).json({
      error: 'Bad Request',
      message: validationError.message
    });
  }

  try {
    // Forward to RAG service
    const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
    console.log('Forwarding ingestion request to RAG service:', {
      url: sanitizedIngestionUrl || 'N/A',
      type,
      hasContent: !!content,
      forceRefresh
    });

    const ragResponse = await axios.post(`${ragServiceUrl}/api/v1/ingest`, {
      url: sanitizedIngestionUrl,
      content,
      type,
      metadata: metadata || {},
      force_refresh: forceRefresh
    }, {
      timeout: 300000, // 5 minute timeout for complex documents
      headers: {
        'Content-Type': 'application/json',
        ...getRagAuthHeaders()
      }
    });

    res.json(ragResponse.data);

  } catch (error) {
    console.error('Document ingestion error:', error);
    
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to ingest document.' 
    });
  }
});

// Ingest Canada.ca travel instructions
app.post('/api/v2/ingest/canada-ca', requireAdminAuth, rateLimiter, async (req, res) => {
  try {
    const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
    const ragResponse = await axios.post(`${ragServiceUrl}/api/v1/ingest/canada-ca`, {}, {
      timeout: 300000, // 5 minute timeout for full scraping
      headers: {
        'Content-Type': 'application/json',
        ...getRagAuthHeaders()
      }
    });

    res.json(ragResponse.data);

  } catch (error) {
    console.error('Canada.ca ingestion error:', error);
    
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to ingest Canada.ca content.' 
    });
  }
});

// Mount sources and logs routes
app.use(createSourcesRoutes({ rateLimiter, requireAdminAuth, getRagAuthHeaders }));
app.use(createLogsRoutes({ rateLimiter }));

// SSE Streaming chat endpoint - proxy to RAG service
app.post('/api/v2/chat/stream', rateLimiter, async (req, res) => {
  // HYBRID_SEARCH_TOGGLE_START - Extract hybrid search parameter
  const { message, model, provider, chatHistory, conversationId, useRAG = true, shortAnswerMode = false, useHybridSearch = false } = req.body;
  // HYBRID_SEARCH_TOGGLE_END

  // Validate input
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Message must be a non-empty string.'
    });
  }

  try {
    console.log('Processing streaming chat request', {
      message: message?.substring(0, 50),
      model,
      provider,
      hasHistory: !!chatHistory,
      conversationId
    });
    
    // Determine default jurisdiction (structured) if none specified
    const recentHistoryText = Array.isArray(chatHistory)
      ? chatHistory.slice(-5).map(h => (h && typeof h.content === 'string' ? h.content : '')).join(' \n ')
      : '';
    const combinedText = `${message}\n${recentHistoryText}`.toLowerCase();
    const locationRegex = /\b(ontario|canada|alberta|british columbia|manitoba|saskatchewan|qu[eé]bec|nova scotia|new brunswick|newfoundland|labrador|prince edward island|pei|yukon|nunavut|northwest territories|toronto|ottawa|vancouver|calgary|edmonton|montreal|winnipeg|regina|halifax|saint john|st\.?\s*john'?s|charlottetown)\b/;
    const hasExplicitLocation = locationRegex.test(combinedText);
    const jurisdiction = hasExplicitLocation ? undefined : { region: 'Ontario', country: 'Canada' };
    
    // Forward to RAG service streaming endpoint
    const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';
    const ragStreamTimeout = parseInt(process.env.RAG_STREAM_TIMEOUT || '120000', 10);
    const upstreamAbortController = new AbortController();

    const response = await axios.post(
      `${ragServiceUrl}/api/v1/streaming_chat`,
      {
        message: (message || '').trim(),
        chat_history: chatHistory || [],
        conversation_id: conversationId,
        provider: provider || 'openai',
        model: model,
        use_rag: useRAG,
        include_sources: true,
        short_answer_mode: shortAnswerMode,
        // HYBRID_SEARCH_TOGGLE_START - Pass hybrid search parameter
        use_hybrid_search: useHybridSearch,
        // Structured jurisdiction hint (applied only when none specified)
        ...(jurisdiction ? { jurisdiction } : {})
        // HYBRID_SEARCH_TOGGLE_END
      },
      {
        responseType: 'stream',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        timeout: ragStreamTimeout,
        signal: upstreamAbortController.signal
      }
    );

    // Prepare to proxy SSE while capturing analytics data
    const streamingCorsHeaders = buildSseCorsHeaders(req.headers.origin);
    setSseHeaders(res, {
      ...streamingCorsHeaders,
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });

    const passThrough = new PassThrough();
    passThrough.pipe(res);

    let buffer = '';
    let aggregatedAnswer = '';
    let remoteConversationId = conversationId || null;
    let remoteModel = model;
    let remoteProvider = provider || 'openai';
    let sourcesCount = 0;
    let followUpCount = 0;
    let sawErrorEvent = false;
    let logged = false;

    const finaliseLog = (override = {}) => {
      if (logged) return;
      logged = true;
      if (!config.loggingEnabled) {
        return;
      }

      const timestamp = new Date().toISOString();
      const mergedAnswer = (override.answer ?? aggregatedAnswer) || '';
      chatLogger.logChat(req, {
        timestamp,
        question: message.trim(),
        answer: mergedAnswer.trim() || null,
        conversationId: remoteConversationId,
        model: remoteModel,
        provider: remoteProvider,
        ragEnabled: useRAG,
        shortAnswerMode,
        metadata: {
          route: '/api/v2/chat/stream',
          useHybridSearch,
          sourcesCount,
          followUpCount,
          sawErrorEvent,
          ...(override.metadata || {})
        }
      });
    };

    const processLine = (line) => {
      if (!line.startsWith('data: ')) return;
      const data = line.slice(6).trim();
      if (data === '' || data === '[DONE]') return;

      try {
        const event = JSON.parse(data);
        switch (event.type) {
          case 'token':
            if (event.content) {
              aggregatedAnswer += event.content;
            }
            break;
          case 'metadata':
            if (event.conversation_id) {
              remoteConversationId = event.conversation_id;
            }
            if (event.model) {
              remoteModel = event.model;
            }
            if (event.provider) {
              remoteProvider = event.provider;
            }
            if (Array.isArray(event.follow_up_questions)) {
              followUpCount = event.follow_up_questions.length;
            }
            break;
          case 'sources':
            if (Array.isArray(event.sources)) {
              sourcesCount = event.sources.length;
            }
            break;
          case 'error':
            sawErrorEvent = true;
            finaliseLog();
            break;
          case 'complete':
            finaliseLog();
            break;
          default:
            break;
        }
      } catch (parseError) {
        console.error('Failed to parse upstream streaming event for analytics logging:', parseError);
      }
    };

    response.data.on('data', (chunk) => {
      passThrough.write(chunk);
      buffer += chunk.toString('utf8');

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const rawLine = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        processLine(rawLine.replace(/\r$/, ''));
      }
    });

    response.data.on('end', () => {
      buffer
        .split('\n')
        .filter(Boolean)
        .forEach(line => processLine(line.replace(/\r$/, '')));
      finaliseLog();
      passThrough.end();
    });

    response.data.on('error', (streamError) => {
      console.error('Streaming pipe error:', streamError);
      sawErrorEvent = true;
      finaliseLog();
      upstreamAbortController.abort();
      if (!res.writableEnded) {
        res.end();
      }
    });

    // Clean up on client disconnect
    req.on('close', () => {
      upstreamAbortController.abort();
      response.data.destroy();
      finaliseLog();
      passThrough.end();
    });

  } catch (error) {
    console.error('Streaming chat error:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status
    });

    if (config.loggingEnabled) {
      const errorSummary = error instanceof Error ? error.message : 'Streaming chat failed';
      aggregatedAnswer = aggregatedAnswer || '';
      finaliseLog({
        answer: aggregatedAnswer || `Error: ${errorSummary}`,
        metadata: { errorMessage: errorSummary }
      });

      chatLogger.log({
        type: 'streaming_chat_error',
        message: errorSummary,
        status: error.response?.status,
        provider,
        model,
        route: '/api/v2/chat/stream'
      });
    }
    
    // For streaming errors, we need to send SSE formatted error
    if (!res.headersSent) {
      const errorCorsHeaders = buildSseCorsHeaders(req.headers.origin);
      setSseHeaders(res, {
        ...errorCorsHeaders,
        'X-Accel-Buffering': 'no'
      });
    }
    
    const errorEvent = {
      type: 'error',
      error_type: error.response?.status === 401 ? 'auth_error' : 'unknown_error',
      message: error.message || 'Streaming chat failed'
    };

    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
  }
});

// Follow-up questions endpoint (simplified without RAG context)
app.post('/api/v2/followup', rateLimiter, async (req, res) => {
  const { userQuestion, aiResponse, model, provider } = req.body;

  // Validate input
  if (!userQuestion || !aiResponse) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'userQuestion and aiResponse are required.' 
    });
  }

  try {
    const prompt = `Based on this conversation, generate 2-3 relevant follow-up questions:

User Question: "${userQuestion}"
AI Response: "${aiResponse}"

Generate follow-up questions that would help the user learn more or get specific information. Return as a JSON array of questions.`;

    let followUpQuestions = [];
    
    // Use the specified provider or fall back to Google
    const actualProvider = provider || 'google';
    const actualModel = model || 'gemini-2.0-flash';
    
    switch (actualProvider) {
      case 'google':
        if (geminiClient) {
          const geminiModel = geminiClient.getGenerativeModel({ model: actualModel });
          const result = await geminiModel.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          // Try to parse JSON from response
          try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const questions = JSON.parse(jsonMatch[0]);
              followUpQuestions = questions.map((q, idx) => ({
                id: `followup-${Date.now()}-${idx}`,
                question: q,
                category: 'related',
                confidence: 0.7
              }));
            }
          } catch (e) {
            console.error('Failed to parse follow-up questions:', e);
          }
        }
        break;
        
      case 'openai':
        if (openaiClient) {
          const completion = await openaiClient.chat.completions.create({
            model: actualModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
          });
          
          const text = completion.choices[0].message.content;
          
          // Try to parse JSON from response
          try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const questions = JSON.parse(jsonMatch[0]);
              followUpQuestions = questions.map((q, idx) => ({
                id: `followup-${Date.now()}-${idx}`,
                question: q,
                category: 'related',
                confidence: 0.7
              }));
            }
          } catch (e) {
            console.error('Failed to parse follow-up questions:', e);
          }
        }
        break;
    }
    
    // Fallback questions if generation failed
    if (followUpQuestions.length === 0) {
      followUpQuestions = [
        {
          id: `followup-${Date.now()}-0`,
          question: 'Can you provide more specific examples?',
          category: 'clarification',
          confidence: 0.5
        },
        {
          id: `followup-${Date.now()}-1`,
          question: 'What are the next steps I should take?',
          category: 'practical',
          confidence: 0.5
        }
      ];
    }

    res.json({ followUpQuestions });

  } catch (error) {
    console.error('Error generating follow-up questions:', error);
    
    // Return empty array on error
    res.json({ followUpQuestions: [] });
  }
});

// Travel instructions proxy endpoint with caching and error handling
app.get('/api/travel-instructions', rateLimiter, async (req, res) => {
  try {
    const startTime = Date.now();
    const ifNoneMatch = req.headers['if-none-match'];
    
    // Check cache first (if caching enabled)
    if (cache) {
      const cachedData = await cache.get('travel-instructions');
      if (cachedData && cachedData.content && cachedData.etag) {
        console.log('Cache hit for travel instructions, age:', Date.now() - cachedData.timestamp, 'ms');
        
        // Handle conditional requests
        if (ifNoneMatch && ifNoneMatch === cachedData.etag) {
          return res.status(304).send(); // Not Modified
        }
        
        // Set cache headers
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('ETag', cachedData.etag);
        if (cachedData.lastModified) {
          res.setHeader('Last-Modified', cachedData.lastModified);
        }
        
        return res.json({ 
          content: cachedData.content, 
          fresh: false,
          cacheAge: Date.now() - cachedData.timestamp,
          timestamp: new Date(cachedData.timestamp).toISOString()
        });
      }
    }

    // Fetch from canada.ca with retry mechanism
    console.log('Fetching fresh travel instructions from:', config.canadaCaUrl);
    let response;
    let lastError;
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        response = await axios.get(config.canadaCaUrl, {
          timeout: config.requestTimeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CFTravelBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-CA,en;q=0.9',
            'Cache-Control': 'no-cache'
          },
          validateStatus: function (status) {
            return status < 500; // Accept any status < 500
          }
        });
        
        // If successful, break out of retry loop
        if (response.status === 200) {
          break;
        }
        
        // If 404 or other client error, don't retry
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Canada.ca returned status ${response.status}`);
        }
        
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${attempt} failed:`, error.message);
        if (attempt < config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelay * attempt));
        }
      }
    }
    
    // If all retries failed, throw the last error
    if (!response || response.status !== 200) {
      throw lastError || new Error('Failed to fetch travel instructions after all retries');
    }

    // Process HTML content
    const content = processContent(response.data);
    
    // Generate ETag from content
    const etag = `"${Buffer.from(content).toString('base64').substring(0, 27)}"`;
    
    // Update cache with comprehensive metadata (if caching enabled)
    if (cache) {
      await cache.set('travel-instructions', {
        content,
        timestamp: Date.now(),
        lastModified: response.headers['last-modified'],
        etag,
        source: 'canada.ca',
        fetchTime: Date.now() - startTime
      });
    }

    // Set appropriate cache headers
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('ETag', etag);
    if (response.headers['last-modified']) {
      res.setHeader('Last-Modified', response.headers['last-modified']);
    }

    res.json({ 
      content, 
      fresh: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Proxy error:', error.message, '\nStack:', error.stack);

    // Log detailed error information
    const errorDetail = {
      message: error.message,
      code: error.code,
      isAxiosError: error.isAxiosError,
      status: error.response?.status,
      endpoint: '/api/travel-instructions',
      timestamp: new Date().toISOString()
    };
    console.error('Structured error log:', JSON.stringify(errorDetail));

    // Sophisticated fallback strategy
    const cachedData = cache ? await cache.get('travel-instructions') : null;
    if (cachedData) {
      console.log('Serving stale cache due to error, cache age:', Date.now() - cachedData.timestamp, 'ms');
      
      // Set headers indicating stale content
      res.setHeader('Cache-Control', 'max-age=0, must-revalidate');
      if (cachedData.etag) {
        res.setHeader('ETag', `W/"${cachedData.etag}-stale"`);
      }
      
      return res.json({
        content: cachedData.content,
        stale: true,
        cacheAge: Date.now() - cachedData.timestamp,
        timestamp: new Date(cachedData.timestamp).toISOString()
      });
    }

    // Finally, if all else fails, return error
    // Use appropriate status code based on the error
    let statusCode = 500;
    let retryAfter = 60;
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
      statusCode = 503; // Service Unavailable
      retryAfter = 300; // 5 minutes
    } else if (error.response?.status === 429) {
      statusCode = 429; // Too Many Requests
      retryAfter = 600; // 10 minutes
    } else if (error.response?.status === 404) {
      statusCode = 404; // Not Found
    }
    
    // In production, don't expose detailed error info
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(statusCode).json({
      error: 'Failed to fetch travel instructions',
      message: isProduction ? 'Unable to retrieve travel information at this time.' : error.message,
      retryAfter,
      timestamp: new Date().toISOString()
    });
  }
});

// Google Maps distance calculation endpoint
app.post('/api/maps/distance', rateLimiter, async (req, res) => {
  try {
    const { origin, destination, mode = 'driving' } = req.body;
    
    if (!origin || !destination) {
      return res.status(400).json({
        error: 'Both origin and destination are required'
      });
    }

    if (!googleMapsClient) {
      return res.status(503).json({
        error: 'Google Maps service is not configured'
      });
    }

    console.log(`[Maps API] Calculating distance from ${origin} to ${destination} via ${mode}`);

    // Call Google Maps Distance Matrix API
    const response = await googleMapsClient.distancematrix({
      params: {
        origins: [origin],
        destinations: [destination],
        mode: mode,
        units: 'metric',
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    const result = response.data.rows[0]?.elements[0];
    
    if (!result || result.status !== 'OK') {
      return res.status(404).json({
        error: 'Could not calculate distance between the specified locations',
        details: result?.status || 'Unknown error'
      });
    }

    // Extract distance and duration
    const distanceData = {
      distance: {
        text: result.distance.text,
        value: result.distance.value // meters
      },
      duration: {
        text: result.duration.text,
        value: result.duration.value // seconds
      },
      origin: response.data.origin_addresses[0],
      destination: response.data.destination_addresses[0],
      mode: mode
    };

    console.log(`[Maps API] Distance calculated successfully: ${distanceData.distance.text}`);

    res.json(distanceData);
  } catch (error) {
    console.error('[Maps API] Error calculating distance:', error);
    res.status(500).json({
      error: 'Failed to calculate distance',
      message: error.message
    });
  }
});

// Maps API routes
app.use(mapsRoutes);

// Advanced health check endpoint with detailed system stats
app.get('/health', async (req, res) => {
  // Get cache stats
  const cacheStats = cache ? cache.getStats() : null;
  const cacheHealth = cache ? cache.getHealth() : { status: 'disabled' };
  
  // Try to get travel instructions cache info
  const travelInstructionsCache = cache ? await cache.get('travel-instructions') : null;
  const cacheAge = travelInstructionsCache && travelInstructionsCache.timestamp
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
  const clientsAtLimit = apiRequestCounts ? Array.from(apiRequestCounts.entries())
    .filter(([_, count]) => count >= config.rateLimitMax).length : 0;
    
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
      heapUsed: formatMemory(memoryUsage.heapUsed)
    },
    cache: config.cacheEnabled ? {
      enabled: true,
      status: cacheHealth.status,
      redis: cacheHealth.redis,
      memory: cacheHealth.memory,
      performance: cacheHealth.performance,
      stats: cacheStats ? {
        totalHits: cacheStats.combined.totalHits,
        totalMisses: cacheStats.combined.totalMisses,
        hitRate: cacheStats.combined.hitRate
      } : null,
      travelInstructions: {
        cached: !!travelInstructionsCache,
        age: cacheAge,
        size: travelInstructionsCache && travelInstructionsCache.content
          ? `${Math.round(travelInstructionsCache.content.length / 1024)} KB` 
          : '0'
      }
    } : { enabled: false },
    rateLimiting: {
      enabled: config.rateLimitEnabled,
      activeClients,
      clientsAtLimit,
      limit: config.rateLimitMax,
      window: `${config.rateLimitWindow / 1000}s`
    },
    environment: process.env.NODE_ENV || 'production',
    ragService: ragHealth,
    timestamp: new Date().toISOString()
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
      rateLimit: config.rateLimitMax
    },
    models: {
      default: 'gpt-4.1-mini',
      providers: {
        google: !!geminiClient,
        openai: !!openaiClient,
        anthropic: !!anthropicClient
      }
    },
    caching: {
      enabled: config.cacheEnabled,
      duration: Math.floor(config.cacheTTL / 1000 / 60) + ' minutes'
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
      health: '/health'
    },
    // RAG service info
    rag: {
      enabled: !!process.env.RAG_SERVICE_URL,
      serviceUrl: process.env.RAG_SERVICE_URL || 'http://localhost:8000'
    },
    // Client-side configuration
    client: {
      retryEnabled: true,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay
    },
    timestamp: new Date().toISOString()
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
    version: '1.0.0'
  };

  // Try to get build info from dist directory
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (existsSync(packagePath)) {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      buildInfo.version = pkg.version;
    }
  } catch (err) {
    console.log('Could not read package.json:', err.message);
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
      programmatic: `Add ?v=${cacheBreaker} to URLs to bypass cache`
    }
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
  path.join(process.cwd(), 'dist')
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
        console.log(`Found static assets at: ${distPath}`);
        break;
      }
    } catch (err) {
      console.error(`Error checking path ${testPath}:`, err.message);
    }
  }
}
// Serve static files from dist directory
if (distPath) {
  console.log("Serving static files from:", distPath);
  
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
  path.join(__dirname, 'dist', 'landing')
];

let landingPath = null;
for (const testPath of possiblePublicPaths) {
  if (existsSync(testPath)) {
    try {
      const stats = statSync(testPath);
      if (stats.isDirectory()) {
        landingPath = testPath;
        console.log(`Found landing page at: ${landingPath}`);
        break;
      }
    } catch (err) {
      console.error(`Error checking landing path ${testPath}:`, err.message);
    }
  }
}

if (landingPath) {
  // Serve landing page files with proper MIME types
  app.use('/landing', express.static(landingPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
      }
    }
  }));
  
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
  console.error('Could not find public_html directory at any of these paths:', possiblePublicPaths);
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
      timestamp: new Date().toISOString()
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
  const staticFileExtensions = ['.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js', '.json', '.woff', '.woff2', '.ttf', '.eot'];
  const hasStaticExtension = staticFileExtensions.some(ext => req.path.toLowerCase().endsWith(ext));
  
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
      'content-type': req.headers['content-type']
    },
    error: {
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
      code: err.code,
      statusCode: err.statusCode || err.status
    },
    timestamp: new Date().toISOString()
  };
  
  // Log the error with structured data
  console.error('Global error handler:', JSON.stringify(errorDetails, null, 2));
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
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred. Please try again later.' 
        : err.message,
      errorId,
      timestamp: new Date().toISOString()
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

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
  
  // Close cache connections
  if (cache) {
    await cache.disconnect();
    console.log('Cache connections closed');
  }
  
  // Allow existing connections to finish (with timeout)
  setTimeout(() => {
    console.log('Forcing shutdown after timeout');
    process.exit(0);
  }, 10000);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
// Do not bind to a specific host when running under PM2 cluster mode,
// so workers can share the same port without EADDRINUSE.
let server = null;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`Cache: ${config.cacheEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`Rate Limiting: ${config.rateLimitEnabled ? `Enabled (${config.rateLimitMax} req/min)` : 'Disabled'}`);
    console.log(`Static assets: ${distPath || 'Not found'}`);
    console.log(`Landing page: ${landingPath || 'Not found'}`);
    
    // Log available endpoints
    console.log('\nAvailable endpoints:');
    console.log('  GET  /health');
    console.log('  GET  /api/config');
    console.log('  GET  /api/travel-instructions');
    console.log('  POST /api/gemini/generateContent');
    console.log('  POST /api/v2/chat');
    console.log('  POST /api/v2/followup');
    console.log('  POST /api/clear-cache');
    console.log('  GET  /api/deployment-info');
  });
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (chatLogger && config.loggingEnabled) {
    chatLogger.log({
      type: 'unhandledRejection',
      reason: reason?.toString(),
      stack: reason?.stack,
      timestamp: new Date().toISOString()
    });
  }
});

export default app;
