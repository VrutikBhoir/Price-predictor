from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator, root_validator, EmailStr
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from datetime import date, datetime, timedelta
import pandas as pd
import json
from pathlib import Path
import hashlib
import secrets
import asyncio
import math
import time
import logging

try:
    import numpy as np
    _NUMPY_TYPES = (np.floating, np.integer, np.bool_)
except Exception:
    np = None
    _NUMPY_TYPES = ()

from .services.data_processor import DataProcessor
from .services.technical_indicators import TechnicalIndicators
from .services.model_trainer import ModelTrainer
from .services.advisor import Advisor
from app.services.ml.price_predictor import predict_price as ml_predict_price
from app.services.ml.event_impact_predict import predict_event
from app.services.ml.risk_predictor import predict_risk, predict_action, predict_full
from app.services.ml.narrative_engine import generate_narrative
from app.db import supabase
from .config import get_settings
from .utils import RateLimiter, cache_manager


# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s", "module": "%(name)s"}'
)
logger = logging.getLogger(__name__)


# --- Simple file-based auth store (demo) ---
AUTH_FILE = Path(__file__).parent / "users.json"
AUTH_FILE.touch(exist_ok=True)


def _load_users() -> Dict[str, Any]:
    try:
        content = AUTH_FILE.read_text().strip()
        if not content:
            return {"users": []}
        return json.loads(content)
    except Exception:
        return {"users": []}


def _save_users(data: Dict[str, Any]):
    AUTH_FILE.write_text(json.dumps(data, indent=2))


def _clean_json(value: Any) -> Any:
    """Recursively convert NaN/Inf values to None and unwrap numpy scalars."""
    if isinstance(value, dict):
        return {k: _clean_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_clean_json(v) for v in value]
    if np is not None and isinstance(value, _NUMPY_TYPES):
        value = value.item()
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
    return value


def _hash_password(pw: str, salt: Optional[str] = None) -> Dict[str, str]:
    salt = salt or secrets.token_hex(8)
    h = hashlib.sha256((salt + pw).encode()).hexdigest()
    return {"salt": salt, "hash": h}


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize resources
    logger.info("Starting up Stock Predictor API")
    cache_manager.initialize()
    yield
    # Shutdown: Cleanup resources
    logger.info("Shutting down Stock Predictor API")
    cache_manager.clear()


# Initialize FastAPI app
app = FastAPI(
    title="Stock Predictor API",
    description="Comprehensive stock analysis and prediction API with ML models",
    version="2.0.0",
    docs_url="/api/docs" if get_settings().environment != "production" else None,
    redoc_url="/api/redoc" if get_settings().environment != "production" else None,
    lifespan=lifespan
)


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=False,
    allow_methods=['*'],
    allow_headers=['*'],
    expose_headers=["X-RateLimit-Remaining", "X-RateLimit-Reset", "X-Process-Time"]
)


# Add GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    logger.info(f"Request: {request.method} {request.url.path} - Time: {process_time:.3f}s")
    return response


# Initialize services
data_processor = DataProcessor()
technicals = TechnicalIndicators()
trainer = ModelTrainer()
advisor = Advisor()


# Dependency: Rate limiters
rate_limiter_standard = RateLimiter(requests_limit=30, time_window=60)
rate_limiter_ml = RateLimiter(requests_limit=10, time_window=60)
rate_limiter_batch = RateLimiter(requests_limit=5, time_window=60)


# ==================== Pydantic Models ====================

class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class FetchDataRequest(BaseModel):
    ticker: str = Field(..., description="Stock ticker symbol", min_length=1)
    start_date: str = Field(..., description="Start date in YYYY-MM-DD format", min_length=1)
    end_date: str = Field(..., description="End date in YYYY-MM-DD format", min_length=1)
    
    @validator('ticker')
    def validate_ticker(cls, v):
        if not v or not v.strip():
            raise ValueError('Ticker cannot be empty')
        return v.strip().upper()
    
    @validator('start_date', 'end_date')
    def validate_date_format(cls, v):
        if not v:
            raise ValueError('Date cannot be empty')
        try:
            datetime.strptime(v, "%Y-%m-%d")
            return v
        except ValueError:
            raise ValueError(f'Invalid date format. Expected YYYY-MM-DD, got: {v}')
    
    @root_validator(skip_on_failure=True)
    def validate_date_logic(cls, values):
        start_date = values.get('start_date')
        end_date = values.get('end_date')
        
        if start_date and end_date:
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d").date()
                end = datetime.strptime(end_date, "%Y-%m-%d").date()
                
                if start >= end:
                    raise ValueError('Start date must be before end date')
                
                if start > datetime.now().date():
                    raise ValueError('Start date cannot be in the future')
                    
            except ValueError as e:
                raise ValueError(str(e))
        
        return values


class Ohlcv(BaseModel):
    Date: str
    Open: Optional[float] = None
    High: Optional[float] = None
    Low: Optional[float] = None
    Close: Optional[float] = None
    Volume: Optional[float] = None


class IndicatorsRequest(BaseModel):
    data: List[Ohlcv]
    include_sma: bool = True
    include_ema: bool = True
    include_rsi: bool = True
    include_macd: bool = True
    include_bollinger: bool = True


class TrainRequest(BaseModel):
    close: List[float]
    dates: List[str]
    model_type: str = "ARIMA"
    forecast_days: int = 10

    @validator('forecast_days')
    def validate_forecast_days(cls, v):
        if v is None:
            return 10
        try:
            v = int(v)
        except Exception:
            raise ValueError('forecast_days must be an integer')
        if v < 1 or v > 60:
            raise ValueError('forecast_days must be between 1 and 60')
        return v


class AdviceRequest(BaseModel):
    data: List[Ohlcv]
    model_type: str = "ARIMA"
    forecast_days: int = 10
    ticker: Optional[str] = None

    @validator('forecast_days')
    def validate_forecast_days(cls, v):
        if v is None:
            return 10
        try:
            v = int(v)
        except Exception:
            raise ValueError('forecast_days must be an integer')
        if v < 1 or v > 60:
            raise ValueError('forecast_days must be between 1 and 60')
        return v

    @validator('ticker')
    def normalize_ticker(cls, v):
        if v is None:
            return v
        v = v.strip()
        return v.upper() if v else None


class ScreenerFilters(BaseModel):
    rsi_below: Optional[float] = Field(None, ge=0, le=100)
    rsi_above: Optional[float] = Field(None, ge=0, le=100)
    price_change_pct_gt: Optional[float] = None
    price_change_pct_lt: Optional[float] = None
    lookback_days: int = Field(60, ge=5, le=365)
    macd_cross_bullish: bool = False
    macd_cross_bearish: bool = False


class ScreenerRequest(BaseModel):
    tickers: List[str] = Field(..., min_items=1)
    filters: ScreenerFilters = Field(default_factory=ScreenerFilters)


class PredictionResponse(BaseModel):
    symbol: str
    live_price: float
    live_time: str
    predicted_t1: float
    predicted_t10: float
    trend: dict
    volatility: float
    confidence_score: float
    forecast: list
    historical: list
    indicators: dict = {}
    accuracy_metrics: Optional[dict] = None


class ErrorResponse(BaseModel):
    error: str
    detail: str
    timestamp: str


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    services: dict


# ==================== Exception Handlers ====================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTP error: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "API Error",
            "detail": exc.detail,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        message = error["msg"]
        errors.append(f"{field}: {message}")
    
    error_message = "Validation error: " + "; ".join(errors)
    logger.error(f"Validation error: {error_message}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "detail": error_message,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": "An unexpected error occurred",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
        }
    )


# ==================== Core Endpoints ====================

@app.get("/", response_model=dict)
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Stock Predictor API",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "docs": "/api/docs",
            "auth": {
                "signup": "/signup",
                "login": "/login"
            },
            "data": {
                "fetch": "/fetch-data",
                "live_price": "/live-price/{ticker}",
                "indicators": "/indicators"
            },
            "analysis": {
                "train": "/train",
                "advice": "/advice",
                "screener": "/screener"
            },
            "ml_predictions": {
                "enhanced_predict": "/predict/{symbol}",
                "summary": "/summary/{symbol}",
                "compare": "/compare/{symbol}",
                "batch": "/batch-predict"
            }
        }
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Enhanced health check endpoint"""
    services_status = {
        "cache": "healthy" if cache_manager else "unavailable",
        "database": "healthy",  # Add actual DB health check
        "ml_models": "healthy"
    }
    
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "services": services_status
    }


@app.get("/test-db")
def test_db():
    """Test database connection"""
    try:
        response = supabase.table("users").select("*").limit(2).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        logger.error(f"Database test failed: {str(e)}")
        return {"status": "error", "detail": str(e)}


# ==================== Auth Endpoints ====================

@app.post("/signup")
def signup(req: SignupRequest) -> Dict[str, Any]:
    """User registration endpoint"""
    try:
        db = _load_users()
        users = db.get("users", [])
        if any(u.get("email").lower() == req.email.lower() for u in users):
            raise HTTPException(status_code=400, detail="Email already registered")
        pw = _hash_password(req.password)
        user = {"name": req.name.strip(), "email": req.email.lower(), "password": pw}
        users.append(user)
        db["users"] = users
        _save_users(db)
        logger.info(f"New user registered: {req.email}")
        return {"ok": True, "user": {"name": user["name"], "email": user["email"]}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail="Registration failed")


@app.post("/login")
def login(req: LoginRequest) -> Dict[str, Any]:
    """User login endpoint"""
    try:
        db = _load_users()
        users = db.get("users", [])
        user = next((u for u in users if u.get("email").lower() == req.email.lower()), None)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        salt = user.get("password", {}).get("salt")
        expected = user.get("password", {}).get("hash")
        if not salt or not expected:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        check = _hash_password(req.password, salt)
        if check["hash"] != expected:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        logger.info(f"User logged in: {req.email}")
        return {"ok": True, "user": {"name": user.get("name"), "email": user.get("email")}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")


# ==================== Data Endpoints ====================

@app.get("/live-price/{ticker}", dependencies=[Depends(rate_limiter_standard)])
def get_live_price(ticker: str) -> Dict[str, Any]:
    """Get real-time price for a ticker with caching"""
    try:
        cache_key = f"live_price:{ticker.upper()}"
        cached = cache_manager.get(cache_key)
        if cached:
            return cached
        
        price = data_processor.get_live_price(ticker)
        if price is not None:
            result = {
                "ticker": ticker.upper(),
                "price": float(price),
                "timestamp": datetime.now().isoformat()
            }
            cache_manager.set(cache_key, result, ttl=30)  # Cache for 30 seconds
            return result
        else:
            raise HTTPException(status_code=404, detail=f"Could not fetch live price for {ticker}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching live price for {ticker}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch live price")


@app.post("/fetch-data", dependencies=[Depends(rate_limiter_standard)])
def fetch_data(req: FetchDataRequest) -> Dict[str, Any]:
    """Fetch historical stock data with validation"""
    try:
        logger.info(f"Fetching data: {req.ticker} from {req.start_date} to {req.end_date}")
        
        start_date = datetime.strptime(req.start_date, "%Y-%m-%d").date()
        end_date = datetime.strptime(req.end_date, "%Y-%m-%d").date()
        
        df = data_processor.fetch_stock_data(req.ticker, start_date, end_date)
        if df is None or df.empty:
            return {"data": [], "message": "No data available for the specified range"}
        
        df = df.reset_index()
        df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")
        
        result_data = df[["Date", "Open", "High", "Low", "Close", "Volume"]].to_dict(orient="records")
        
        for record in result_data:
            for key, value in record.items():
                if pd.isna(value):
                    record[key] = None
        
        logger.info(f"Successfully fetched {len(result_data)} records for {req.ticker}")
        return {"data": result_data, "count": len(result_data)}
    except Exception as e:
        logger.error(f"Error in fetch-data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")


@app.post("/indicators", dependencies=[Depends(rate_limiter_standard)])
def calculate_indicators(req: IndicatorsRequest) -> JSONResponse:
    """Calculate technical indicators for stock data"""
    try:
        if not req.data:
            return JSONResponse(_clean_json({"indicators": {}}))
        
        df = pd.DataFrame([d.dict() for d in req.data])
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.set_index("Date").sort_index()
        df = df.fillna(method='ffill').fillna(method='bfill')
        
        if df["Close"].isnull().all():
            return JSONResponse(_clean_json({"indicators": {}, "error": "No valid close price data"}))

        indicators: Dict[str, Any] = {}
        if req.include_sma:
            indicators["SMA"] = technicals.calculate_sma(df["Close"]).tolist()
        if req.include_ema:
            indicators["EMA"] = technicals.calculate_ema(df["Close"]).tolist()
        if req.include_rsi:
            indicators["RSI"] = technicals.calculate_rsi(df["Close"]).tolist()
        if req.include_macd:
            macd = technicals.calculate_macd(df["Close"])
            indicators["MACD"] = macd["MACD"].tolist()
            indicators["MACD_Signal"] = macd["MACD_Signal"].tolist()
            indicators["MACD_Histogram"] = macd["MACD_Histogram"].tolist()
        if req.include_bollinger:
            bb = technicals.calculate_bollinger_bands(df["Close"])
            indicators["BB_Upper"] = bb["BB_Upper"].tolist()
            indicators["BB_Lower"] = bb["BB_Lower"].tolist()

        response = {"indicators": indicators}
        return JSONResponse(_clean_json(response))
    except Exception as e:
        logger.error(f"Error in indicators endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate indicators: {str(e)}")


# ==================== Analysis Endpoints ====================

@app.post("/train", dependencies=[Depends(rate_limiter_ml)])
def train(req: TrainRequest) -> Dict[str, Any]:
    """Train ARIMA/SARIMA model and generate forecast"""
    try:
        series = pd.Series(req.close, index=pd.to_datetime(req.dates)).sort_index()
        series = pd.to_numeric(series, errors='coerce').dropna()
        
        if len(series) < 20:
            raise HTTPException(
                status_code=400,
                detail="Not enough valid data to train. Please select a wider date range (minimum 20 data points)."
            )

        if req.model_type == "ARIMA":
            predictions, metrics = trainer.train_arima(series, req.forecast_days)
        else:
            predictions, metrics = trainer.train_sarima(series, req.forecast_days)

        if predictions is None:
            raise HTTPException(status_code=500, detail="Model training failed")

        def to_points(s):
            out = []
            if s is None:
                return out
            try:
                for d, v in s.items():
                    if pd.isna(v):
                        continue
                    try:
                        dt = pd.Timestamp(d)
                    except Exception:
                        continue
                    out.append({"date": dt.strftime("%Y-%m-%d"), "value": float(v)})
            except Exception:
                pass
            return out

        forecast = to_points(predictions.get("forecast"))
        lower_ci = to_points(predictions.get("lower_ci"))
        upper_ci = to_points(predictions.get("upper_ci"))

        if not forecast:
            try:
                last_val = float(series.iloc[-1]) if len(series) else None
                last_date = series.index[-1] if len(series) else pd.Timestamp.now()
                helper = ModelTrainer()
                future_idx = helper._create_forecast_dates(last_date, req.forecast_days)
                if last_val is not None:
                    forecast = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in future_idx]
                    lower_ci = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in future_idx]
                    upper_ci = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in future_idx]
            except Exception:
                pass

        safe_metrics: Dict[str, Optional[float]] = {}
        if metrics:
            for k, v in metrics.items():
                safe_metrics[k] = float(v) if v is not None else None

        response = {
            "predictions": {
                "forecast": forecast,
                "lower_ci": lower_ci,
                "upper_ci": upper_ci
            },
            "metrics": safe_metrics,
            "model_type": req.model_type
        }
        logger.info(f"Model trained successfully: {req.model_type}, {len(forecast)} predictions")
        return _clean_json(response)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in train endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@app.post("/advice", dependencies=[Depends(rate_limiter_ml)])
def advice(req: AdviceRequest) -> Dict[str, Any]:
    """Get investment advice based on technical analysis and forecasting"""
    try:
        if not req.data:
            raise HTTPException(status_code=400, detail="No data provided")
        
        df = pd.DataFrame([d.dict() for d in req.data])
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.set_index("Date").sort_index()
        df = df.sort_index().ffill().bfill()
        
        base_ticker = req.ticker if hasattr(req, 'ticker') else None
        output = advisor.suggest(df, forecast_days=req.forecast_days, model_type=req.model_type, ticker=base_ticker)
        
        logger.info(f"Generated advice for ticker: {base_ticker or 'unknown'}")
        return _clean_json(output)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in advice endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate advice: {str(e)}")


@app.post("/screener", dependencies=[Depends(rate_limiter_batch)])
def screener(req: ScreenerRequest) -> Dict[str, Any]:
    """Stock screener with technical filters"""
    try:
        results: List[Dict[str, Any]] = []
        
        for raw in req.tickers:
            t = (raw or "").strip().upper()
            if not t:
                continue
            
            try:
                end = datetime.now().date()
                start = end - timedelta(days=max(90, req.filters.lookback_days + 30))
                df = data_processor.fetch_stock_data(t, start, end)
                
                if df is None or df.empty:
                    results.append({"ticker": t, "error": "no_data", "match": False})
                    continue
                
                data = df.copy()
                if "Close" not in data.columns:
                    results.append({"ticker": t, "error": "missing_close", "match": False})
                    continue
                
                close = pd.to_numeric(data["Close"], errors="coerce").dropna()
                if close.empty:
                    results.append({"ticker": t, "error": "invalid_close", "match": False})
                    continue

                rsi = technicals.calculate_rsi(close)
                macd = technicals.calculate_macd(close)
                macd_line = macd.get("MACD")
                macd_signal = macd.get("MACD_Signal")

                lb = max(5, min(req.filters.lookback_days, len(close)))
                recent = close.iloc[-lb:]
                price_change_pct = float(((recent.iloc[-1] - recent.iloc[0]) / recent.iloc[0]) * 100) if len(recent) >= 2 else None

                macd_cross_bullish = False
                macd_cross_bearish = False
                last_bull_days_ago = None
                last_bear_days_ago = None
                
                try:
                    ml = macd_line.dropna()
                    ms = macd_signal.dropna()
                    if len(ml) >= 2 and len(ms) >= 2:
                        bull_series = (ml.shift(1) <= ms.shift(1)) & (ml > ms)
                        bear_series = (ml.shift(1) >= ms.shift(1)) & (ml < ms)
                        last_idx = close.index[-1]
                        last_bull_idx = bull_series[bull_series].index.max() if bull_series.any() else None
                        last_bear_idx = bear_series[bear_series].index.max() if bear_series.any() else None
                        if isinstance(last_idx, pd.Timestamp):
                            if isinstance(last_bull_idx, pd.Timestamp):
                                last_bull_days_ago = int((last_idx - last_bull_idx).days)
                            if isinstance(last_bear_idx, pd.Timestamp):
                                last_bear_days_ago = int((last_idx - last_bear_idx).days)
                        window_days = int(req.filters.lookback_days or 60)
                        if last_bull_days_ago is not None and last_bull_days_ago <= window_days:
                            macd_cross_bullish = True
                        if last_bear_days_ago is not None and last_bear_days_ago <= window_days:
                            macd_cross_bearish = True
                except Exception:
                    pass

                latest = {
                    "price": float(close.iloc[-1]) if len(close) else None,
                    "rsi": float(rsi.iloc[-1]) if len(rsi.dropna()) else None,
                    "price_change_pct": float(price_change_pct) if price_change_pct is not None else None,
                    "macd_cross_bullish": bool(macd_cross_bullish),
                    "macd_cross_bearish": bool(macd_cross_bearish),
                    "last_bull_cross_days_ago": int(last_bull_days_ago) if last_bull_days_ago is not None else None,
                    "last_bear_cross_days_ago": int(last_bear_days_ago) if last_bear_days_ago is not None else None,
                }

                f = req.filters
                matches = True
                if f.rsi_below is not None and (latest["rsi"] is None or latest["rsi"] >= f.rsi_below):
                    matches = False
                if f.rsi_above is not None and (latest["rsi"] is None or latest["rsi"] <= f.rsi_above):
                    matches = False
                if f.price_change_pct_gt is not None and (latest["price_change_pct"] is None or latest["price_change_pct"] <= f.price_change_pct_gt):
                    matches = False
                if f.price_change_pct_lt is not None and (latest["price_change_pct"] is None or latest["price_change_pct"] >= f.price_change_pct_lt):
                    matches = False
                if f.macd_cross_bullish and not latest["macd_cross_bullish"]:
                    matches = False
                if f.macd_cross_bearish and not latest["macd_cross_bearish"]:
                    matches = False

                results.append({"ticker": t, "metrics": latest, "match": bool(matches)})
            except Exception as e:
                logger.error(f"Error screening {t}: {str(e)}")
                results.append({"ticker": t, "error": str(e), "match": False})

        matched_count = sum(1 for r in results if r.get("match"))
        logger.info(f"Screener completed: {matched_count}/{len(results)} matches")
        return {"results": results, "total": len(results), "matched": matched_count}
    except Exception as e:
        logger.error(f"Screener error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Screener failed: {str(e)}")


# ==================== Enhanced ML Prediction Endpoints (from previous code) ====================

@app.get("/predict/{symbol}", response_model=PredictionResponse, dependencies=[Depends(rate_limiter_ml)])
async def enhanced_predict(
    symbol: str,
    steps: int = Query(default=10, ge=1, le=30, description="Number of days to forecast"),
    confidence_level: float = Query(default=0.95, ge=0.80, le=0.99, description="Confidence level")
):
    """Enhanced stock price prediction with confidence intervals and metrics"""
    try:
        cache_key = f"enhanced_predict:{symbol}:{steps}:{confidence_level}"
        cached_result = cache_manager.get(cache_key)
        
        if cached_result:
            logger.info(f"Cache hit for enhanced prediction: {symbol}")
            return cached_result
        
        logger.info(f"Enhanced prediction for {symbol} with {steps} steps")
        
        # Import the enhanced predict_price from your updated price_predictor.py
        from app.services.ml.price_predictor import predict_price
        result = predict_price(symbol, steps=steps, confidence_level=confidence_level)
        
        cache_manager.set(cache_key, result, ttl=300)
        return result
    except ValueError as e:
        logger.error(f"Prediction error for {symbol}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error predicting {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate enhanced prediction")


@app.get("/summary/{symbol}", dependencies=[Depends(rate_limiter_standard)])
async def get_prediction_summary(symbol: str):
    """Quick prediction summary for dashboard"""
    try:
        cache_key = f"summary:{symbol}"
        cached_result = cache_manager.get(cache_key)
        
        if cached_result:
            return cached_result
        
        logger.info(f"Generating summary for {symbol}")
        
        from app.services.ml.price_predictor import get_prediction_summary
        result = get_prediction_summary(symbol)
        
        cache_manager.set(cache_key, result, ttl=180)
        return result
    except Exception as e:
        logger.error(f"Error generating summary for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate summary")


@app.get("/compare/{symbol}", dependencies=[Depends(rate_limiter_ml)])
async def compare_models(
    symbol: str,
    steps: int = Query(default=10, ge=1, le=30)
):
    """Compare ARIMA vs SARIMAX predictions"""
    try:
        cache_key = f"compare:{symbol}:{steps}"
        cached_result = cache_manager.get(cache_key)
        
        if cached_result:
            return cached_result
        
        logger.info(f"Comparing models for {symbol}")
        
        from app.services.ml.price_predictor import compare_models
        result = compare_models(symbol, steps=steps)
        
        cache_manager.set(cache_key, result, ttl=300)
        return result
    except Exception as e:
        logger.error(f"Error comparing models for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to compare models")


@app.post("/batch-predict", dependencies=[Depends(rate_limiter_batch)])
async def batch_predict(
    symbols: List[str] = Query(..., max_length=5, description="List of stock symbols (max 5)"),
    steps: int = Query(default=10, ge=1, le=30)
):
    """Batch prediction for multiple stocks"""
    try:
        logger.info(f"Batch predicting for {len(symbols)} symbols")
        
        from app.services.ml.price_predictor import get_prediction_summary
        results = []
        
        for symbol in symbols:
            try:
                prediction = get_prediction_summary(symbol)
                results.append({
                    "symbol": symbol,
                    "status": "success",
                    "data": prediction
                })
            except Exception as e:
                logger.error(f"Error in batch for {symbol}: {str(e)}")
                results.append({
                    "symbol": symbol,
                    "status": "error",
                    "error": str(e)
                })
        
        success_count = sum(1 for r in results if r.get("status") == "success")
        return {
            "results": results,
            "total": len(symbols),
            "successful": success_count,
            "failed": len(symbols) - success_count
        }
    except Exception as e:
        logger.error(f"Batch prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Batch prediction failed")


# ==================== Additional ML Endpoints ====================

@app.post("/predict/price", dependencies=[Depends(rate_limiter_ml)])
def ml_price_prediction(payload: dict):
    """Legacy ML price prediction endpoint"""
    try:
        return {"prediction": ml_predict_price(payload["values"])}
    except Exception as e:
        logger.error(f"ML price prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Price prediction failed")


@app.post("/predict/event", dependencies=[Depends(rate_limiter_ml)])
def event_prediction(payload: dict):
    """Event impact prediction"""
    try:
        return {"impact": predict_event(payload["values"])}
    except Exception as e:
        logger.error(f"Event prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Event prediction failed")


@app.post("/predict/risk", dependencies=[Depends(rate_limiter_ml)])
def risk_prediction(payload: dict):
    """Risk assessment prediction"""
    try:
        return {"risk": predict_risk(payload["values"])}
    except Exception as e:
        logger.error(f"Risk prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Risk prediction failed")


@app.post("/predict/full", dependencies=[Depends(rate_limiter_ml)])
def full_prediction(payload: dict):
    """Full prediction with all models"""
    try:
        return {"prediction": predict_full(payload["values"])}
    except Exception as e:
        logger.error(f"Full prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Full prediction failed")


@app.post("/narrative", dependencies=[Depends(rate_limiter_standard)])
def generate_narrative_endpoint(payload: dict):
    """Generate narrative from data"""
    try:
        return generate_narrative(payload["text"])
    except Exception as e:
        logger.error(f"Narrative generation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Narrative generation failed")


# ==================== WebSocket Endpoints ====================

@app.websocket("/ws/live/{ticker}")
async def ws_live_price(websocket: WebSocket, ticker: str):
    """WebSocket for real-time price updates"""
    await websocket.accept()
    logger.info(f"WebSocket connected: {ticker}")
    
    try:
        while True:
            price = data_processor.get_live_price(ticker)
            payload = {
                "ticker": ticker.upper(),
                "price": float(price) if price else None,
                "timestamp": datetime.now().isoformat()
            }
            await websocket.send_json(payload)
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {ticker}")
    except Exception as e:
        logger.error(f"WebSocket error for {ticker}: {str(e)}")
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass


# ==================== Cache Management ====================

@app.delete("/cache/{symbol}")
async def clear_cache_for_symbol(symbol: str):
    """Clear cache for specific symbol (admin endpoint)"""
    try:
        cache_manager.delete_pattern(f"*:{symbol.upper()}:*")
        logger.info(f"Cache cleared for {symbol}")
        return {"message": f"Cache cleared for {symbol.upper()}", "status": "success"}
    except Exception as e:
        logger.error(f"Cache clear error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to clear cache")


@app.delete("/cache")
async def clear_all_cache():
    """Clear all cache (admin endpoint)"""
    try:
        cache_manager.clear()
        logger.info("All cache cleared")
        return {"message": "All cache cleared", "status": "success"}
    except Exception as e:
        logger.error(f"Cache clear error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to clear cache")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
