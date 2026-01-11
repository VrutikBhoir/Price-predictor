import os
import pickle
import pandas as pd
import numpy as np
from datetime import timedelta
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from sklearn.metrics import mean_squared_error, mean_absolute_error, mean_absolute_percentage_error

from app.services.alpha_vintage import get_historical, get_live_price


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "all_forecasts.pkl")


def predict_price(symbol: str, steps: int = 10, confidence_level: float = 0.95):
    """
    Enhanced stock price prediction with confidence intervals and accuracy metrics
    
    Args:
        symbol: Stock ticker symbol
        steps: Number of days to forecast
        confidence_level: Confidence level for prediction intervals (default 0.95)
    
    Returns:
        Dictionary containing predictions, confidence intervals, and metrics
    """
    # 1️⃣ Fetch REAL historical data
    historical = get_historical(symbol)

    # 2️⃣ Fetch near-realtime price
    live_price, live_time = get_live_price(symbol)

    # append latest price
    historical.loc[pd.Timestamp.now()] = live_price
    historical = historical.tail(120)

    # 3️⃣ Load trained model metadata or use defaults
    try:
        with open(MODEL_PATH, "rb") as f:
            bundle = pickle.load(f)
        
        arima_order = bundle.get("order", (5, 1, 0))
        sarima_seasonal = bundle.get("seasonal_order", (1, 1, 1, 5))
    except (FileNotFoundError, EOFError, pickle.UnpicklingError, Exception) as e:
        print(f"⚠️ Warning: Model file error ({str(e)}). Using default parameters.")
        arima_order = (5, 1, 0)
        sarima_seasonal = (1, 1, 1, 5)

    # 4️⃣ Re-fit models with error handling
    try:
        arima = ARIMA(historical, order=arima_order).fit()
        sarima = SARIMAX(
            historical,
            order=arima_order,
            seasonal_order=sarima_seasonal
        ).fit(disp=False)
        
        # 5️⃣ Generate forecasts with confidence intervals
        arima_forecast_obj = arima.get_forecast(steps=steps)
        sarima_forecast_obj = sarima.get_forecast(steps=steps)
        
        # Extract point forecasts
        arima_fc = arima_forecast_obj.predicted_mean
        sarima_fc = sarima_forecast_obj.predicted_mean
        
        # Extract confidence intervals
        arima_ci = arima_forecast_obj.conf_int(alpha=1-confidence_level)
        sarima_ci = sarima_forecast_obj.conf_int(alpha=1-confidence_level)
        
        # Ensemble: Average predictions
        final_fc = (arima_fc.values + sarima_fc.values) / 2
        
        # Ensemble: Average confidence intervals
        lower_bound = (arima_ci.iloc[:, 0].values + sarima_ci.iloc[:, 0].values) / 2
        upper_bound = (arima_ci.iloc[:, 1].values + sarima_ci.iloc[:, 1].values) / 2

        # 6️⃣ Calculate prediction uncertainty metrics
        forecast_std = np.std([arima_fc.values, sarima_fc.values], axis=0)

    except Exception as e:
        print(f"⚠️ Model fitting failed ({str(e)}). Using simple fallback.")
        # Fallback: Simple Moving Average (last 5 points)
        last_price = float(historical.iloc[-1])
        ma = float(historical.tail(5).mean())
        
        # Use a simple trend based on MA vs Last Price
        trend = (last_price - ma) / 10  # Damped trend
        
        final_fc = np.array([last_price + (trend * (i+1)) for i in range(steps)])
        
        # Wide confidence intervals for fallback
        std = historical.std()
        lower_bound = final_fc - (1.96 * std)
        upper_bound = final_fc + (1.96 * std)
        forecast_std = np.full(steps, std)
        
        accuracy_metrics = None # Cannot calculate accuracy for fallback
    
    # 7️⃣ Backtest on recent data for accuracy metrics
    train_size = int(len(historical) * 0.8)
    train, test = historical[:train_size], historical[train_size:]
    
    try:
        if len(test) > 0:
            # Refit on training data
            arima_train = ARIMA(train, order=arima_order).fit()
            sarima_train = SARIMAX(train, order=arima_order, seasonal_order=sarima_seasonal).fit(disp=False)
            
            # Forecast test period
            test_steps = len(test)
            arima_test_fc = arima_train.forecast(steps=test_steps)
            sarima_test_fc = sarima_train.forecast(steps=test_steps)
            ensemble_test_fc = (arima_test_fc + sarima_test_fc) / 2
            
            # Calculate metrics
            rmse = np.sqrt(mean_squared_error(test, ensemble_test_fc))
            mae = mean_absolute_error(test, ensemble_test_fc)
            mape = mean_absolute_percentage_error(test, ensemble_test_fc) * 100
            
            accuracy_metrics = {
                "rmse": float(rmse),
                "mae": float(mae),
                "mape": float(mape),
                "test_size": len(test)
            }
        else:
            accuracy_metrics = None
    except Exception as e:
        print(f"⚠️ Backtesting failed ({str(e)}). Skipping metrics.")
        accuracy_metrics = None

    # 8️⃣ Generate future dates
    future_dates = [
        (historical.index[-1] + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        for i in range(steps)
    ]

    # 9️⃣ Calculate trend and volatility (and other indicators)
    indicators = _calculate_indicators(historical)
    
    # Recalculate volatility correctly for confidence score
    returns = historical.pct_change().dropna()
    volatility = returns.std() * np.sqrt(252) * live_price 
    
    recent_change = ((live_price - historical.iloc[-10]) / historical.iloc[-10]) * 100 if len(historical) > 10 else 0
    
    # 🔟 Determine prediction confidence score
    confidence_score = _calculate_confidence_score(
        forecast_std, 
        volatility, 
        accuracy_metrics
    )

    return {
        "symbol": symbol,
        "live_price": float(live_price),
        "live_time": live_time,
        "historical": [
            {"date": str(d).split()[0], "price": float(p)}
            for d, p in historical.items()
        ],
        "forecast": [
            {
                "date": future_dates[i],
                "price": float(final_fc[i]),
                "lower_bound": float(lower_bound[i]),
                "upper_bound": float(upper_bound[i]),
                "std_dev": float(forecast_std[i])
            }
            for i in range(steps)
        ],
        "indicators": indicators,
        "predicted_t1": float(final_fc[0]),
        "predicted_t10": float(final_fc[-1]),
        "trend": {
            "direction": "up" if final_fc[-1] > live_price else "down",
            "percentage_change": float(((final_fc[-1] - live_price) / live_price) * 100),
            "recent_10d_change": float(recent_change)
        },
        "volatility": float(volatility),
        "confidence_score": confidence_score,
        "confidence_level": confidence_level,
        "accuracy_metrics": accuracy_metrics,
        "model_info": {
            "arima_order": arima_order,
            "sarima_seasonal_order": sarima_seasonal,
            "ensemble_method": "simple_average"
        }
    }


def _calculate_indicators(historical_series):
    """
    Calculate technical indicators for charts
    """
    try:
        df = pd.DataFrame(historical_series)
        df.columns = ["Close"]
        
        # SMA 20
        df["SMA_20"] = df["Close"].rolling(window=20).mean()
        
        # EMA 20
        df["EMA_20"] = df["Close"].ewm(span=20, adjust=False).mean()
        
        # Bollinger Bands (20, 2)
        df["BB_Middle"] = df["Close"].rolling(window=20).mean()
        df["BB_Std"] = df["Close"].rolling(window=20).std()
        df["BB_Upper"] = df["BB_Middle"] + (2 * df["BB_Std"])
        df["BB_Lower"] = df["BB_Middle"] - (2 * df["BB_Std"])
        
        # RSI 14
        delta = df["Close"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df["RSI"] = 100 - (100 / (1 + rs))
        
        # MACD (12, 26, 9)
        exp1 = df["Close"].ewm(span=12, adjust=False).mean()
        exp2 = df["Close"].ewm(span=26, adjust=False).mean()
        df["MACD"] = exp1 - exp2
        df["MACD_Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()
        df["MACD_Hist"] = df["MACD"] - df["MACD_Signal"]
        
        # Fill NaN
        df = df.fillna(0)
        
        # Convert to list of dicts/arrays
        dates = [str(d).split()[0] for d in df.index]
        
        return {
            "dates": dates,
            "sma_20": df["SMA_20"].tolist(),
            "ema_20": df["EMA_20"].tolist(),
            "rsi": df["RSI"].tolist(),
            "macd": df["MACD"].tolist(),
            "macd_signal": df["MACD_Signal"].tolist(),
            "macd_hist": df["MACD_Hist"].tolist(),
            "bb_upper": df["BB_Upper"].tolist(),
            "bb_lower": df["BB_Lower"].tolist()
        }
    except Exception as e:
        print(f"Error calculating indicators: {e}")
        return {}


def _calculate_confidence_score(forecast_std, volatility, accuracy_metrics):
    """
    Calculate a confidence score (0-100) based on prediction uncertainty
    
    Args:
        forecast_std: Standard deviation of forecasts
        volatility: Historical volatility
        accuracy_metrics: Dictionary of accuracy metrics
    
    Returns:
        Confidence score as float between 0-100
    """
    # Base score starts at 100
    score = 100.0
    
    # Penalize high forecast uncertainty
    avg_uncertainty = np.mean(forecast_std)
    uncertainty_penalty = min(avg_uncertainty * 5, 30)
    score -= uncertainty_penalty
    
    # Penalize high volatility
    volatility_penalty = min(volatility * 2, 20)
    score -= volatility_penalty
    
    # Adjust based on backtest accuracy
    if accuracy_metrics and "mape" in accuracy_metrics:
        mape = accuracy_metrics["mape"]
        mape_penalty = min(mape / 2, 30)
        score -= mape_penalty
    
    return max(0.0, min(100.0, score))


def get_prediction_summary(symbol: str):
    """
    Get a quick summary prediction for dashboard display
    
    Args:
        symbol: Stock ticker symbol
    
    Returns:
        Simplified prediction summary
    """
    full_prediction = predict_price(symbol, steps=5)
    
    return {
        "symbol": symbol,
        "current_price": full_prediction["live_price"],
        "next_day_prediction": full_prediction["predicted_t1"],
        "week_prediction": full_prediction["predicted_t10"],
        "trend": full_prediction["trend"]["direction"],
        "confidence": full_prediction["confidence_score"]
    }


def compare_models(symbol: str, steps: int = 10):
    """
    Compare individual model performances
    
    Args:
        symbol: Stock ticker symbol
        steps: Number of days to forecast
    
    Returns:
        Dictionary with individual model predictions
    """
    historical = get_historical(symbol)
    live_price, live_time = get_live_price(symbol)
    
    historical.loc[pd.Timestamp.now()] = live_price
    historical = historical.tail(120)
    
    try:
        with open(MODEL_PATH, "rb") as f:
            bundle = pickle.load(f)
        
        arima_order = bundle.get("order", (5, 1, 0))
        sarima_seasonal = bundle.get("seasonal_order", (1, 1, 1, 5))
    except (FileNotFoundError, EOFError, pickle.UnpicklingError, Exception):
        arima_order = (5, 1, 0)
        sarima_seasonal = (1, 1, 1, 5)
    
    # Fit both models
    arima = ARIMA(historical, order=arima_order).fit()
    sarima = SARIMAX(historical, order=arima_order, seasonal_order=sarima_seasonal).fit(disp=False)
    
    # Generate forecasts
    arima_fc = arima.forecast(steps)
    sarima_fc = sarima.forecast(steps)
    
    return {
        "symbol": symbol,
        "live_price": float(live_price),
        "arima_prediction": {
            "t1": float(arima_fc.iloc[0]),
            "t10": float(arima_fc.iloc[-1]),
            "aic": float(arima.aic),
            "bic": float(arima.bic)
        },
        "sarima_prediction": {
            "t1": float(sarima_fc.iloc[0]),
            "t10": float(sarima_fc.iloc[-1]),
            "aic": float(sarima.aic),
            "bic": float(sarima.bic)
        }
    }
