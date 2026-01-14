# Technology Stack

## Core Language

- **TypeScript:** 100% strict typing across the entire codebase.

## Frontend

- **Framework:** React 19 (Upgrade target)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI, Lucide React, Framer Motion
- **Routing:** React Router DOM
- **Icons:** React Icons, Heroicons

## Backend (Hybrid)

- **Main Server:**
  - **Runtime:** Node.js
  - **Framework:** Express
  - **Executor:** tsx (for development), Node (for production)
- **RAG Service:**
  - **Language:** Python
  - **Purpose:** Specialized RAG operations and vector database management
- **API Clients:** OpenAI, Anthropic, Google Generative AI
- **Security:** Helmet, Express Rate Limit, CORS

## Data & Storage

- **Primary Database:** SQLite (via `better-sqlite3`)
- **Cache:** Redis
- **Vector Database:** Chroma DB

## Infrastructure & DevOps

- **Containerization:** Docker & Docker Compose
- **Process Management:** PM2
- **Proxy:** Nginx
- **Logging:** Custom logger

## Testing & Quality

- **Unit/Integration Testing:** Vitest
- **Testing Library:** React Testing Library, Jest DOM
- **Linting:** ESLint (with strict TypeScript rules)
- **Formatting:** Prettier
