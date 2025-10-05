/**
 * Set Server-Sent Events headers on a response.
 * Allows passing extra headers (e.g., CORS and X-Accel-Buffering) without altering defaults.
 */
export const setSseHeaders = (res, extraHeaders = {}) => {
  const base = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
  res.writeHead(200, { ...base, ...extraHeaders });
};
