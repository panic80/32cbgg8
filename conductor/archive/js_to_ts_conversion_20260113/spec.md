# Specification: Absolute Zero JavaScript - Full TypeScript Conversion

## 1. Overview

The goal of this track is to achieve a 100% TypeScript codebase. This involves converting all remaining JavaScript, CommonJS, and ES Module files (`.js`, `.cjs`, `.mjs`) to strict TypeScript. The final state must contain no JavaScript source code or configuration files.

## 2. Scope

The conversion covers every remaining non-TypeScript script and configuration file in the repository, including but not limited to:

### 2.1 Source & Test Files

- `server/__tests__/ragRefactor.test.js`

### 2.2 Infrastructure & Scripts

- `scripts/run-vitest.mjs`

### 2.3 Configuration Files

- `eslint.config.js`
- `tailwind.config.js`
- `vite.config.js`
- `vitest.config.js`
- `ecosystem.config.cjs`
- `postcss.config.cjs`
- `prettier.config.cjs`

## 3. Requirements

### 3.1 Strict TypeScript Enforcement

- **Constraint:** `any` type is strictly forbidden.
- **Strict Mode:** All files must comply with `strict: true` in `tsconfig.json`.
- **Typing:** Use official type definitions for all libraries (e.g., `Config` from `tailwindcss`, `UserConfig` from `vite`).

### 3.2 Build & Runtime Environment

- All tools (Vite, Vitest, ESLint, PostCSS, Prettier) must be configured to consume `.ts` config files.
- Scripts must be executed using `tsx`, `ts-node`, or equivalent TypeScript executors.
- The `dist` or `build` folders must be the only place where JavaScript exists (as generated artifacts), and these must be ignored by version control.

## 4. Acceptance Criteria

- [ ] Zero `.js`, `.cjs`, or `.mjs` files remain in the source tree.
- [ ] No `any` types or `@ts-ignore` comments are used to bypass the compiler.
- [ ] `npm run build` completes successfully.
- [ ] `npm run lint` passes without warnings.
- [ ] `npm run dev` and all lifecycle scripts function correctly using the new `.ts` configurations.
- [ ] All tests pass in the new TypeScript environment.

## 5. Out of Scope

- Architectural changes to the application logic.
