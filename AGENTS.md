# Repository Guidelines

This repository hosts a FastAPI-based, read-only database query tool with a static HTML UI. Use this guide to navigate the codebase and contribute consistently.

## Project Structure & Module Organization
- `main.py` — FastAPI app, DB connectors, read-only SQL validation, static routes.
- `index.html`, `login.html`, `login_auto.html`, `query.html` — frontend pages.
- `rsformat.js` — zero-dependency result formatting helper.
- `requirements.txt` — Python dependencies.
- `Dockerfile`, `Dockerfile_mac`, `Dockerfile_x64`, `docker-compose.yml` — containerization.
- `bk/` — backups/samples; not required at runtime.

## Build, Test, and Development Commands
- Local dev
  - Create env and install: `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
  - Run API: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- Docker
  - Build & run: `docker-compose up --build -d`
  - Logs: `docker-compose logs -f`
  - Stop: `docker-compose down`
- Note: For Oracle thick mode, set `ORACLE_CLIENT_LIB` to the client library path.

## Coding Style & Naming Conventions
- Python (3.10+), PEP 8, 4-space indentation.
- `snake_case` for functions/variables; `PascalCase` for Pydantic models.
- HTTP paths are lowercase/hyphenated (e.g., `/test-connection`, `/execute-query`).
- Keep modules small; add docstrings for public functions and endpoints.

## Testing Guidelines
- No test suite yet. If adding tests, use `pytest` + `httpx`.
- Place tests in `tests/`; files named `test_*.py`.
- Run locally: `pip install pytest httpx && pytest -q`.
- Aim for coverage of API endpoints and SQL validation logic.

## Commit & Pull Request Guidelines
- Commits: concise, present tense; English or Chinese OK. Optionally prefix scope (e.g., `api:`, `ui:`).
- One logical change per commit; reference issues (e.g., `#123`).
- PRs: include description, rationale, steps to verify, screenshots for UI, and notes on tests/impact.

## Security & Configuration Tips
- Never commit credentials; use env vars or `docker-compose` for secrets.
- API enforces read-only SQL. Do not relax validation without discussion.
- Default port is `8000`. Ensure required DB drivers (Oracle, MSSQL, Postgres) are available.

## Agent-Specific Instructions
- Keep changes minimal and focused; follow the structure above.
- Do not modify Dockerfiles unless required by the task.
- Prefer local `uvicorn` runs for quick checks; avoid adding services.

