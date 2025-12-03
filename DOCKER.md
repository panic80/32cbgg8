# Docker Setup for CF Travel Bot

This project is fully containerized using Docker and Docker Compose.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose) installed.

## Quick Start

1.  **Start the application:**
    ```bash
    ./docker-start.sh
    ```
    This will build the images and start the services in detached mode.
    The application will be available at [http://localhost:3000](http://localhost:3000).

2.  **View Logs:**
    ```bash
    docker-compose logs -f
    ```

3.  **Stop the application:**
    ```bash
    ./docker-stop.sh
    ```

## Services

-   **app**: Node.js Backend + React Frontend (Port 3000)
-   **rag-service**: Python FastAPI RAG Service (Port 8000)
-   **redis**: Redis Cache (Port 6379)

## Configuration

Environment variables are loaded from `.env`. The `docker-compose.yml` file orchestrates the services and networking.
