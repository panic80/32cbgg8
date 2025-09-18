# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Primary Development
- `npm run dev` - Start frontend development server (port 3001)
- `npm run dev:server` - Start backend Express server (port 3000)
- `npm run dev:full` - Start both servers concurrently
- `./start-dev.sh` - Development script with cleanup

### RAG Service (Python)
- `cd rag-service && uvicorn app.main:app --reload --port 8000` - Start RAG service
- `cd rag-service && ./setup.sh` - Initial setup for RAG service

### Building & Testing
- `npm run build` - Production build
- `npm run build:staging` - Staging build with staging environment
- `npm run build:production` - Production build with production environment
- `npm run test` - Run all tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

### Health Checks & Deployment
- `npm run health-check:local` - Verify local services
- `npm run deploy:staging:script` - Deploy to staging
- `npm run deploy:production:script` - Deploy to production
- `npm run rollback:production:script` - Rollback production deployment

## Architecture Overview

This is a Canadian Forces Travel Instructions Chatbot with a multi-service architecture:

**Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui components
**Backend**: Express.js server with Redis caching and API proxy
**AI Integration**: Multiple LLM providers (OpenAI, Google Gemini, Anthropic)
**RAG Service**: Python/FastAPI with LangChain for document retrieval and citation

### Service Ports
- Frontend dev server: 3001
- Express backend: 3000
- RAG service: 8000
- Redis cache: 6379

### Key Directories
- `/src/` - React frontend code
- `/server/` - Express.js backend
- `/rag-service/` - Python RAG service with LangChain
- `/scripts/` - Deployment and utility scripts

## Configuration

Environment files: `.env`, `.env.development`, `.env.staging`, `.env.production`

Critical environment variables:
- `VITE_GEMINI_API_KEY` - Google Gemini API key
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `REDIS_URL` - Redis connection URL
- `NODE_ENV` - Environment mode
- `ENABLE_CACHE` - Cache toggle
- `ENABLE_RATE_LIMIT` - Rate limiting toggle
- `RAG_SERVICE_URL` - RAG service endpoint (default: http://localhost:8000)
- `RAG_DEFAULT_LOCATION` - Optional default location appended to location-agnostic queries (e.g., `Ontario, Canada`)
- `VITE_API_BASE_URL` - Backend API URL (default: http://localhost:3000)

## Testing

**Frontend**: Vitest + React Testing Library with Happy DOM
**Integration**: Full workflow testing across services

Test files location: `src/**/*.{test,spec}.{js,jsx,ts,tsx}`

### Running Tests
- `npm run test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run test -- src/components/ChatInterface.test.tsx` - Run a single test file

## Development Notes

- The system uses Server-Sent Events (SSE) for real-time chat streaming
- Multi-level caching strategy (Redis, in-memory, browser storage)
- PM2 process management in production via `ecosystem.config.cjs`
- Automated deployment with health checks and rollback capabilities
- Proxy architecture separates API routing from main application logic

## Development Principles

- Always adhere to langchain defacto and builtin solution before creating custom scripts
- Always generate generic solutions, not site or URL or file specific solutions
- Frontend components use shadcn/ui (New York style) - check existing components before creating new ones
- Use existing API client utilities in `/src/lib/api/` for backend communication
- Follow TypeScript strict mode practices - no implicit any types
- Maintain separation between API routing (server/routes/) and business logic
- test should be objective, and not cater for expected results. remember tests should reveal weaknesses, bugs and faults.
