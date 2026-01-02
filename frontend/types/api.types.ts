export interface ForecastPoint {
  date: string;
  price: number;
  lower_bound?: number;
  upper_bound?: number;
  std_dev?: number;
}

export interface HistoricalPoint {
  date: string;
  price: number;
}

export interface TrendData {
  direction: "up" | "down";
  percentage_change: number;
  recent_10d_change: number;
}

export interface AccuracyMetrics {
  rmse: number;
  mae: number;
  mape: number;
  test_size: number;
}

export interface PredictionData {
  symbol: string;
  live_price: number;
  live_time: string;
  historical: HistoricalPoint[];
  forecast: ForecastPoint[];
  predicted_t1: number;
  predicted_t10: number;
  trend: TrendData;
  volatility: number;
  confidence_score: number;
  confidence_level: number;
  accuracy_metrics?: AccuracyMetrics;
  model_info?: {
    arima_order: number[];
    sarima_seasonal_order: number[];
    ensemble_method: string;
  };
}
