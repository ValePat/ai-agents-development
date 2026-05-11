✦ Here is the detailed implementation plan based on your choice
  of Colima. Please review it:

    1 # Docker Setup with Colima
    2
    3 ## Background & Motivation
    4 The user is working on a 2017 MacBook Pro running macOS
      Ventura, which no longer supports the latest versions of
      Docker Desktop. To run the project locally in a
      containerized and secure environment without draining
      system resources, we need a lightweight alternative. The
      user has selected **Colima** as the preferred open-source
      container runtime.
    5
    6 ## Scope & Impact
    7 - **Scope**: Install Colima and the Docker CLI, then
      create `Dockerfile`s for both the Next.js frontend and
      the Python backend, along with a `docker-compose.yml` to
      orchestrate them.
    8 - **Impact**: Provides an isolated, reproducible, and
      secure local development environment without relying on
      Docker Desktop. Modifies the repository by adding Docker
      configuration files.
    9
   10 ## Proposed Solution
   11 1. **Container Runtime**: Use Colima as the Docker
      engine.
   12 2. **Backend**: Create a Dockerfile for the Python
      backend running as a secure, non-root user.
   13 3. **Frontend**: Create a Dockerfile for the Next.js
      frontend running as a secure, non-root user.
   14 4. **Orchestration**: Create a `docker-compose.yml` to
      link the services together.
   15
   16 ## Alternatives Considered
   17 - **OrbStack**: Extremely fast and lightweight, but
      requires a paid license for commercial use.
   18 - **Podman Desktop**: Daemonless and secure, but can
      require minor tweaks for `docker-compose` compatibility.
   19 - **Rancher Desktop**: Full-featured GUI but heavier on
      system resources.
   20
   21 ## Phased Implementation Plan
   22
   23 ### Phase 1: Environment Setup
   24 1. Instruct the user to install Colima and the Docker CLI
      using Homebrew:
     brew install docker docker-compose colima

   1 2. Start Colima with appropriate limits for a 2017 MacBook
     Pro (e.g., 2 CPUs, 4GB RAM):
     colima start --cpu 2 --memory 4

    1
    2 ### Phase 2: Dockerize Backend
    3 1. Create `backend/Dockerfile`.
    4 2. Base image: `python:3.11-slim` (or appropriate
      version).
    5 3. Create a non-root user for security.
    6 4. Copy `requirements.txt` and install dependencies.
    7 5. Copy source code.
    8 6. Expose the required port and set the command to run
      `main.py` (e.g., via uvicorn/fastapi, depending on
      contents).
    9
   10 ### Phase 3: Dockerize Frontend
   11 1. Create `frontend/Dockerfile`.
   12 2. Base image: `node:20-alpine`.
   13 3. Create a non-root user.
   14 4. Copy `package.json`, install dependencies, and copy
      source code.
   15 5. Expose port 3000 and run the Next.js development
      server or build for production.
   16
   17 ### Phase 4: Orchestration
   18 1. Create `docker-compose.yml` in the project root.
   19 2. Define `backend` and `frontend` services with volume
      mounts for local development.
   20
   21 ## Verification
   22 - Run `docker-compose up --build`.
   23 - Verify the frontend is accessible at
      `http://localhost:3000`.
   24 - Verify the backend API is accessible.
   25 - Ensure containers are running under the non-root user
      for security.
   26
   27 ## Migration & Rollback
   28 - **Rollback**: Remove `Dockerfile`s and
      `docker-compose.yml`. Stop Colima (`colima stop`).