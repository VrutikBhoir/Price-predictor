import pandas as pd
import numpy as np


class TechnicalIndicators:
    def __init__(self):
        pass

    def calculate_sma(self, data, window=20):
        try:
            return data.rolling(window=window).mean()
        except Exception:
            return pd.Series(index=data.index)

    def calculate_ema(self, data, window=20):
        try:
            return data.ewm(span=window).mean()
        except Exception:
            return pd.Series(index=data.index)

    def calculate_rsi(self, data, window=14):
        try:
            delta = data.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return rsi
        except Exception:
            return pd.Series(index=data.index)

    def calculate_macd(self, data, fast_period=12, slow_period=26, signal_period=9):
        try:
            ema_fast = self.calculate_ema(data, fast_period)
            ema_slow = self.calculate_ema(data, slow_period)
            macd_line = ema_fast - ema_slow
            signal_line = self.calculate_ema(macd_line, signal_period)
            histogram = macd_line - signal_line
            return {
                'MACD': macd_line,
                'MACD_Signal': signal_line,
                'MACD_Histogram': histogram
            }
        except Exception:
            return {
                'MACD': pd.Series(index=data.index),
                'MACD_Signal': pd.Series(index=data.index),
                'MACD_Histogram': pd.Series(index=data.index)
            }

    def calculate_bollinger_bands(self, data, window=20, num_std=2):
        try:
            sma = self.calculate_sma(data, window)
            std = data.rolling(window=window).std()
            upper_band = sma + (std * num_std)
            lower_band = sma - (std * num_std)
            return {
                'BB_Upper': upper_band,
                'BB_Middle': sma,
                'BB_Lower': lower_band
            }
        except Exception:
            return {
                'BB_Upper': pd.Series(index=data.index),
                'BB_Middle': pd.Series(index=data.index),
                'BB_Lower': pd.Series(index=data.index)
            } 