# Claude Code Entry Point
> Thin wrapper. Never edit this file. All global rules in ~/.agent/CONTEXT.md

@~/.agent/CONTEXT.md
@~/.agent/STATUS.md
@.agent/STATUS.md

## Current VPS Notes

- VPS host: `142.44.210.103`
- VPS repo path: `~/server-inventory`
- Current app ports:
  - Frontend: `http://142.44.210.103:3001`
  - Backend API: `http://142.44.210.103:8001`
- Container runtime on VPS: `podman-compose`

## Current Login Flow

- This deployment uses first-run bootstrap at `/setup`
- `/setup` is available when no `admin` user exists in the database
- The first admin password is created manually on the setup page
- There is no documented default VPS admin password in this repo

## VPS Env Notes

- `ALLOWED_ORIGINS` should include the public frontend origin, currently `http://142.44.210.103:3001`
- `VITE_API_URL` can be left empty so the frontend derives the backend host from the current page host
