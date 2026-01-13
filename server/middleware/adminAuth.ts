/**
 * Admin authentication middleware.
 * Provides Basic auth protection for admin routes.
 */

import type { Request, Response, NextFunction } from 'express';
import { getLogger } from '../services/logger.js';

const logger = getLogger('middleware:adminAuth');

/**
 * Check if a path requires config panel authentication.
 * @param {string} pathname - Request path
 * @returns {boolean} True if auth required
 */
export const requiresConfigAuth = (pathname = '') => {
  return (
    pathname === '/config' ||
    pathname.startsWith('/config/') ||
    pathname === '/chat/config' ||
    pathname.startsWith('/chat/config/') ||
    pathname === '/resources' ||
    pathname.startsWith('/resources/') ||
    pathname === '/landing-test' ||
    pathname.startsWith('/landing-test/')
  );
};

interface AdminAuthConfig {
  admin?: {
    password?: string;
    user?: string;
    apiToken?: string;
  };
}

/**
 * Creates admin authentication middleware.
 * Reads credentials from configuration or environment variables.
 * @param {Object} [config] - Gateway configuration object
 * @returns {Object} { requireAdminAuth, adminAuthEnabled }
 */
export const createAdminAuthMiddleware = (config: AdminAuthConfig) => {
  const adminPassword = config?.admin?.password || process.env.CONFIG_PANEL_PASSWORD;
  const adminUser = config?.admin?.user || process.env.CONFIG_PANEL_USER || 'admin';
  const adminApiToken = config?.admin?.apiToken || process.env.ADMIN_API_TOKEN;

  const adminAuthEnabled =
    typeof adminPassword === 'string' && adminPassword.length > 0;

  if (!adminAuthEnabled) {
    throw new Error('CONFIG_PANEL_PASSWORD must be set before starting the server.');
  }

  if (!adminApiToken || adminApiToken.trim().length === 0) {
    throw new Error('ADMIN_API_TOKEN must be set before starting the server.');
  }

  const requireAdminAuth = (req: Request, res: Response, next: NextFunction) => {
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

          if (providedUser === adminUser && providedPassword === adminPassword) {
            return next();
          }
        }
      } catch (error) {
        logger.error('Failed to decode admin auth credentials', error);
      }
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Config", charset="UTF-8"');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Administrator credentials required to access this resource.',
    });
  };

  return { requireAdminAuth, adminAuthEnabled };
};

/**
 * Get RAG service auth headers.
 * @returns {Object} Authorization headers
 */
export const getRagAuthHeaders = (): { Authorization: string } => {
  const adminApiToken = process.env.ADMIN_API_TOKEN;
  return { Authorization: `Bearer ${adminApiToken}` };
};
