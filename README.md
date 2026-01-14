# CF Travel Bot

Canadian Forces Travel Instructions chatbot with a React front end, an Express gateway, and a Python RAG service. The system focuses on travel policy guidance, chat workflows, and trip planning support.

## Architecture
- Frontend: Vite + React in `src/` (chat UI, admin views, trip planner).
- Backend gateway: Node/Express in `server/` (API, auth, rate limiting, caching).
- RAG service: Python FastAPI in `rag-service/` (retrieval, embeddings, ingestion).
- Storage: Redis for caching and state, Chroma for vector storage.

## Local development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file:
   ```bash
   cp .env.example .env
   ```
3. Start the app:
   ```bash
   npm run dev:full
   ```
   Or use the helper:
   ```bash
   ./start-dev.sh
   ```

Endpoints:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Health check: http://localhost:3000/health

If you want the RAG service locally, follow the docs in `rag-service/` or use Docker (below).

## Docker quick start
```bash
./docker-start.sh
```

Stop services:
```bash
./docker-stop.sh
```

Docker ports:
- App: http://localhost:3000
- RAG service: http://localhost:8000

## Configuration
Copy `.env.example` or `.env.template` and set values. Sensitive values can live in `/etc/cbthis/env`.

Common variables:
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `REDIS_URL`, `ENABLE_CACHE`, `CACHE_TTL`
- `RAG_SERVICE_URL`
- `CONFIG_PANEL_USER`, `CONFIG_PANEL_PASSWORD`, `ADMIN_API_TOKEN`
- `TRIP_PLANNER_MODEL`
- `VITE_MAINTENANCE_MODE`, `VITE_MAINTENANCE_MESSAGE`
- `MODEL_CONFIG_PATH` (optional override for model config JSON)

## Common scripts
- `npm run dev`: Vite frontend on port 3001
- `npm run dev:server`: Express API on port 3000
- `npm run dev:full`: run both together
- `npm run build`: build server + frontend
- `npm run start`: run compiled server (`dist-server/`)
- `npm test`: run tests with Vitest
- `npm run lint`: eslint + prettier

## RAG ingestion
Use `ingest_sources_cli.py` for manual ingestion into the RAG service.
```bash
python ingest_sources_cli.py --help
```

See `rag-service/` for service docs and scripts, including `rag-service/scripts/README.md`.
