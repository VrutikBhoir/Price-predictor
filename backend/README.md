# Backend (FastAPI)

## Setup

1. Create and activate a virtual environment

```bash
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell
```

2. Install dependencies

```bash
pip install -r requirements.txt
```

3. Run the server

```bash
uvicorn backend.app.main:app --reload --port 8000
```

4. Test health endpoint

- Open `http://localhost:8000/health`

## Endpoints
- POST `/fetch-data`: { ticker, start_date, end_date } → OHLCV records
- POST `/indicators`: { data: OHLCV[], flags } → indicators per row
- POST `/train`: { close[], dates[], model_type, forecast_days } → predictions + metrics 