/**
 * Security configuration for Express application.
 * Handles Helmet (CSP, HSTS, etc.) and CORS settings.
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Creates Helmet configuration with enhanced security headers.
 * @returns {Object} Helmet options
 */
export const createHelmetConfig = () => ({
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
        ...(isDevelopment ? ["'unsafe-eval'"] : []), // Only in development for React dev tools
        'https://fonts.googleapis.com',
        'https://maps.googleapis.com', // Google Maps API
        'https://maps.gstatic.com', // Google Maps static content
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // Required for inline event handlers in React
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
});

/**
 * Creates CORS configuration with environment-specific settings.
 * @param {Object} options
 * @param {Function} options.logger - Logger function for warnings
 * @returns {Object} CORS options
 */
export const createCorsConfig = ({ logger } = {}) => {
  const allowedOrigins = isDevelopment
    ? [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        process.env.FRONTEND_URL,
      ].filter(Boolean)
    : ['https://32cbgg8.com', 'https://www.32cbgg8.com', process.env.FRONTEND_URL].filter(Boolean);

  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger?.warn?.(`CORS: Blocked request from origin: ${origin}`);
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
  };
};

/**
 * Get allowed origins set for SSE CORS headers.
 * @returns {Set<string>} Set of allowed origins
 */
export const getAllowedOrigins = () => {
  const origins = isDevelopment
    ? [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        process.env.FRONTEND_URL,
      ].filter(Boolean)
    : ['https://32cbgg8.com', 'https://www.32cbgg8.com', process.env.FRONTEND_URL].filter(Boolean);

  return new Set(origins);
};

/**
 * Build CORS headers for SSE responses.
 * @param {string} originHeader - The Origin header from the request
 * @returns {Object} CORS headers object
 */
export const buildSseCorsHeaders = (originHeader) => {
  if (!originHeader) {
    return {};
  }

  const allowedOriginsSet = getAllowedOrigins();

  if (allowedOriginsSet.has(originHeader)) {
    return {
      'Access-Control-Allow-Origin': originHeader,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    };
  }

  return {};
};

/**
 * Creates additional security headers middleware (Permissions Policy, COOP, etc.)
 * @returns {Function} Express middleware
 */
export const createSecurityHeadersMiddleware = () => (req, res, next) => {
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
};
