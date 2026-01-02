import pandas as pd
from typing import Dict, Any, List, Optional

from .technical_indicators import TechnicalIndicators
from .model_trainer import ModelTrainer


class Advisor:
    """
    Generates buy/sell/hold suggestions using a rules-based ensemble of
    technical indicators (RSI, MACD, Bollinger Bands) and short-term
    ARIMA/SARIMA forecasts for confirmation. Also suggests better
    alternatives (peers) when available, with reasons.
    """

    def __init__(self):
        self.technicals = TechnicalIndicators()

    def _crossover_up(self, fast: pd.Series, slow: pd.Series) -> bool:
        if len(fast) < 2 or len(slow) < 2:
            return False
        return fast.iloc[-2] <= slow.iloc[-2] and fast.iloc[-1] > slow.iloc[-1]

    def _crossover_down(self, fast: pd.Series, slow: pd.Series) -> bool:
        if len(fast) < 2 or len(slow) < 2:
            return False
        return fast.iloc[-2] >= slow.iloc[-2] and fast.iloc[-1] < slow.iloc[-1]

    def _safe_float(self, v: Optional[float]) -> Optional[float]:
        try:
            return float(v) if v is not None else None
        except Exception:
            return None

    def suggest(
        self,
        df: pd.DataFrame,
        forecast_days: int = 10,
        model_type: str = "ARIMA",
        ticker: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Input df: index=Date (datetime-like), columns include at least Close.
        Returns a structured recommendation with reasons and short-term forecast,
        and optional peer alternatives.
        """
        result: Dict[str, Any] = {
            "signal": "hold",
            "confidence": 0.0,
            "reasons": [],
            "current_price": None,
            "indicators": {},
            "forecast": {
                "forecast": [],
                "lower_ci": [],
                "upper_ci": [],
                "metrics": {},
            },
            # Enhanced fields for richer assistant guidance
            "expected_return_pct": None,  # expected move over forecast horizon (e.g., last-forecast vs current)
            "risk_level": None,           # "low" | "medium" | "high" based on recent volatility
            "time_horizon_days": int(forecast_days) if forecast_days is not None else 10,
            "targets": {                  # simple suggested trading plan (not financial advice)
                "entry": None,
                "stop_loss": None,
                "target1": None,
                "target2": None,
            },
            "decision_summary": None,     # one-liner explanation tailored to buy/sell/hold
            "performance": {              # trailing performance context
                "return_7d": None,
                "return_30d": None,
            },
            "trend_label": None,          # "up" | "down" | "flat"
            "alternatives": [],  # [{ticker, score, reasons, expected_return_pct, one_liner}]
        }

        if df is None or df.empty or "Close" not in df.columns:
            result["reasons"].append("Insufficient data")
            return result

        df = df.copy().sort_index()
        close = df["Close"].astype(float)

        # Trailing performance for context
        def _pct_return(series: pd.Series, days: int) -> Optional[float]:
            try:
                s = pd.to_numeric(series, errors='coerce').dropna()
                if len(s) < days + 1:
                    return None
                return float(s.iloc[-1] / s.iloc[-(days + 1)] - 1.0)
            except Exception:
                return None

        trailing_7d = _pct_return(close, 7)
        trailing_30d = _pct_return(close, 30)

        # Compute indicators
        rsi = self.technicals.calculate_rsi(close)
        macd_pack = self.technicals.calculate_macd(close)
        bb_pack = self.technicals.calculate_bollinger_bands(close)

        rsi_latest = self._safe_float(rsi.iloc[-1])
        macd_line = macd_pack["MACD"]
        macd_signal = macd_pack["MACD_Signal"]
        macd_latest = self._safe_float(macd_line.iloc[-1])
        macdsig_latest = self._safe_float(macd_signal.iloc[-1])

        bb_upper = bb_pack["BB_Upper"]
        bb_lower = bb_pack["BB_Lower"]
        bb_u_latest = self._safe_float(bb_upper.iloc[-1])
        bb_l_latest = self._safe_float(bb_lower.iloc[-1])

        price_latest = self._safe_float(close.iloc[-1])

        result["current_price"] = price_latest
        result["indicators"] = {
            "RSI": rsi_latest,
            "MACD": macd_latest,
            "MACD_Signal": macdsig_latest,
            "BB_Upper": bb_u_latest,
            "BB_Lower": bb_l_latest,
        }
        result["performance"]["return_7d"] = trailing_7d
        result["performance"]["return_30d"] = trailing_30d

        # Rule-based scoring
        buy_score = 0.0
        sell_score = 0.0
        reasons: List[str] = []

        # RSI
        if rsi_latest is not None:
            if rsi_latest < 30:
                buy_score += 0.4
                reasons.append(f"RSI {rsi_latest:.1f} indicates oversold")
            elif rsi_latest > 70:
                sell_score += 0.4
                reasons.append(f"RSI {rsi_latest:.1f} indicates overbought")

        # MACD crossovers
        if self._crossover_up(macd_line, macd_signal):
            buy_score += 0.3
            reasons.append("MACD bullish crossover")
        elif self._crossover_down(macd_line, macd_signal):
            sell_score += 0.3
            reasons.append("MACD bearish crossover")
        else:
            # If not a fresh crossover, use relative MACD position
            if macd_latest is not None and macdsig_latest is not None:
                if macd_latest > macdsig_latest:
                    buy_score += 0.1
                    reasons.append("MACD above signal (bullish bias)")
                elif macd_latest < macdsig_latest:
                    sell_score += 0.1
                    reasons.append("MACD below signal (bearish bias)")

        # Bollinger Bands touches
        if price_latest is not None and bb_l_latest is not None and bb_u_latest is not None:
            if price_latest <= bb_l_latest:
                buy_score += 0.3
                reasons.append("Price at/near lower Bollinger band")
            elif price_latest >= bb_u_latest:
                sell_score += 0.3
                reasons.append("Price at/near upper Bollinger band")

        # Short-term forecast for confirmation
        forecast_output = self._make_forecast(close, forecast_days, model_type)
        result["forecast"]["forecast"] = forecast_output.get("forecast", [])
        result["forecast"]["lower_ci"] = forecast_output.get("lower_ci", [])
        result["forecast"]["upper_ci"] = forecast_output.get("upper_ci", [])
        result["forecast"]["metrics"] = forecast_output.get("metrics", {})

        # Trend bias from forecast slope
        slope_bias = self._forecast_slope_bias(forecast_output.get("forecast", []))
        if slope_bias > 0:
            buy_score += 0.2
            reasons.append("Forecast trend up")
        elif slope_bias < 0:
            sell_score += 0.2
            reasons.append("Forecast trend down")

        # Expected return over horizon from forecast last vs current
        try:
            if price_latest is not None and forecast_output.get("forecast"):
                last_forecast_val = forecast_output["forecast"][-1].get("value")
                if last_forecast_val is not None and float(price_latest) != 0:
                    result["expected_return_pct"] = float(last_forecast_val) / float(price_latest) - 1.0
        except Exception:
            result["expected_return_pct"] = None

        # Trend label with neutral threshold
        try:
            er = result.get("expected_return_pct")
            if isinstance(er, float) and er is not None:
                if er > 0.005:
                    result["trend_label"] = "up"
                elif er < -0.005:
                    result["trend_label"] = "down"
                else:
                    result["trend_label"] = "flat"
            else:
                result["trend_label"] = "flat"
        except Exception:
            result["trend_label"] = None

        # Final decision
        net_score = buy_score - sell_score
        if net_score >= 0.15:
            result["signal"] = "buy"
            result["confidence"] = min(1.0, round(buy_score, 2))
        elif net_score <= -0.15:
            result["signal"] = "sell"
            result["confidence"] = min(1.0, round(sell_score, 2))
        else:
            result["signal"] = "hold"
            result["confidence"] = min(1.0, round(max(buy_score, sell_score) * 0.7, 2))

        result["reasons"] = reasons

        # Risk level from recent realized volatility (last 20 trading days)
        try:
            daily_ret = pd.to_numeric(close.pct_change(), errors='coerce').dropna()
            vol = float(daily_ret.tail(20).std()) if len(daily_ret) else None
            if vol is not None:
                if vol < 0.015:
                    result["risk_level"] = "low"
                elif vol < 0.03:
                    result["risk_level"] = "medium"
                else:
                    result["risk_level"] = "high"
        except Exception:
            result["risk_level"] = None

        # Targets (simple, educational; not financial advice)
        try:
            if price_latest is not None:
                entry = float(price_latest)
                exp = result.get("expected_return_pct")
                # conservative and stretch targets
                t1_pct = max(0.03, (exp * 0.5) if (isinstance(exp, float) and exp is not None) else 0.05)
                t2_pct = max(0.06, (exp if (isinstance(exp, float) and exp is not None) else 0.1))
                if result["signal"] == "buy":
                    result["targets"] = {
                        "entry": entry,
                        "stop_loss": round(entry * 0.95, 2),
                        "target1": round(entry * (1.0 + t1_pct), 2),
                        "target2": round(entry * (1.0 + t2_pct), 2),
                    }
                elif result["signal"] == "sell":
                    result["targets"] = {
                        "entry": entry,
                        "stop_loss": round(entry * 1.05, 2),
                        "target1": round(entry * (1.0 - t1_pct), 2),
                        "target2": round(entry * (1.0 - t2_pct), 2),
                    }
                else:
                    result["targets"] = {
                        "entry": entry,
                        "stop_loss": None,
                        "target1": round(entry * (1.0 + 0.03), 2),
                        "target2": round(entry * (1.0 + 0.06), 2),
                    }
        except Exception:
            pass

        # Decision summary (one-liner)
        try:
            key_reasons = ", ".join(reasons[:3]) if reasons else "mixed signals"
            er = result.get("expected_return_pct")
            if result["signal"] == "buy":
                add = f"; expected {er*100:.1f}% over next {forecast_days}d" if isinstance(er, float) and er is not None else ""
                result["decision_summary"] = f"Buy: {key_reasons}{add}."
            elif result["signal"] == "sell":
                add = f"; downside {abs(er)*100:.1f}% expected" if isinstance(er, float) and er is not None and er < 0 else ""
                result["decision_summary"] = f"Sell: {key_reasons}{add}."
            else:
                result["decision_summary"] = f"Hold: {key_reasons}."
        except Exception:
            result["decision_summary"] = None

        # --- Alternatives (simple peer ranking) ---
        try:
            alts = self._suggest_alternatives(base_ticker=ticker, base_score=net_score)
            result["alternatives"] = alts
        except Exception:
            # Fail silently for alternatives; core advice still returned
            result["alternatives"] = []

        return result

    def _forecast_slope_bias(self, forecast_list: List[Dict[str, float]]) -> float:
        """Compute a simple slope sign from forecast points to bias decision."""
        if not forecast_list or len(forecast_list) < 2:
            return 0.0
        try:
            values = [p["value"] for p in forecast_list if p.get("value") is not None]
            if len(values) < 2:
                return 0.0
            # simple slope between first and last
            return 1.0 if values[-1] > values[0] else (-1.0 if values[-1] < values[0] else 0.0)
        except Exception:
            return 0.0

    def _make_forecast(self, close: pd.Series, forecast_days: int, model_type: str) -> Dict[str, Any]:
        try:
            trainer = ModelTrainer()
            out: Dict[str, Any] = {"forecast": [], "lower_ci": [], "upper_ci": [], "metrics": {}}

            # If data is too short, fall back to naive forecast (repeat last price)
            clean_close = pd.to_numeric(close, errors='coerce').dropna()
            if len(clean_close) < 10:
                try:
                    last_val = float(clean_close.iloc[-1]) if len(clean_close) else None
                    last_date = clean_close.index[-1] if len(clean_close) else pd.Timestamp.today()
                    dates = trainer._create_forecast_dates(last_date, max(1, int(forecast_days) if forecast_days else 1))
                    if last_val is not None:
                        out["forecast"] = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in dates]
                        out["lower_ci"] = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in dates]
                        out["upper_ci"] = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in dates]
                    return out
                except Exception:
                    return out

            preds, metrics = (
                trainer.train_arima(clean_close, forecast_days)
                if model_type.upper() == "ARIMA"
                else trainer.train_sarima(clean_close, forecast_days)
            )
            if preds is None:
                # ARIMA/SARIMA failed -> naive fallback
                try:
                    last_val = float(clean_close.iloc[-1]) if len(clean_close) else None
                    last_date = clean_close.index[-1] if len(clean_close) else pd.Timestamp.today()
                    dates = trainer._create_forecast_dates(last_date, max(1, int(forecast_days) if forecast_days else 1))
                    if last_val is not None:
                        out["forecast"] = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in dates]
                        out["lower_ci"] = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in dates]
                        out["upper_ci"] = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in dates]
                except Exception:
                    pass
                return out

            forecast = []
            lower_ci = []
            upper_ci = []
            def to_points(s):
                out_list = []
                if s is None:
                    return out_list
                try:
                    for d, v in s.items():
                        if pd.isna(v):
                            continue
                        try:
                            dt = pd.Timestamp(d)
                        except Exception:
                            continue
                        out_list.append({"date": dt.strftime("%Y-%m-%d"), "value": float(v)})
                except Exception:
                    pass
                return out_list

            if preds.get("forecast") is not None:
                forecast = to_points(preds["forecast"])
            if preds.get("lower_ci") is not None:
                lower_ci = to_points(preds["lower_ci"])
            if preds.get("upper_ci") is not None:
                upper_ci = to_points(preds["upper_ci"])

            # If model produced empty arrays (edge failures), use naive fallback
            if not forecast:
                try:
                    last_val = float(clean_close.iloc[-1]) if len(clean_close) else None
                    last_date = clean_close.index[-1] if len(clean_close) else pd.Timestamp.today()
                    dates = trainer._create_forecast_dates(last_date, max(1, int(forecast_days) if forecast_days else 1))
                    if last_val is not None:
                        forecast = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in dates]
                        lower_ci = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in dates]
                        upper_ci = [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "value": last_val} for d in dates]
                except Exception:
                    pass

            out["forecast"] = forecast
            out["lower_ci"] = lower_ci
            out["upper_ci"] = upper_ci
            out["metrics"] = {k: (float(v) if v is not None else None) for k, v in (metrics or {}).items()}
            return out
        except Exception:
            return {"forecast": [], "lower_ci": [], "upper_ci": [], "metrics": {}}

    def _suggest_alternatives(
        self,
        base_ticker: Optional[str],
        base_score: float,
        universe: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Very lightweight peer suggestion based on the same rules on a small universe.
        Uses 3 months of daily data to compute a simple bullish score.
        """
        try:
            import yfinance as yf  # local import to avoid hard dependency at import time
        except Exception:
            return []

        if universe is None:
            universe = [
                "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "NFLX",
                "AVGO", "AMD", "CRM", "ORCL", "SHOP", "ADBE", "INTC", "SMCI"
            ]
        # Remove base ticker from universe if provided
        tickers = [t for t in universe if (base_ticker is None or t.upper() != base_ticker.upper())]

        suggestions: List[Dict[str, Any]] = []
        for t in tickers[:10]:  # limit to avoid long calls
            try:
                df = yf.download(t, period="3mo", interval="1d", progress=False, threads=False)
                if df is None or df.empty or "Close" not in df.columns:
                    continue
                # flatten if MultiIndex
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                c = pd.to_numeric(df["Close"], errors="coerce").dropna()
                if len(c) < 20:
                    continue

                # Indicators (minimal): RSI and a simple slope over last 20 bars
                rsi = self.technicals.calculate_rsi(c)
                rsi_last = self._safe_float(rsi.iloc[-1])

                # slope & recent returns
                window = c.tail(20)
                slope = 0.0
                try:
                    slope = 1.0 if float(window.iloc[-1]) > float(window.iloc[0]) else (-1.0 if float(window.iloc[-1]) < float(window.iloc[0]) else 0.0)
                except Exception:
                    slope = 0.0
                ret20 = None
                try:
                    if len(window) >= 2 and float(window.iloc[0]) != 0:
                        ret20 = float(window.iloc[-1] / window.iloc[0] - 1.0)
                except Exception:
                    ret20 = None

                # score: prefer upward slope and neutral RSI (35-65)
                score = 0.0
                local_reasons: List[str] = []
                if rsi_last is not None:
                    if 35 <= rsi_last <= 65:
                        score += 0.3
                        local_reasons.append(f"RSI {rsi_last:.1f} balanced (not overbought)")
                    elif rsi_last < 30:
                        score += 0.2
                        local_reasons.append(f"RSI {rsi_last:.1f} oversold (possible rebound)")
                    elif rsi_last > 70:
                        score -= 0.2
                        local_reasons.append(f"RSI {rsi_last:.1f} overbought (risk of pullback)")
                if slope > 0:
                    score += 0.4
                    local_reasons.append("Positive 20D momentum")
                elif slope < 0:
                    score -= 0.3
                    local_reasons.append("Negative 20D momentum")

                # Estimate expected short-term return from 20D move as proxy
                exp_ret = ret20 if ret20 is not None else (0.04 if slope > 0 else -0.03)
                # classify return band
                return_band = None
                if exp_ret is not None:
                    if exp_ret >= 0.12:
                        return_band = "high"
                    elif exp_ret >= 0.05:
                        return_band = "medium"
                    elif exp_ret > 0:
                        return_band = "low"
                # keep only those clearly better than base and likely profitable
                if score > base_score + 0.1 and exp_ret is not None and exp_ret > 0:
                    one_liner = f"{t} {exp_ret*100:.1f}% over ~20d, RSI {rsi_last:.0f}" if rsi_last is not None else f"{t} {exp_ret*100:.1f}% recent momentum"
                    suggestions.append({
                        "ticker": t,
                        "score": round(score, 2),
                        "reasons": local_reasons,
                        "expected_return_pct": round(float(exp_ret), 4),
                        "return_band": return_band,
                        "one_liner": one_liner,
                    })
            except Exception:
                continue

        suggestions.sort(key=lambda x: x.get("score", 0), reverse=True)
        return suggestions[:3]