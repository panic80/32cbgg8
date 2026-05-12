# Repository Guidelines

Use this guide to keep Vite/React + Express + RAG contributions aligned with release expectations.

## Project Structure & Module Organization
- `src/` hosts the SPA: `components/`, `pages/`, `routes/`, and shared helpers in `lib/`, `utils/`, and `context/`. UI tests stay in `src/__tests__`.
- `server/` mirrors the API layers: controllers, services, middleware, and routes bootstrapped by `server/main.js`. Use `server/__tests__` for integration specs.
- `public/` carries static assets, while `docs/` and `rag-service/` contain ingestion pipelines and LangGraph tooling. Build output lands in `dist/`; deployment and health scripts live under `scripts/`.

## Build, Test, and Development Commands
- `npm run dev` starts the Vite client on port 3001; `npm run dev:server` runs the Express API. Use `npm run dev:full` to start both via `concurrently`.
- `npm run build` (or `npm run build:prod`) creates optimized artifacts in `dist/`; `npm run start` serves the bundle behind Express, and `npm run preview` smoke-tests the static build.
- `npm run lint` executes ESLint (`lint:eslint`) and Prettier (`lint:prettier`); append `:fix` to auto-format.

## Coding Style & Naming Conventions
Write TypeScript/ES modules with 2-space indentation and single quotes; Prettier enforces this via `prettier.config.cjs`. React components and contexts use `PascalCase`, hooks `useCamelCase`, and shared utilities stay `camelCase`. Keep imports sorted per `eslint-plugin-simple-import-sort` and favor Tailwind utility classes from `src/styles/*.css`.

## Testing Guidelines
Vitest powers unit tests with `@testing-library/react` for UI and Supertest for API endpoints. Create files named `*.test.ts(x)` or `*.spec.ts(x)` under the closest `__tests__` directory. Run `npm run test` before committing, `npm run test:watch` during iteration, and `npm run test:coverage` to guard for ≥80% statements on touched modules.

## Commit & Pull Request Guidelines
Use Conventional Commits (`feat: add ingestion tooling`, `fix: sanitize paths`). Keep the summary ≤72 chars, describe motivation plus test evidence in the body, and reference tickets with `Refs #123`. Pull requests must include the change overview and risk, screenshots or cURL output for UI/API shifts, lists of commands or tests executed, and callouts for config, schema, or dependency updates. Coordinate large changes through Draft PRs so ops can plan PM2 reloads.

## Security & Configuration Tips
Keep `.env` files local; never commit API keys for Anthropic, Google, or Redis. Regenerate ingestion credentials through the secrets manager before running `rag-service/scripts`. When touching `nginx.conf` or `ecosystem.config.cjs`, note the required reload command (`npm run reload`) in your PR so on-call agents can sync environment variables.

## Deployment Reality Check
- `/root/cf-travel-bot-extracted` is an extracted/dev workspace, not the live checkout for `32cbgg8.com`.
- nginx serves `https://32cbgg8.com/` from `/var/www/cbthis/dist`; confirm with `nginx -T 2>/tmp/nginx_T.err | rg -n "32cbgg8|root |alias |proxy_pass"`.
- For production UI changes, edit `/var/www/cbthis`, run `npm run build` from `/var/www/cbthis`, then verify `curl -sS -I https://32cbgg8.com/ --max-time 12` shows a fresh `Last-Modified` and browser-test the live domain.
- Static frontend asset changes do not need a PM2 reload when nginx is serving `/var/www/cbthis/dist`; the required deployment step is rebuilding the production checkout.
- 2026-05-12 lesson: a card update made only in `/root/cf-travel-bot-extracted` did not affect the live site until the matching data-driven change was applied under `/var/www/cbthis/src/pages/LandingPage/` and rebuilt.
