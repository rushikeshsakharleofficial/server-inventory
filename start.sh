#!/usr/bin/env bash
set -e

echo "==> Server Inventory Startup"
echo ""
echo "  Requires PostgreSQL running at localhost:5432"
echo "  Set DATABASE_URL, e.g.: export DATABASE_URL=postgresql://user:pass@host:port/db"
echo ""

# Backend
echo "==> Backend: installing deps..."
cd backend
pip install -r requirements.txt -q

if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created backend/.env from .env.example"
fi

echo "==> Backend: starting FastAPI on http://localhost:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Frontend
echo "==> Frontend: installing deps..."
cd frontend
npm install --silent
echo "==> Frontend: starting Vite on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "  Backend  : http://localhost:8000"
echo "  Frontend : http://localhost:5173"
echo "  API Docs : http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
