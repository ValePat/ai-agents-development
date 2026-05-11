# Admin & Development Guide (macOS/Colima)

This document provides a comprehensive list of commands and workflows for managing the AI Agents project in a containerized macOS environment.

---

## 🚀 Environment Control

### Startup & Shutdown
| Task | Command |
| :--- | :--- |
| **Start Engine** | `colima start --cpu 2 --memory 4` |
| **Start App** | `docker-compose up -d` |
| **Stop App** | `docker-compose down` |
| **Stop Engine** | `colima stop` |
| **Hard Reset** | `docker rm -f $(docker ps -aq) && docker-compose up --build -d` |

### Status Monitoring
| Task | Command |
| :--- | :--- |
| **Engine Status** | `colima status` |
| **Container Status** | `docker-compose ps` |
| **Backend Logs** | `docker-compose logs -f backend` |
| **Frontend Logs** | `docker-compose logs -f frontend` |
| **Resource Usage** | `docker stats` |

---

## 🛠 Development Workflows

### Rebuilding Services
If you modify `requirements.txt`, `package.json`, or a `Dockerfile`:
```bash
# Rebuild and restart a specific service
docker-compose up -d --build backend
docker-compose up -d --build frontend
```

### Accessing Containers
To run commands *inside* the running containers (e.g., for debugging):
```bash
# Backend Shell
docker-compose exec backend /bin/bash

# Frontend Shell
docker-compose exec frontend /bin/sh
```

### Database/File Management
The `sandbox` directory is synced between your host and the backend container:
- **Local Path**: `./backend/sandbox/`
- **Container Path**: `/app/sandbox/`

---

## 🧪 Verification & Health
Run these commands to verify the stack is healthy:

```bash
# 1. Check if ports are listening
lsof -ti:8000,3000

# 2. Test Backend API (should return 200)
curl -i http://localhost:8000/

# 3. Test Frontend (should return 200)
curl -i http://localhost:3000/
```

---

## 🧹 Maintenance & Cleanup

| Task | Command |
| :--- | :--- |
| **Clean Volumes** | `docker system prune --volumes` |
| **Remove All Images**| `docker rmi $(docker images -q)` |
| **Update Dependencies**| `docker-compose build --no-cache` |

---

## 💡 Troubleshooting (macOS Specific)

### "Permission Denied" in Logs
If the frontend or backend shows permission errors writing to cache:
- Ensure `docker-compose.yml` has anonymous volumes:
  ```yaml
  volumes:
    - /app/node_modules
    - /app/.next
  ```

### "Port 8000 already in use"
If a local process is blocking the port:
```bash
lsof -ti:8000 | xargs kill -9
```

### Colima Won't Start
If Colima hangs or fails to initialize:
```bash
colima delete  # WARNING: Deletes all images/containers in Colima
colima start --cpu 2 --memory 4 --vm-type qemu
```

---

## 🔒 Security Notes
- **Non-Root**: Both containers run as `appuser`.
- **API Keys**: Managed via `backend/.env`. Never commit this file.
- **Sandboxing**: The AI agent is restricted to `/app/sandbox/` via the MCP server configuration.
