# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the Vite/React client with feature folders (`components/`, `pages/`, `api/`, `hooks/`, `context/`); `@/` aliases this root.
- Tests live in `src/__tests__` and alongside components; shared test helpers sit in `src/setupTests.js`.
- `server/` provides the Express gateway (`main.js`, `routes/`, `middleware/`, `services/`) that fronts the chat UI.
- `rag-service/` contains the Python ingestion and retrieval pipelines—treat it as a separate virtualenv-backed workspace.
- Ops assets reside in `docs/`, `scripts/`, `ecosystem.config.cjs`, and `docker-compose.*`; production builds land in `dist/`.

## Build, Test, and Development Commands
- `npm run dev` starts Vite on 3001; pair with `npm run dev:server` on 3000 or use `npm run dev:full` to launch both.
- `npm run build` compiles to `dist/`; `npm run preview` serves the bundle; `npm start` boots Express against the build.
- `npm run test`, `npm run test:watch`, and `npm run test:coverage` execute Vitest.
- Deployment helpers (`npm run deploy:*`, `npm run rollback:*`) wrap the PM2 recipes stored in `scripts/`.

## Coding Style & Naming Conventions
- Maintain the two-space indentation and functional React components; prefer Tailwind utility groupings already in place.
- Use PascalCase for components, camelCase for utilities, and `useX` prefixes for custom hooks; extend shared types from `src/types/`.
- Keep async data work in `src/api/` or `lib/`, and favor the `@/` alias over deep relative paths.
- The lint script is a stub—apply Prettier/ESLint locally and keep imports stable.

## Testing Guidelines
- Vitest with Happy DOM and Testing Library is configured in `vitest.config.js`; mirror existing patterns in `src/__tests__/`.
- Name files `*.test.*` or `*.spec.*` and bundle fixtures with the feature.
- Cover network fallbacks and chat edge cases; run `npm run test:coverage` before hand-off.

## Commit & Pull Request Guidelines
- Match the current history: concise, imperative commit subjects (`Fix suggested question rendering`); one logical change per commit.
- PRs should summarize impact, link issues, attach UI screenshots or logs when relevant, and confirm `npm run build` plus the appropriate test command.
- Flag config or infra changes for PM2/environment updates.

## Security & Configuration Tips
- Store secrets in untracked env files; production reads `/etc/cbthis/env` alongside `.env` and `.env.<env>`.
- When touching `rag-service/`, activate its venv and sync dependencies via the matching `requirements*.txt` file.
- Revisit `docs/security.md` and `docs/deployment.md` whenever adjusting headers, proxies, or nginx/PM2 settings.
