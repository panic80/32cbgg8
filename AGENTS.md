# Repository Guidelines

## Project Structure & Module Organization

The Vite/React client lives under `src/` with feature folders (`components/`, `pages/`, `api/`, `hooks/`, `context/`). Import shared pieces with the `@/` alias instead of deep relatives. UI tests belong in `src/__tests__/` or alongside components; common test helpers live in `src/setupTests.js`. The Express gateway sits in `server/` (`main.js`, `routes/`, `middleware/`, `services/`). Python retrieval pipelines live in `rag-service/`; treat them as an isolated virtualenv. Operational assets (PM2 scripts and docs) reside in `docs/`, `scripts/`, and `ecosystem.config.cjs`. Built assets output to `dist/`.

## Build, Test, and Development Commands

Use `npm run dev` to start the Vite client on 3001 and `npm run dev:server` for the Express gateway on 3000; `npm run dev:full` runs both. `npm run build` creates the production bundle in `dist/`; `npm run preview` serves the built assets; `npm start` boots Express against the build. Run `npm run test`, `npm run test:watch`, or `npm run test:coverage` to execute Vitest, with coverage required before hand-off. Deployment helpers (`npm run deploy:*`, `npm run rollback:*`) wrap the PM2 flows in `scripts/`.

## Coding Style & Naming Conventions

Keep two-space indentation, functional React components, and Tailwind utility groupings. Use PascalCase for components, camelCase for utilities, and `useX` prefixes for hooks. Extend shared types from `src/types/`. The lint script is a stub—run Prettier/ESLint locally and keep import ordering stable.

## Testing Guidelines

Vitest with Happy DOM and Testing Library is configured in `vitest.config.js`. Name specs `*.test.*` or `*.spec.*`, colocate fixtures with the feature, and reuse helpers from `src/setupTests.js`. Cover network fallbacks and chat edge cases; run `npm run test:coverage` before submitting to confirm thresholds.

## Commit & Pull Request Guidelines

Match the existing history: concise, imperative commit subjects such as `Fix suggested question rendering`, with one logical change per commit. PRs should summarize impact, reference issues, attach UI screenshots or logs when relevant, and confirm `npm run build` plus the appropriate test command.

## Security & Configuration Tips

Store secrets in untracked env files; production reads `/etc/cbthis/env` along with `.env` variants. Activate the `rag-service` virtualenv before touching Python dependencies and update the matching `requirements*.txt`. Review `docs/security.md` and `docs/deployment.md` when adjusting headers, proxies, or PM2/nginx settings.
