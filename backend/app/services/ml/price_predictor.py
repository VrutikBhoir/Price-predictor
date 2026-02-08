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
    try:
        # 1️⃣ Fetch REAL historical data
        historical = get_historical(symbol)

        # 2️⃣ Fetch near-realtime price
        live_price, live_time = get_live_price(symbol)

        # append latest price
        historical.loc[pd.Timestamp.now()] = live_price
        historical = historical.tail(120)

    except Exception as e:
        raise ValueError(f"Failed to fetch stock data for {symbol}: {str(e)}")

    # 3️⃣ Load trained model metadata or use defaults
    try:
        with open(MODEL_PATH, "rb") as f:
            bundle = pickle.load(f)
        
        arima_order = bundle.get("order", (5, 1, 0))
        sarima_seasonal = bundle.get("seasonal_order", (1, 1, 1, 5))
    except (FileNotFoundError, EOFError, pickle.UnpicklingError) as e:
        print(f"⚠️ Warning: Model file error ({str(e)}). Using default parameters.")
        arima_order = (5, 1, 0)
        sarima_seasonal = (1, 1, 1, 5)
    except Exception as e:
        print(f"⚠️ Unexpected error loading model ({str(e)}). Using default parameters.")
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

        # 7️⃣ Backtest on recent data for accuracy metrics
        accuracy_metrics = _calculate_accuracy_metrics(
            historical, arima_order, sarima_seasonal
        )

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


def _calculate_accuracy_metrics(historical, arima_order, sarima_seasonal):
    """
    Calculate accuracy metrics through backtesting
    
    Returns:
        Dictionary of accuracy metrics or None if calculation fails
    """
    try:
        train_size = int(len(historical) * 0.8)
        train, test = historical[:train_size], historical[train_size:]
        
        if len(test) == 0:
            return None
        
        # Refit on training data
        arima_train = ARIMA(train, order=arima_order).fit()
        sarima_train = SARIMAX(
            train, 
            order=arima_order, 
            seasonal_order=sarima_seasonal
        ).fit(disp=False)
        
        # Forecast test period
        test_steps = len(test)
        arima_test_fc = arima_train.forecast(steps=test_steps)
        sarima_test_fc = sarima_train.forecast(steps=test_steps)
        ensemble_test_fc = (arima_test_fc + sarima_test_fc) / 2
        
        # Calculate metrics
        rmse = np.sqrt(mean_squared_error(test, ensemble_test_fc))
        mae = mean_absolute_error(test, ensemble_test_fc)
        mape = mean_absolute_percentage_error(test, ensemble_test_fc) * 100
        
        return {
            "rmse": float(rmse),
            "mae": float(mae),
            "mape": float(mape),
            "test_size": len(test)
        }
    except Exception as e:
        print(f"⚠️ Backtesting failed ({str(e)}). Skipping metrics.")
        return None


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


# ============================================================================
# 🤖 AI INVESTMENT ANALYZER - NEW FEATURE
# ============================================================================

def analyze_investment(symbol: str, investment_horizon: str = "short_term"):
    """
    AI-powered investment analysis and recommendation
    
    Args:
        symbol: Stock ticker symbol
        investment_horizon: 'short_term' (days-weeks), 'medium_term' (months), 'long_term' (years)
    
    Returns:
        Comprehensive investment recommendation with scoring and reasoning
    """
    # Get prediction data
    prediction_data = predict_price(symbol, steps=10)
    
    # Extract key metrics
    live_price = prediction_data["live_price"]
    predicted_t1 = prediction_data["predicted_t1"]
    predicted_t10 = prediction_data["predicted_t10"]
    trend = prediction_data["trend"]
    volatility = prediction_data["volatility"]
    confidence_score = prediction_data["confidence_score"]
    indicators = prediction_data["indicators"]
    
    # Calculate additional metrics
    historical_data = pd.Series([h["price"] for h in prediction_data["historical"]])
    
    # Perform multi-factor analysis
    technical_score = _analyze_technical_factors(indicators, live_price, historical_data)
    trend_score = _analyze_trend_strength(trend, predicted_t1, predicted_t10, live_price)
    risk_score = _analyze_risk_factors(volatility, confidence_score, historical_data)
    momentum_score = _analyze_momentum(historical_data, indicators)
    
    # Calculate overall investment score (0-100)
    overall_score = (
        technical_score * 0.30 +
        trend_score * 0.30 +
        risk_score * 0.25 +
        momentum_score * 0.15
    )
    
    # Generate recommendation
    recommendation = _generate_recommendation(
        overall_score, 
        investment_horizon,
        risk_score,
        trend_score
    )
    
    # Generate detailed reasoning
    reasoning = _generate_reasoning(
        symbol,
        overall_score,
        technical_score,
        trend_score,
        risk_score,
        momentum_score,
        prediction_data
    )
    
    # Calculate risk-reward ratio
    expected_return = ((predicted_t10 - live_price) / live_price) * 100
    risk_reward_ratio = abs(expected_return / volatility) if volatility > 0 else 0
    
    # Determine entry and exit points
    entry_exit = _calculate_entry_exit_points(
        live_price,
        indicators,
        trend,
        investment_horizon
    )
    
    return {
        "symbol": symbol,
        "recommendation": recommendation,
        "overall_score": round(overall_score, 2),
        "investment_horizon": investment_horizon,
        "scores": {
            "technical": round(technical_score, 2),
            "trend": round(trend_score, 2),
            "risk": round(risk_score, 2),
            "momentum": round(momentum_score, 2)
        },
        "risk_assessment": {
            "level": _get_risk_level(risk_score),
            "volatility": round(volatility, 2),
            "confidence": round(confidence_score, 2)
        },
        "expected_performance": {
            "short_term_return": round(((predicted_t1 - live_price) / live_price) * 100, 2),
            "medium_term_return": round(expected_return, 2),
            "risk_reward_ratio": round(risk_reward_ratio, 2)
        },
        "entry_exit_strategy": entry_exit,
        "reasoning": reasoning,
        "key_insights": _generate_key_insights(
            prediction_data,
            technical_score,
            trend_score,
            risk_score
        ),
        "warnings": _generate_warnings(risk_score, volatility, confidence_score, trend)
    }


def _analyze_technical_factors(indicators, live_price, historical_data):
    """
    Analyze technical indicators and return a score (0-100)
    """
    score = 50.0  # Neutral starting point
    
    if not indicators or len(indicators.get("rsi", [])) == 0:
        return score
    
    try:
        # Get latest values
        rsi = indicators["rsi"][-1] if indicators["rsi"][-1] != 0 else 50
        macd = indicators["macd"][-1]
        macd_signal = indicators["macd_signal"][-1]
        sma_20 = indicators["sma_20"][-1]
        ema_20 = indicators["ema_20"][-1]
        bb_upper = indicators["bb_upper"][-1]
        bb_lower = indicators["bb_lower"][-1]
        
        # RSI Analysis (30-70 range)
        if 30 < rsi < 70:
            score += 10  # Healthy range
        elif rsi < 30:
            score += 15  # Oversold - potential buy
        elif rsi > 70:
            score -= 15  # Overbought - potential sell
        
        # MACD Analysis
        if macd > macd_signal:
            score += 10  # Bullish crossover
        else:
            score -= 10  # Bearish crossover
        
        # Moving Average Analysis
        if live_price > sma_20 and live_price > ema_20:
            score += 15  # Price above moving averages
        elif live_price < sma_20 and live_price < ema_20:
            score -= 15  # Price below moving averages
        
        # Bollinger Bands Analysis
        bb_position = (live_price - bb_lower) / (bb_upper - bb_lower) if (bb_upper - bb_lower) != 0 else 0.5
        if bb_position < 0.2:
            score += 10  # Near lower band - oversold
        elif bb_position > 0.8:
            score -= 10  # Near upper band - overbought
        
    except Exception as e:
        print(f"Error in technical analysis: {e}")
    
    return max(0.0, min(100.0, score))


def _analyze_trend_strength(trend, predicted_t1, predicted_t10, live_price):
    """
    Analyze trend strength and direction (0-100)
    """
    score = 50.0
    
    # Predicted change percentage
    short_term_change = ((predicted_t1 - live_price) / live_price) * 100
    medium_term_change = ((predicted_t10 - live_price) / live_price) * 100
    
    # Positive trend scoring
    if trend["direction"] == "up":
        if medium_term_change > 5:
            score += 30  # Strong uptrend
        elif medium_term_change > 2:
            score += 20  # Moderate uptrend
        elif medium_term_change > 0:
            score += 10  # Weak uptrend
    else:
        if medium_term_change < -5:
            score -= 30  # Strong downtrend
        elif medium_term_change < -2:
            score -= 20  # Moderate downtrend
        elif medium_term_change < 0:
            score -= 10  # Weak downtrend
    
    # Consistency bonus (if short and medium term align)
    if (short_term_change > 0 and medium_term_change > 0) or \
       (short_term_change < 0 and medium_term_change < 0):
        score += 10
    
    return max(0.0, min(100.0, score))


def _analyze_risk_factors(volatility, confidence_score, historical_data):
    """
    Analyze risk factors - higher score means lower risk (0-100)
    """
    score = 100.0
    
    # Volatility penalty (normalized)
    avg_price = historical_data.mean()
    volatility_ratio = (volatility / avg_price) * 100 if avg_price > 0 else 0
    
    if volatility_ratio > 5:
        score -= 40  # Very high volatility
    elif volatility_ratio > 3:
        score -= 25  # High volatility
    elif volatility_ratio > 1.5:
        score -= 10  # Moderate volatility
    
    # Confidence penalty
    if confidence_score < 40:
        score -= 30  # Low confidence
    elif confidence_score < 60:
        score -= 15  # Moderate confidence
    
    # Historical stability bonus
    returns = historical_data.pct_change().dropna()
    if len(returns) > 0:
        stability = 1 / (returns.std() + 0.01)  # Inverse of std dev
        stability_bonus = min(stability * 5, 20)
        score += stability_bonus
    
    return max(0.0, min(100.0, score))


def _analyze_momentum(historical_data, indicators):
    """
    Analyze price momentum (0-100)
    """
    score = 50.0
    
    if len(historical_data) < 20:
        return score
    
    try:
        # Recent performance
        recent_5d = historical_data.tail(5)
        recent_10d = historical_data.tail(10)
        recent_20d = historical_data.tail(20)
        
        change_5d = ((recent_5d.iloc[-1] - recent_5d.iloc[0]) / recent_5d.iloc[0]) * 100
        change_10d = ((recent_10d.iloc[-1] - recent_10d.iloc[0]) / recent_10d.iloc[0]) * 100
        change_20d = ((recent_20d.iloc[-1] - recent_20d.iloc[0]) / recent_20d.iloc[0]) * 100
        
        # Momentum scoring
        if change_5d > 2 and change_10d > 2:
            score += 25  # Strong positive momentum
        elif change_5d > 0 and change_10d > 0:
            score += 15  # Positive momentum
        elif change_5d < -2 and change_10d < -2:
            score -= 25  # Strong negative momentum
        elif change_5d < 0 and change_10d < 0:
            score -= 15  # Negative momentum
        
        # Acceleration bonus
        if change_5d > change_10d > change_20d and change_5d > 0:
            score += 15  # Accelerating upward
        elif change_5d < change_10d < change_20d and change_5d < 0:
            score -= 15  # Accelerating downward
        
    except Exception as e:
        print(f"Error in momentum analysis: {e}")
    
    return max(0.0, min(100.0, score))


def _generate_recommendation(overall_score, investment_horizon, risk_score, trend_score):
    """
    Generate investment recommendation based on overall score
    """
    if overall_score >= 75:
        action = "STRONG BUY"
        description = "Excellent investment opportunity with strong fundamentals and positive outlook"
    elif overall_score >= 60:
        action = "BUY"
        description = "Good investment opportunity with favorable indicators"
    elif overall_score >= 50:
        action = "HOLD"
        description = "Neutral position - monitor for better entry points"
    elif overall_score >= 35:
        action = "SELL"
        description = "Consider reducing position - weak indicators"
    else:
        action = "STRONG SELL"
        description = "Poor investment outlook - exit position recommended"
    
    # Adjust for investment horizon
    horizon_note = ""
    if investment_horizon == "long_term":
        if risk_score > 60:
            horizon_note = " Suitable for long-term buy-and-hold strategy."
        else:
            horizon_note = " High volatility may impact long-term returns."
    elif investment_horizon == "short_term":
        if trend_score > 60:
            horizon_note = " Short-term momentum is favorable."
        else:
            horizon_note = " Limited short-term upside potential."
    
    return {
        "action": action,
        "description": description + horizon_note,
        "confidence": "high" if overall_score > 70 or overall_score < 30 else "medium"
    }


def _generate_reasoning(symbol, overall_score, technical_score, trend_score, 
                       risk_score, momentum_score, prediction_data):
    """
    Generate human-readable reasoning for the recommendation
    """
    reasoning = []
    
    # Overall assessment
    if overall_score >= 70:
        reasoning.append(f"📈 {symbol} shows strong overall investment potential with a score of {overall_score:.1f}/100.")
    elif overall_score >= 50:
        reasoning.append(f"📊 {symbol} presents moderate investment opportunity with a score of {overall_score:.1f}/100.")
    else:
        reasoning.append(f"📉 {symbol} shows weak investment signals with a score of {overall_score:.1f}/100.")
    
    # Technical analysis
    if technical_score >= 70:
        reasoning.append(f"✅ Technical indicators are strongly bullish (score: {technical_score:.1f}).")
    elif technical_score >= 50:
        reasoning.append(f"➡️ Technical indicators show neutral to positive signals (score: {technical_score:.1f}).")
    else:
        reasoning.append(f"⚠️ Technical indicators suggest caution (score: {technical_score:.1f}).")
    
    # Trend analysis
    trend = prediction_data["trend"]
    if trend["direction"] == "up":
        reasoning.append(f"📊 Price trend is {trend['direction']} with projected {abs(trend['percentage_change']):.2f}% gain over 10 days.")
    else:
        reasoning.append(f"📉 Price trend is {trend['direction']} with projected {abs(trend['percentage_change']):.2f}% decline over 10 days.")
    
    # Risk assessment
    if risk_score >= 70:
        reasoning.append(f"🛡️ Low risk profile makes this suitable for conservative investors (risk score: {risk_score:.1f}).")
    elif risk_score >= 50:
        reasoning.append(f"⚖️ Moderate risk level - suitable for balanced portfolios (risk score: {risk_score:.1f}).")
    else:
        reasoning.append(f"⚠️ High risk level - only for aggressive investors (risk score: {risk_score:.1f}).")
    
    # Momentum
    if momentum_score >= 65:
        reasoning.append(f"🚀 Strong positive momentum detected (score: {momentum_score:.1f}).")
    elif momentum_score <= 35:
        reasoning.append(f"🔻 Negative momentum suggests downward pressure (score: {momentum_score:.1f}).")
    
    return reasoning


def _get_risk_level(risk_score):
    """
    Convert risk score to risk level
    """
    if risk_score >= 70:
        return "LOW"
    elif risk_score >= 50:
        return "MEDIUM"
    elif risk_score >= 30:
        return "HIGH"
    else:
        return "VERY HIGH"


def _calculate_entry_exit_points(live_price, indicators, trend, investment_horizon):
    """
    Calculate optimal entry and exit points
    """
    try:
        bb_lower = indicators["bb_lower"][-1] if indicators.get("bb_lower") else live_price * 0.98
        bb_upper = indicators["bb_upper"][-1] if indicators.get("bb_upper") else live_price * 1.02
        sma_20 = indicators["sma_20"][-1] if indicators.get("sma_20") else live_price
        
        # Entry points
        if trend["direction"] == "up":
            entry_optimal = round(min(live_price * 0.99, sma_20 * 0.995), 2)
            entry_acceptable = round(live_price, 2)
        else:
            entry_optimal = round(bb_lower * 1.005, 2)
            entry_acceptable = round(live_price * 0.97, 2)
        
        # Exit points
        if investment_horizon == "short_term":
            target = round(live_price * 1.03, 2)
            stop_loss = round(live_price * 0.97, 2)
        elif investment_horizon == "medium_term":
            target = round(live_price * 1.08, 2)
            stop_loss = round(live_price * 0.94, 2)
        else:  # long_term
            target = round(live_price * 1.20, 2)
            stop_loss = round(live_price * 0.90, 2)
        
        return {
            "entry_points": {
                "optimal": entry_optimal,
                "acceptable": entry_acceptable
            },
            "exit_points": {
                "target": target,
                "stop_loss": stop_loss
            }
        }
    except Exception as e:
        print(f"Error calculating entry/exit points: {e}")
        return {
            "entry_points": {"optimal": live_price * 0.99, "acceptable": live_price},
            "exit_points": {"target": live_price * 1.05, "stop_loss": live_price * 0.95}
        }


def _generate_key_insights(prediction_data, technical_score, trend_score, risk_score):
    """
    Generate key insights for quick decision making
    """
    insights = []
    
    live_price = prediction_data["live_price"]
    indicators = prediction_data["indicators"]
    
    # RSI insight
    if indicators and indicators.get("rsi"):
        rsi = indicators["rsi"][-1]
        if rsi < 30:
            insights.append("🔵 RSI indicates oversold conditions - potential buying opportunity")
        elif rsi > 70:
            insights.append("🔴 RSI indicates overbought conditions - consider taking profits")
    
    # Moving average insight
    if indicators and indicators.get("sma_20"):
        sma = indicators["sma_20"][-1]
        if live_price > sma * 1.05:
            insights.append("📈 Price is significantly above 20-day SMA - strong bullish signal")
        elif live_price < sma * 0.95:
            insights.append("📉 Price is significantly below 20-day SMA - weak momentum")
    
    # Volatility insight
    volatility = prediction_data["volatility"]
    if volatility > 3:
        insights.append("⚡ High volatility detected - expect significant price swings")
    elif volatility < 1:
        insights.append("😴 Low volatility - stable but limited upside potential")
    
    # Confidence insight
    if prediction_data["confidence_score"] > 70:
        insights.append("✅ High prediction confidence - reliable forecast")
    elif prediction_data["confidence_score"] < 40:
        insights.append("⚠️ Low prediction confidence - proceed with caution")
    
    return insights


def _generate_warnings(risk_score, volatility, confidence_score, trend):
    """
    Generate warnings for risk management
    """
    warnings = []
    
    if risk_score < 40:
        warnings.append("⚠️ HIGH RISK: This stock exhibits significant risk factors")
    
    if volatility > 5:
        warnings.append("⚡ EXTREME VOLATILITY: Price swings may be severe")
    
    if confidence_score < 50:
        warnings.append("❓ LOW CONFIDENCE: Predictions may be unreliable")
    
    if abs(trend["recent_10d_change"]) > 15:
        warnings.append("📊 RAPID MOVEMENT: Stock has moved >15% in past 10 days")
    
    if not warnings:
        warnings.append("✅ No major warnings detected")
    
    return warnings


# ============================================================================
# ENHANCED API FUNCTIONS
# ============================================================================

def get_prediction_with_analysis(symbol: str, investment_horizon: str = "medium_term"):
    """
    Get complete prediction with AI investment analysis
    
    Args:
        symbol: Stock ticker symbol
        investment_horizon: Investment time horizon
    
    Returns:
        Combined prediction and investment analysis
    """
    prediction = predict_price(symbol, steps=10)
    analysis = analyze_investment(symbol, investment_horizon)
    
    return {
        "prediction": prediction,
        "investment_analysis": analysis
    }


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
    try:
        historical = get_historical(symbol)
        live_price, live_time = get_live_price(symbol)
        
        historical.loc[pd.Timestamp.now()] = live_price
        historical = historical.tail(120)
    except Exception as e:
        raise ValueError(f"Failed to fetch stock data for {symbol}: {str(e)}")
    
    try:
        with open(MODEL_PATH, "rb") as f:
            bundle = pickle.load(f)
        
        arima_order = bundle.get("order", (5, 1, 0))
        sarima_seasonal = bundle.get("seasonal_order", (1, 1, 1, 5))
    except (FileNotFoundError, EOFError, pickle.UnpicklingError):
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


def batch_analyze_stocks(symbols: list, investment_horizon: str = "medium_term"):
    """
    Analyze multiple stocks at once for portfolio optimization
    
    Args:
        symbols: List of stock ticker symbols
        investment_horizon: Investment time horizon
    
    Returns:
        List of analyses sorted by investment score
    """
    results = []
    
    for symbol in symbols:
        try:
            analysis = analyze_investment(symbol, investment_horizon)
            results.append(analysis)
        except Exception as e:
            print(f"Error analyzing {symbol}: {e}")
            continue
    
    # Sort by overall score (descending)
    results.sort(key=lambda x: x["overall_score"], reverse=True)
    
    return {
        "analyzed_stocks": len(results),
        "investment_horizon": investment_horizon,
        "top_picks": results[:3] if len(results) >= 3 else results,
        "all_results": results
    }
