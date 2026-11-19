# Alpha_Insight

Institutional financial analytics, technical research, and portfolio tracking platform.

## Quick Start (Localhost)

To launch the full local stack (FastAPI Backend + React/Vite Frontend):

1. Double-click `start_alpha.bat` in the project root, or execute from terminal:
   ```cmd
   start_alpha.bat
   ```
2. The script will:
   - Verify `uv` and `npm` prerequisites.
   - Start the FastAPI backend server on `http://127.0.0.1:8080` (with `--reload`).
   - Start the Vite frontend workstation on `http://127.0.0.1:5173`.
   - Open your default browser to `http://127.0.0.1:5173/`.

### Stopping the Services

To terminate both backend and frontend server processes:
```cmd
stop_alpha.bat
```
Alternatively, close each server's command prompt window.

---

## Service Endpoints

- **Frontend Workstation**: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)
- **Backend API & Swagger UI**: [http://127.0.0.1:8080/docs](http://127.0.0.1:8080/docs)
- **OpenAPI Schema**: [http://127.0.0.1:8080/openapi.json](http://127.0.0.1:8080/openapi.json)

---

## Manual Execution (Alternative)

### 1. Backend (FastAPI / Uvicorn)
```cmd
uv run uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload
```

### 2. Frontend (Vite)
```cmd
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
