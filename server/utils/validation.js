/**
 * Shared validation utilities for request parameters
 */

/**
 * Parse and validate a number with optional min/max bounds
 */
export const parseNumber = (value, { fallback, min = 0, max = Number.MAX_SAFE_INTEGER }) => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

/**
 * Sanitize a string value, returning undefined if invalid or empty
 */
export const sanitizeString = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
