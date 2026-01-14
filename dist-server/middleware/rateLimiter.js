/**
 * Rate limiting middleware with Redis and in-memory fallback.
 */
import { getLogger } from '../services/logger.js';
const logger = getLogger('middleware:rateLimiter');
/**
 * Creates rate limiting middleware.
 * @param {Object} options
 * @param {Object} options.config - Gateway configuration
 * @param {Object} options.cache - Cache service instance
 * @param {Object} options.chatLogger - Chat logger for rate limit events
 * @returns {Object} { rateLimiter, rateLimitBuckets, apiRequestCounts }
 */
export const createRateLimiter = ({ config, cache, chatLogger, }) => {
    const rateLimitBuckets = config.rateLimitEnabled ? new Map() : null;
    const apiRequestCounts = config.rateLimitEnabled ? new Map() : null;
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
            if (cache && cache.redisConnected) {
                const key = `rl:${clientIP}:${windowStart}`;
                // Atomic INCR with expiry using Lua script to prevent race condition
                const luaScript = `
          local count = redis.call('INCR', KEYS[1])
          if count == 1 then
            redis.call('PEXPIRE', KEYS[1], ARGV[1])
          end
          return count
        `;
                count = Number(await cache.eval(luaScript, {
                    keys: [key],
                    arguments: [String(windowMs)],
                }));
                usedRedis = true;
            }
        }
        catch (error) {
            // Fall back to memory on Redis error
            const err = error;
            logger.warn('Redis rate limit failed, using memory fallback', { error: err.message });
            usedRedis = false;
        }
        if (!usedRedis && rateLimitBuckets) {
            // In-memory fallback (per-process)
            const bucket = rateLimitBuckets.get(clientIP);
            if (!bucket || bucket.expiresAt <= now) {
                rateLimitBuckets.set(clientIP, { count: 1, expiresAt: now + windowMs });
                count = 1;
            }
            else {
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
            if (config.loggingEnabled && chatLogger) {
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
    return {
        rateLimiter,
        rateLimitBuckets,
        apiRequestCounts,
    };
};
//# sourceMappingURL=rateLimiter.js.map