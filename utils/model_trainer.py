import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller
from statsmodels.stats.diagnostic import acorr_ljungbox
import warnings
warnings.filterwarnings('ignore')
import streamlit as st
import datetime

class ModelTrainer:
    def __init__(self):
        self.model = None
        self.fitted_model = None
    
    def _is_model_result(self, obj):
        # Check if the object is a statsmodels result (has .aic, .bic, etc.)
        return hasattr(obj, 'aic')

    def _get_model_result(self, obj):
        # If fit returns a tuple, get the first element; otherwise return as is
        if isinstance(obj, tuple):
            return obj[0]
        return obj

    def check_stationarity(self, data):
        try:
            result = adfuller(data.dropna())
            p_value = result[1]
            return p_value < 0.05
        except:
            return False
    
    def make_stationary(self, data):
        try:
            diff_data = data.diff().dropna()
            if self.check_stationarity(diff_data):
                return diff_data
            diff2_data = diff_data.diff().dropna()
            return diff2_data
        except Exception as e:
            st.error(f"Error making data stationary: {str(e)}")
            return data

    def find_best_arima_order(self, data, max_p=5, max_d=2, max_q=5):
        try:
            best_aic = float('inf')
            best_order = (1, 1, 1)
            progress_bar = st.progress(0)
            status_text = st.empty()
            total_combinations = (max_p + 1) * (max_d + 1) * (max_q + 1)
            current_combination = 0
            for p in range(max_p + 1):
                for d in range(max_d + 1):
                    for q in range(max_q + 1):
                        current_combination += 1
                        progress = current_combination / total_combinations
                        progress_bar.progress(progress)
                        status_text.text(f"Testing ARIMA({p},{d},{q})...")
                        try:
                            model = ARIMA(data, order=(p, d, q))
                            fitted_model = model.fit()
                            if fitted_model.aic < best_aic:
                                best_aic = fitted_model.aic
                                best_order = (p, d, q)
                        except:
                            continue
            progress_bar.empty()
            status_text.empty()
            return best_order
        except Exception as e:
            st.error(f"Error finding best ARIMA order: {str(e)}")
            return (1, 1, 1)
    
    def find_best_sarima_order(self, data, max_p=3, max_d=2, max_q=3, seasonal_periods=12):
        try:
            best_aic = float('inf')
            best_order = ((1, 1, 1), (1, 1, 1, seasonal_periods))
            progress_bar = st.progress(0)
            status_text = st.empty()
            total_combinations = (max_p + 1) * (max_d + 1) * (max_q + 1) * 2 * 2 * 2
            current_combination = 0
            for p in range(max_p + 1):
                for d in range(max_d + 1):
                    for q in range(max_q + 1):
                        for P in range(2):
                            for D in range(2):
                                for Q in range(2):
                                    current_combination += 1
                                    progress = current_combination / total_combinations
                                    progress_bar.progress(progress)
                                    status_text.text(f"Testing SARIMA({p},{d},{q})x({P},{D},{Q},{seasonal_periods})...")
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
                                        # Only access .aic if valid
                                        if self._is_model_result(fitted_model) and hasattr(fitted_model, 'aic'):
                                            if fitted_model.aic < best_aic:
                                                best_aic = fitted_model.aic
                                                best_order = ((p, d, q), (P, D, Q, seasonal_periods))
                                    except:
                                        continue
            progress_bar.empty()
            status_text.empty()
            return best_order
        except Exception as e:
            st.error(f"Error finding best SARIMA order: {str(e)}")
            return ((1, 1, 1), (1, 1, 1, 12))

    def _create_forecast_dates(self, last_date, steps):
        if not isinstance(last_date, pd.Timestamp):
            last_date = pd.Timestamp(last_date)
        future_idx = pd.bdate_range(
            last_date + pd.offsets.BDay(1),
            periods=steps,
            freq="B"
        )
        return future_idx

    def train_arima(self, data, forecast_steps=10):
        try:
            st.write("Finding optimal ARIMA parameters...")
            best_order = self.find_best_arima_order(data)
            st.write(f"Best ARIMA order: {best_order}")
            st.write("Training ARIMA model...")
            model = ARIMA(data, order=best_order)
            self.fitted_model = model.fit()
            self.fitted_model = self._get_model_result(self.fitted_model)
            if not self._is_model_result(self.fitted_model):
                st.error("Model fitting failed.")
                return None, None
            # Only access attributes if valid
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
                'AIC': self.fitted_model.aic if hasattr(self.fitted_model, 'aic') else None,
                'BIC': self.fitted_model.bic if hasattr(self.fitted_model, 'bic') else None,
                'RMSE': np.sqrt(np.mean(residuals**2)) if residuals is not None else None,
                'MAE': np.mean(np.abs(residuals)) if residuals is not None else None,
                'MAPE': np.mean(np.abs(residuals / data)) * 100 if residuals is not None else None
            }
            return predictions, metrics
        except Exception as e:
            st.error(f"Error training ARIMA model: {str(e)}")
            return None, None

    def train_sarima(self, data, forecast_steps=10):
        try:
            st.write("Finding optimal SARIMA parameters...")
            best_order = self.find_best_sarima_order(data)
            order, seasonal_order = best_order
            st.write(f"Best SARIMA order: {order}x{seasonal_order}")
            st.write("Training SARIMA model...")
            model = SARIMAX(data.squeeze(), order=order, seasonal_order=seasonal_order)
            self.fitted_model = model.fit(disp=False)
            self.fitted_model = self._get_model_result(self.fitted_model)
            if not self._is_model_result(self.fitted_model):
                st.error("Model fitting failed.")
                return None, None
            # Only access attributes if valid
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
                'AIC': self.fitted_model.aic if hasattr(self.fitted_model, 'aic') else None,
                'BIC': self.fitted_model.bic if hasattr(self.fitted_model, 'bic') else None,
                'RMSE': np.sqrt(np.mean(residuals**2)) if residuals is not None else None,
                'MAE': np.mean(np.abs(residuals)) if residuals is not None else None,
                'MAPE': np.mean(np.abs(residuals / data)) * 100 if residuals is not None else None
            }
            return predictions, metrics
        except Exception as e:
            st.error(f"Error training SARIMA model: {str(e)}")
            return None, None

    def get_model_summary(self):
        if self.fitted_model is not None and self._is_model_result(self.fitted_model) and hasattr(self.fitted_model, 'summary'):
            return str(self.fitted_model.summary())
        return "No model trained yet"
    
    def validate_model(self, data):
        try:
            if self.fitted_model is None or not self._is_model_result(self.fitted_model) or not hasattr(self.fitted_model, 'resid'):
                return {"error": "No model trained yet"}
            residuals = self.fitted_model.resid
            ljung_box_result = acorr_ljungbox(residuals, lags=10, return_df=True)
            validation_results = {
                'residual_mean': np.mean(residuals),
                'residual_std': np.std(residuals),
                'ljung_box_pvalue': ljung_box_result['lb_pvalue'].iloc[-1],
                'residual_normality': 'Normal' if abs(np.mean(residuals)) < 0.1 else 'Non-normal'
            }
            return validation_results
        except Exception as e:
            return {"error": f"Validation error: {str(e)}"}
