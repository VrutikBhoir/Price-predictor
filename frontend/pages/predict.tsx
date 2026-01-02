import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import type { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// TypeScript interfaces
interface ForecastPoint {
  date: string;
  price: number;
  lower_bound?: number;
  upper_bound?: number;
  std_dev?: number;
}

interface HistoricalPoint {
  date: string;
  price: number;
}

interface TrendData {
  direction: "up" | "down";
  percentage_change: number;
  recent_10d_change: number;
}

interface AccuracyMetrics {
  rmse: number;
  mae: number;
  mape: number;
  test_size: number;
}

interface PredictionData {
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
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const REFRESH_INTERVAL = 60000; // 1 minute

export default function PredictPage() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [symbol, setSymbol] = useState<string>("AAPL");
  const [steps, setSteps] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrediction = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/predict/${symbol}?steps=${steps}`,
        {
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000), // 15s timeout
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result: PredictionData = await response.json();
      setData(result);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (err.name === "AbortError" || err.name === "TimeoutError") {
        setError("Request timeout. Please try again.");
      } else if (err.message.includes("Failed to fetch")) {
        setError("Unable to connect to server. Please check your connection.");
      } else {
        setError(err.message || "Failed to load prediction data");
      }
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, steps]);

  useEffect(() => {
    setIsLoading(true);
    fetchPrediction();

    const intervalId = setInterval(fetchPrediction, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchPrediction]);

  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol.toUpperCase());
    setIsLoading(true);
  };

  const handleStepsChange = (newSteps: number) => {
    setSteps(Math.max(1, Math.min(30, newSteps)));
    setIsLoading(true);
  };

  // Loading skeleton
  if (isLoading && !data) {
    return (
      <div className="container">
        <div className="header-skeleton">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-subtitle" />
        </div>
        <div className="metrics-skeleton">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
        <div className="skeleton skeleton-chart" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="error-container"
        >
          <div className="error-icon">⚠️</div>
          <h2>Unable to Load Predictions</h2>
          <p>{error}</p>
          <button onClick={fetchPrediction} className="retry-button">
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  if (!data) return null;

  // Prepare chart data
  const historicalData = data.historical.map((d) => ({
    x: new Date(d.date).getTime(),
    y: d.price,
  }));

  const forecastData = data.forecast.map((d) => ({
    x: new Date(d.date).getTime(),
    y: d.price,
  }));

  const confidenceLower = data.forecast.map((d) => ({
    x: new Date(d.date).getTime(),
    y: d.lower_bound || d.price,
  }));

  const confidenceUpper = data.forecast.map((d) => ({
    x: new Date(d.date).getTime(),
    y: d.upper_bound || d.price,
  }));

  // Chart configuration~
  const chartOptions: ApexOptions = {
    chart: {
      type: "line",
      background: "#0f172a",
      toolbar: {
        show: true,
        tools: {
          download: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
      animations: {
        enabled: true,
        easing: "easeinout",
        speed: 800,
      },
    },
    theme: {
      mode: "dark",
    },
    stroke: {
      width: [3, 3, 1, 1],
      dashArray: [0, 6, 0, 0],
      curve: "smooth",
    },
    colors: ["#3b82f6", "#f59e0b", "#10b981", "#10b981"],
    xaxis: {
      type: "datetime",
      labels: {
        datetimeFormatter: {
          year: "yyyy",
          month: "MMM 'yy",
          day: "dd MMM",
          hour: "HH:mm",
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `$${val.toFixed(2)}`,
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      x: {
        format: "dd MMM yyyy",
      },
      y: {
        formatter: (val: number) => `$${val.toFixed(2)}`,
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "center",
    },
    grid: {
      borderColor: "#1e293b",
      strokeDashArray: 4,
    },
    fill: {
      type: ["solid", "solid", "gradient", "gradient"],
      opacity: [1, 1, 0.1, 0.1],
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 100],
      },
    },
  };

  const series = [
    {
      name: "Historical Price",
      type: "line",
      data: historicalData,
    },
    {
      name: "Predicted Price",
      type: "line",
      data: forecastData,
    },
    {
      name: "Confidence Lower",
      type: "area",
      data: confidenceLower,
    },
    {
      name: "Confidence Upper",
      type: "area",
      data: confidenceUpper,
    },
  ];

  const priceChange = data.live_price - data.historical[data.historical.length - 2]?.price || 0;
  const priceChangePercent = (priceChange / (data.historical[data.historical.length - 2]?.price || 1)) * 100;

  return (
    <div className="container">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="header"
      >
        <div className="title-section">
          <h1>Stock Price Prediction</h1>
          <p className="subtitle">AI-powered forecasting using ARIMA & SARIMAX models</p>
        </div>

        <div className="controls">
          <div className="input-group">
            <label htmlFor="symbol">Symbol</label>
            <input
              id="symbol"
              type="text"
              value={symbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              placeholder="AAPL"
              className="symbol-input"
            />
          </div>

          <div className="input-group">
            <label htmlFor="steps">Days</label>
            <input
              id="steps"
              type="number"
              value={steps}
              onChange={(e) => handleStepsChange(parseInt(e.target.value))}
              min="1"
              max="30"
              className="steps-input"
            />
          </div>
        </div>
      </motion.div>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <MetricCard
          title="Live Price"
          value={`$${data.live_price.toFixed(2)}`}
          subtitle={
            <span className={priceChange >= 0 ? "positive" : "negative"}>
              {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChangePercent).toFixed(2)}%
            </span>
          }
          icon="💰"
        />

        <MetricCard
          title="Next Day (T+1)"
          value={`$${data.predicted_t1.toFixed(2)}`}
          subtitle={
            <span className={data.predicted_t1 > data.live_price ? "positive" : "negative"}>
              {data.predicted_t1 > data.live_price ? "▲" : "▼"}{" "}
              {Math.abs(((data.predicted_t1 - data.live_price) / data.live_price) * 100).toFixed(2)}%
            </span>
          }
          icon="📈"
        />

        <MetricCard
          title={`${steps}-Day Forecast`}
          value={`$${data.predicted_t10.toFixed(2)}`}
          subtitle={
            <span className={data.trend.direction === "up" ? "positive" : "negative"}>
              {data.trend.direction === "up" ? "▲" : "▼"} {Math.abs(data.trend.percentage_change).toFixed(2)}%
            </span>
          }
          icon="🎯"
        />

        <MetricCard
          title="Confidence Score"
          value={`${data.confidence_score.toFixed(1)}%`}
          subtitle={
            <span>
              Volatility: ${data.volatility.toFixed(2)}
            </span>
          }
          icon="🔒"
        />
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="chart-container"
      >
        <div className="chart-header">
          <h2>{data.symbol} Price Forecast</h2>
          {lastUpdated && (
            <span className="last-updated">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <Chart options={chartOptions} series={series} height={480} type="line" />
      </motion.div>

      {/* Accuracy Metrics */}
      {data.accuracy_metrics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="accuracy-section"
        >
          <h3>Model Performance Metrics</h3>
          <div className="accuracy-grid">
            <div className="accuracy-card">
              <span className="label">RMSE</span>
              <span className="value">{data.accuracy_metrics.rmse.toFixed(4)}</span>
            </div>
            <div className="accuracy-card">
              <span className="label">MAE</span>
              <span className="value">{data.accuracy_metrics.mae.toFixed(4)}</span>
            </div>
            <div className="accuracy-card">
              <span className="label">MAPE</span>
              <span className="value">{data.accuracy_metrics.mape.toFixed(2)}%</span>
            </div>
          </div>
        </motion.div>
      )}

      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
          background: #020617;
          min-height: 100vh;
          color: #e2e8f0;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1.5rem;
        }

        .title-section h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin: 0;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          color: #94a3b8;
          margin-top: 0.5rem;
        }

        .controls {
          display: flex;
          gap: 1rem;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .input-group label {
          font-size: 0.875rem;
          color: #94a3b8;
          font-weight: 500;
        }

        .symbol-input,
        .steps-input {
          padding: 0.75rem 1rem;
          background: #1e293b;
          border: 2px solid #334155;
          border-radius: 0.5rem;
          color: #e2e8f0;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .symbol-input {
          width: 120px;
          text-transform: uppercase;
        }

        .steps-input {
          width: 100px;
        }

        .symbol-input:focus,
        .steps-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .chart-container {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 1rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .chart-header h2 {
          font-size: 1.5rem;
          margin: 0;
        }

        .last-updated {
          font-size: 0.875rem;
          color: #64748b;
        }

        .accuracy-section {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 1rem;
          padding: 1.5rem;
        }

        .accuracy-section h3 {
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1.25rem;
        }

        .accuracy-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .accuracy-card {
          display: flex;
          flex-direction: column;
          padding: 1rem;
          background: #1e293b;
          border-radius: 0.5rem;
          text-align: center;
        }

        .accuracy-card .label {
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }

        .accuracy-card .value {
          font-size: 1.5rem;
          font-weight: 600;
          color: #3b82f6;
        }

        .positive {
          color: #10b981;
        }

        .negative {
          color: #ef4444;
        }

        .error-container {
          text-align: center;
          padding: 4rem 2rem;
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 1rem;
          margin: 2rem 0;
        }

        .error-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .error-container h2 {
          color: #ef4444;
          margin-bottom: 1rem;
        }

        .retry-button {
          margin-top: 1.5rem;
          padding: 0.75rem 2rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .retry-button:hover {
          background: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .header-skeleton,
        .metrics-skeleton {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .skeleton {
          background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 0.5rem;
        }

        .skeleton-title {
          height: 3rem;
          width: 300px;
        }

        .skeleton-card {
          height: 120px;
          flex: 1;
        }

        .skeleton-chart {
          height: 500px;
          width: 100%;
        }

        @keyframes loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @media (max-width: 768px) {
          .header {
            flex-direction: column;
            align-items: flex-start;
          }

          .title-section h1 {
            font-size: 1.75rem;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

// Reusable MetricCard component
interface MetricCardProps {
  title: string;
  value: string;
  subtitle: React.ReactNode;
  icon: string;
}

function MetricCard({ title, value, subtitle, icon }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="metric-card"
    >
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <h3>{title}</h3>
        <p className="metric-value">{value}</p>
        <div className="metric-subtitle">{subtitle}</div>
      </div>

      <style jsx>{`
        .metric-card {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border: 1px solid #334155;
          border-radius: 1rem;
          padding: 1.5rem;
          display: flex;
          gap: 1rem;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .metric-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.15);
        }

        .metric-icon {
          font-size: 2.5rem;
          line-height: 1;
        }

        .metric-content {
          flex: 1;
        }

        .metric-content h3 {
          margin: 0;
          font-size: 0.875rem;
          color: #94a3b8;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metric-value {
          margin: 0.5rem 0;
          font-size: 2rem;
          font-weight: 700;
          color: #e2e8f0;
          line-height: 1;
        }

        .metric-subtitle {
          font-size: 0.875rem;
          font-weight: 600;
        }
      `}</style>
    </motion.div>
  );
}
