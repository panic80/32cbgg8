# Project Documentation

Welcome to the official documentation for the Canadian Forces Travel Instructions Chatbot.

## Overview

This application provides an AI-powered chatbot interface for querying information from the Canadian Forces Travel Instructions. The system uses Google's Gemini LLM models to provide accurate answers to user queries, with a focus on security, reliability, and user experience.

## Table of Contents

1. [Architecture](./architecture.md)
2. [API Integration](./api-integration.md)
3. [Operations](./operations/index.md)
4. [RAG Hub](./rag/index.md)
5. [Development Guide](./development.md)
6. [Contributing](./contributing.md)
7. [Testing](./testing.md)
8. [Security](./security/index.md)
9. [Operations Backlog](./backlog/index.md)
10. [Guides](./guides/index.md)
11. [Troubleshooting](./troubleshooting.md)
12. [Performance Dashboard](./performance-dashboard.md)

## Quick Start

To run this application in development mode:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

To build for production:

```bash
npm run build
```

## Environment Setup

This application uses environment variables for configuration. Create a `.env` file in the root directory:

```
GEMINI_API_KEY=your-api-key-here
PORT=3000
NODE_ENV=development
```

## License

This software is proprietary and confidential.

## Contact

For questions or support, please contact your system administrator or IT department.
