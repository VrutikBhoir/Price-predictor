import pandas as pd
import numpy as np
from typing import Tuple, Dict, Any, Optional
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller
from statsmodels.stats.diagnostic import acorr_ljungbox


class ModelTrainer:
    def __init__(self):
        self.model = None
        self.fitted_model = None

    def _is_model_result(self, obj: Any) -> bool:
        return hasattr(obj, 'aic')

    def _get_model_result(self, obj: Any) -> Any:
        if isinstance(obj, tuple):
            return obj[0]
        return obj

    def check_stationarity(self, data: pd.Series) -> bool:
        try:
            result = adfuller(data.dropna())
            p_value = result[1]
            return p_value < 0.05
        except Exception:
            return False

    def make_stationary(self, data: pd.Series) -> pd.Series:
        try:
            diff_data = data.diff().dropna()
            if self.check_stationarity(diff_data):
                return diff_data
            diff2_data = diff_data.diff().dropna()
            return diff2_data
        except Exception:
            return data

    def find_best_arima_order(self, data: pd.Series, max_p: int = 3, max_d: int = 2, max_q: int = 3) -> Tuple[int, int, int]:
        try:
            best_aic = float('inf')
            best_order = (1, 1, 1)
            for p in range(max_p + 1):
                for d in range(max_d + 1):
                    for q in range(max_q + 1):
                        try:
                            model = ARIMA(data, order=(p, d, q))
                            fitted_model = model.fit()
                            if hasattr(fitted_model, 'aic') and fitted_model.aic < best_aic:
                                best_aic = fitted_model.aic
                                best_order = (p, d, q)
                        except Exception:
                            continue
            return best_order
        except Exception:
            return (1, 1, 1)

    def find_best_sarima_order(self, data: pd.Series, max_p: int = 2, max_d: int = 1, max_q: int = 2, seasonal_periods: int = 12):
        try:
            best_aic = float('inf')
            best_order = ((1, 1, 1), (1, 1, 1, seasonal_periods))
            for p in range(max_p + 1):
                for d in range(max_d + 1):
                    for q in range(max_q + 1):
                        for P in range(2):
                            for D in range(2):
                                for Q in range(2):
                                    try:
                                        model = SARIMAX(
                                            data.squeeze(),
                                            order=(p, d, q),
                                            seasonal_order=(P, D, Q, seasonal_periods)
                                        )
                                        fitted_model = model.fit(disp=False)
                                        fitted_model = self._get_model_result(fitted_model)
                                        if not self._is_model_result(fitted_model):
                                            continue
                                        if hasattr(fitted_model, 'aic') and fitted_model.aic < best_aic:
                                            best_aic = fitted_model.aic
                                            best_order = ((p, d, q), (P, D, Q, seasonal_periods))
                                    except Exception:
                                        continue
            return best_order
        except Exception:
            return ((1, 1, 1), (1, 1, 1, 12))

    def _create_forecast_dates(self, last_date, steps: int):
        if not isinstance(last_date, pd.Timestamp):
            last_date = pd.Timestamp(last_date)
        # Ensure at least 1 step to avoid empty forecast ranges
        steps = max(1, int(steps) if steps is not None else 1)
        future_idx = pd.bdate_range(
            last_date + pd.offsets.BDay(1),
            periods=steps,
            freq="B"
        )
        return future_idx

    def train_arima(self, data: pd.Series, forecast_steps: int = 10):
        try:
            best_order = self.find_best_arima_order(data)
            model = ARIMA(data, order=best_order)
            self.fitted_model = model.fit()
            self.fitted_model = self._get_model_result(self.fitted_model)
            if not self._is_model_result(self.fitted_model):
                return None, None
            forecast_result = self.fitted_model.forecast(steps=forecast_steps) if hasattr(self.fitted_model, 'forecast') else None
            confidence_intervals = self.fitted_model.get_forecast(steps=forecast_steps).conf_int() if hasattr(self.fitted_model, 'get_forecast') else None
            last_date = data.index[-1]
            forecast_dates = self._create_forecast_dates(last_date, forecast_steps)
            predictions = {
                'forecast': pd.Series(forecast_result, index=forecast_dates) if forecast_result is not None else None,
                'lower_ci': pd.Series(confidence_intervals.iloc[:, 0], index=forecast_dates) if confidence_intervals is not None else None,
                'upper_ci': pd.Series(confidence_intervals.iloc[:, 1], index=forecast_dates) if confidence_intervals is not None else None
            }
            fitted_values = self.fitted_model.fittedvalues if hasattr(self.fitted_model, 'fittedvalues') else None
            residuals = data - fitted_values if fitted_values is not None else None
            metrics = {
                'AIC': float(self.fitted_model.aic) if hasattr(self.fitted_model, 'aic') else None,
                'BIC': float(self.fitted_model.bic) if hasattr(self.fitted_model, 'bic') else None,
                'RMSE': float(np.sqrt(np.mean(residuals**2))) if residuals is not None else None,
                'MAE': float(np.mean(np.abs(residuals))) if residuals is not None else None,
                'MAPE': float(np.mean(np.abs(residuals / data)) * 100) if residuals is not None else None
            }
            return predictions, metrics
        except Exception:
            return None, None

    def train_sarima(self, data: pd.Series, forecast_steps: int = 10):
        try:
            order, seasonal_order = self.find_best_sarima_order(data)
            model = SARIMAX(data.squeeze(), order=order, seasonal_order=seasonal_order)
            self.fitted_model = model.fit(disp=False)
            self.fitted_model = self._get_model_result(self.fitted_model)
            if not self._is_model_result(self.fitted_model):
                return None, None
            forecast_result = self.fitted_model.forecast(steps=forecast_steps) if hasattr(self.fitted_model, 'forecast') else None
            confidence_intervals = self.fitted_model.get_forecast(steps=forecast_steps).conf_int() if hasattr(self.fitted_model, 'get_forecast') else None
            last_date = data.index[-1]
            forecast_dates = self._create_forecast_dates(last_date, forecast_steps)
            predictions = {
                'forecast': pd.Series(forecast_result, index=forecast_dates) if forecast_result is not None else None,
                'lower_ci': pd.Series(confidence_intervals.iloc[:, 0], index=forecast_dates) if confidence_intervals is not None else None,
                'upper_ci': pd.Series(confidence_intervals.iloc[:, 1], index=forecast_dates) if confidence_intervals is not None else None
            }
            fitted_values = self.fitted_model.fittedvalues if hasattr(self.fitted_model, 'fittedvalues') else None
            residuals = data - fitted_values if fitted_values is not None else None
            metrics = {
                'AIC': float(self.fitted_model.aic) if hasattr(self.fitted_model, 'aic') else None,
                'BIC': float(self.fitted_model.bic) if hasattr(self.fitted_model, 'bic') else None,
                'RMSE': float(np.sqrt(np.mean(residuals**2))) if residuals is not None else None,
                'MAE': float(np.mean(np.abs(residuals))) if residuals is not None else None,
                'MAPE': float(np.mean(np.abs(residuals / data)) * 100) if residuals is not None else None
            }
            return predictions, metrics
        except Exception:
            return None, None

    def get_model_summary(self) -> str:
        if self.fitted_model is not None and self._is_model_result(self.fitted_model) and hasattr(self.fitted_model, 'summary'):
            return str(self.fitted_model.summary())
        return "No model trained yet"

    def validate_model(self, data: pd.Series) -> Dict[str, Any]:
        try:
            if self.fitted_model is None or not self._is_model_result(self.fitted_model) or not hasattr(self.fitted_model, 'resid'):
                return {"error": "No model trained yet"}
            residuals = self.fitted_model.resid
            ljung_box_result = acorr_ljungbox(residuals, lags=10, return_df=True)
            return {
                'residual_mean': float(np.mean(residuals)),
                'residual_std': float(np.std(residuals)),
                'ljung_box_pvalue': float(ljung_box_result['lb_pvalue'].iloc[-1]),
                'residual_normality': 'Normal' if abs(np.mean(residuals)) < 0.1 else 'Non-normal'
            }
        except Exception as e:
            return {"error": f"Validation error: {str(e)}"} 