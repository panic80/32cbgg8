// Shared HTTP utilities

/**
 * Decode URL-encoded values in nested objects/arrays.
 * Mirrors the existing implementation in server/main.js to preserve behavior.
 */
export const decodeUrlParams = (params) => {
  if (!params || typeof params !== 'object') return params;

  const result = {};
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string' ? decodeURIComponent(item.replace(/\+/g, ' ')) : item,
      );
    } else if (typeof value === 'string') {
      result[key] = decodeURIComponent(value.replace(/\+/g, ' '));
    } else if (typeof value === 'object' && value !== null) {
      result[key] = decodeUrlParams(value); // Handle nested objects
    } else {
      result[key] = value;
    }
  }
  return result;
};
