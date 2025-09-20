# API Integration

## Overview

This application integrates with Google's Gemini API to provide AI-powered responses to user queries about Canadian Forces Travel Instructions. The integration is designed to be secure, reliable, and efficient.

## Gemini API Integration

### Client-Side Integration (src/api/gemini.jsx)

The client-side integration provides a clean interface for components to interact with the Gemini API:

```javascript
// Example usage
import { sendToGemini } from '../api/gemini';

const response = await sendToGemini(
  userMessage,
  isSimplifiedMode,
  'gemini-2.0-flash',
  travelInstructionsText
);
```

### Key Features

1. **Dual Access Methods**:
   - Direct SDK access via Google's official library
   - Proxy API access for development and security

2. **Error Handling**:
   - Comprehensive error classification
   - Retry logic with exponential backoff
   - Fallback content for failed requests

3. **Security**:
   - API key validation
   - Secure header-based authentication
   - Environment-aware configuration

### Models

The application supports the following Gemini models:

- `gemini-2.0-flash`: Default model offering a balance of speed and quality
- `gemini-2.0-flash-lite`: Faster, lighter model for simpler queries

## Server Gateway (`server/main.js`)

All Gemini traffic now flows through the hardened Express gateway. This service handles authentication, rate limiting, caching, and outbound calls to Gemini on behalf of the client. Key endpoints include:

1. **`/api/gemini/generateContent`**
   - **Method**: POST
   - **Purpose**: Generate AI content via Gemini using server-held credentials
   - **Security**: Protected by the gateway's rate limiter and never exposes API keys to the browser

2. **`/api/travel-instructions`**
   - **Method**: GET
   - **Purpose**: Retrieve preprocessed travel-instruction content
   - **Caching**: Backed by Redis/memory cache with TTL controls

3. **`/health`** and **`/api/config`**
   - **Method**: GET
   - **Purpose**: Operational diagnostics and safe client configuration payloads
   - **Security**: `/health` provides limited details by default; admin-only information remains gated

### Rate Limiting

The gateway enforces configurable rate limits (default 60 requests/min per client) and returns 429 responses with `Retry-After` headers when exceeded.

### Response Format

Gemini responses are normalized before returning to the client. Errors emit structured JSON payloads such as:

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

## Travel Instructions Data

The application fetches travel instructions data from:

1. Primary source: Canadian government website
2. Fallback: Cached version in memory/IndexedDB
3. Final fallback: Built-in default content

The data is structured as a text document with sections and is preprocessed for optimal AI interaction.

## Caching Strategy

The API integration implements a multi-level caching strategy:

1. **Memory Cache**: Ultra-fast in-memory caching during active sessions
2. **IndexedDB**: Persistent client-side caching between sessions
3. **HTTP Caching**: ETag and Cache-Control headers
4. **Stale-While-Revalidate**: Serve stale content while fetching fresh data

## Configuration

API integration can be configured via environment variables:

- `GEMINI_API_KEY`: Server-side Gemini API key (never exposed to clients)
- `NODE_ENV`: Environment setting (development/production)
- Other settings via the `/api/config` endpoint
