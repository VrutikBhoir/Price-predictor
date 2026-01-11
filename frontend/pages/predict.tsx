import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import Head from "next/head";
import type { ApexOptions } from "apexcharts";
import { POPULAR_STOCKS } from "../data/stocks";

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

interface TechnicalIndicators {
  dates: string[];
  sma_20: number[];
  ema_20: number[];
  rsi: number[];
  macd: number[];
  macd_signal: number[];
  macd_hist: number[];
  bb_upper: number[];
  bb_lower: number[];
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
  indicators?: TechnicalIndicators;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function PredictPage() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [symbol, setSymbol] = useState<string>("AAPL");
  const [steps, setSteps] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Autocomplete State
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const filteredStocks = POPULAR_STOCKS.filter(stock =>
    stock.symbol.includes(symbol.toUpperCase()) ||
    stock.name.toLowerCase().includes(symbol.toLowerCase())
  ).slice(0, 5);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPrediction = useCallback(async (overrideSymbol?: string) => {
    const targetSymbol = overrideSymbol || symbol;

    if (!targetSymbol || targetSymbol.trim() === "") {
      setError("Please enter a stock ticker symbol (e.g., AAPL)");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/predict/${targetSymbol}?steps=${steps}`,
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

  // Initial load
  useEffect(() => {
    fetchPrediction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only ONCE on mount

  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol.toUpperCase());
    setShowSuggestions(true);
  };

  const selectStock = (stockSymbol: string) => {
    setSymbol(stockSymbol);
    setShowSuggestions(false);
  };

  const handleStepsChange = (newSteps: number) => {
    setSteps(Math.max(1, Math.min(30, newSteps)));
  };

  const historicalData = data?.historical.map((point) => ({
    x: new Date(point.date).getTime(),
    y: point.price,
  })) || [];

  const forecastData = data?.forecast.map((point) => ({
    x: new Date(point.date).getTime(),
    y: point.price,
  })) || [];

  const confidenceLower = data?.forecast.map((point) => ({
    x: new Date(point.date).getTime(),
    y: point.lower_bound || point.price,
  })) || [];

  const confidenceUpper = data?.forecast.map((point) => ({
    x: new Date(point.date).getTime(),
    y: point.upper_bound || point.price,
  })) || [];

  // Indicators Data Preparation
  const indicators = data?.indicators;

  const rsiData = indicators?.rsi.map((val, i) => ({
    x: new Date(indicators.dates[i]).getTime(),
    y: val
  })).slice(-60) || [];

  const macdData = indicators?.macd.map((val, i) => ({
    x: new Date(indicators.dates[i]).getTime(),
    y: val
  })).slice(-60) || [];

  const macdSignal = indicators?.macd_signal.map((val, i) => ({
    x: new Date(indicators.dates[i]).getTime(),
    y: val
  })).slice(-60) || [];

  const macdHist = indicators?.macd_hist.map((val, i) => ({
    x: new Date(indicators.dates[i]).getTime(),
    y: val
  })).slice(-60) || [];


  const chartOptions: ApexOptions = {
    chart: {
      type: "line",
      background: "transparent",
      height: 450,
      toolbar: { show: false },
      animations: {
        enabled: true,
        dynamicAnimation: {
          speed: 1000,
        },
      },
      fontFamily: "Inter, sans-serif",
    },
    theme: {
      mode: "dark",
      palette: "palette1",
    },
    stroke: {
      width: [2, 3, 0, 0], // Made forecast thicker (3px)
      dashArray: [0, 5, 0, 0],
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
        },
        style: { colors: "#94a3b8" }
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `$${val.toFixed(2)}`,
        style: { colors: "#94a3b8" }
      },
      tooltip: { enabled: true }
    },
    tooltip: {
      theme: "dark",
      shared: true,
      intersect: false,
      x: { format: "dd MMM yyyy" },
      y: { formatter: (val: number) => `$${val.toFixed(2)}` },
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
    legend: { show: true, position: 'top', horizontalAlign: 'right' }
  };

  const series = [
    { name: "Historical Price", type: "line", data: historicalData.slice(-100) }, // Limit visual noise
    { name: "Predicted Price", type: "line", data: forecastData },
    { name: "Confidence Lower", type: "area", data: confidenceLower },
    { name: "Confidence Upper", type: "area", data: confidenceUpper },
  ];

  // RSI Chart Options
  const rsiOptions: ApexOptions = {
    chart: { type: "line", height: 150, background: "transparent", toolbar: { show: false } },
    theme: { mode: "dark" },
    stroke: { width: 2, curve: "smooth" },
    colors: ["#8b5cf6"],
    yaxis: { min: 0, max: 100, tickAmount: 2, labels: { style: { colors: "#64748b" } } },
    xaxis: { type: "datetime", labels: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false } },
    grid: { borderColor: "#1e293b", strokeDashArray: 4 },
    annotations: {
      yaxis: [
        { y: 70, borderColor: '#ef4444', label: { text: 'Overbought', style: { color: '#fff', background: '#ef4444' } } },
        { y: 30, borderColor: '#10b981', label: { text: 'Oversold', style: { color: '#fff', background: '#10b981' } } }
      ]
    }
  };

  // MACD Chart Options
  const macdOptions: ApexOptions = {
    chart: { type: "line", height: 150, background: "transparent", toolbar: { show: false } },
    theme: { mode: "dark" },
    stroke: { width: [2, 2], curve: "straight" },
    colors: ["#3b82f6", "#f59e0b", "#10b981"], // MACD, Signal, Hist
    yaxis: { labels: { style: { colors: "#64748b" } } },
    xaxis: { type: "datetime", labels: { style: { colors: "#64748b" } }, tooltip: { enabled: false } },
    grid: { borderColor: "#1e293b", strokeDashArray: 4 },
    plotOptions: {
      bar: { colors: { ranges: [{ from: -1000, to: 0, color: '#ef4444' }, { from: 0, to: 1000, color: '#10b981' }] } }
    },
    legend: { show: true, position: 'top', horizontalAlign: 'left' }
  };

  const macdSeries = [
    { name: "MACD", type: "line", data: macdData },
    { name: "Signal", type: "line", data: macdSignal },
    { name: "Histogram", type: "bar", data: macdHist }
  ];


  const priceChange = data ? (data.live_price - (data.historical[data.historical.length - 2]?.price || data.live_price)) : 0;
  const priceChangePercent = data ? (priceChange / (data.historical[data.historical.length - 2]?.price || 1)) * 100 : 0;


  return (
    <div className="container">
      <Head>
        <title>Stock Predictor | AI Dashboard</title>
      </Head>

      <main>
        {/* Top Header Row */}
        <div className="top-bar">
          <div className="branding">
            <h1>Stock Price Prediction</h1>
            <p>AI-powered forecasting using ARIMA & SARIMAX models</p>
          </div>

          <div className="search-actions">
            <div className="search-box" ref={searchContainerRef}>
              <span className="search-icon">🔍</span>
              <input
                type="text"
                value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowSuggestions(false);
                    fetchPrediction();
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="ENTER TICKER (E.G. AAPL)"
              />

              <AnimatePresence>
                {showSuggestions && symbol && filteredStocks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="suggestions-dropdown"
                  >
                    {filteredStocks.map((stock) => (
                      <div
                        key={stock.symbol}
                        className="suggestion-item"
                        onClick={() => selectStock(stock.symbol)}
                      >
                        <span className="suggestion-symbol">{stock.symbol}</span>
                        <span className="suggestion-name">{stock.name}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="days-input">
              <span className="label">Days</span>
              <input
                type="number"
                value={steps}
                onChange={(e) => handleStepsChange(Number(e.target.value))}
                min="1" max="30"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchPrediction()}
              disabled={isLoading}
              className={`predict-btn ${isLoading ? 'loading' : ''}`}
            >
              {isLoading ? 'ANALYZING...' : 'PREDICT'}
            </motion.button>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Stats Grid */}
        {data && (
          <div className="stats-grid">
            <MetricCard
              title="Live Price"
              value={`$${data.live_price.toFixed(2)}`}
              subtitle={
                <span className={priceChange >= 0 ? "trend-up" : "trend-down"}>
                  {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChangePercent).toFixed(2)}%
                </span>
              }
              icon="💰"
            />
            <MetricCard
              title="Next Day (T+1)"
              value={`$${data.predicted_t1.toFixed(2)}`}
              subtitle={<span className="sub-text">Target for tomorrow</span>}
              icon="📈"
            />
            <MetricCard
              title={`${steps}-Day Forecast`}
              value={`$${data.predicted_t10.toFixed(2)}`}
              subtitle={<span className="sub-text">Long term target</span>}
              icon="🎯"
            />
            <MetricCard
              title="AI Confidence"
              value={`${Math.min(100, data.confidence_score).toFixed(1)}%`}
              subtitle={<span className="sub-text">Model Accuracy</span>}
              icon="🧠"
            />
          </div>
        )}

        {/* Charts Container */}
        <div className="charts-wrapper">

          {/* Main Price Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <h2>{data ? data.symbol : symbol || "Stock"} Price Forecast</h2>
              {data && <div className="last-updated">Updated: {new Date().toLocaleTimeString()}</div>}
            </div>

            <div className="chart-content">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Calculating Technical Indicators...</p>
                </div>
              ) : data ? (
                <Chart options={chartOptions} series={series} height={400} type="line" />
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📊</div>
                  <p>Enter a stock symbol to generate predictions</p>
                </div>
              )}
            </div>
          </div>

          {/* Technical Indicators */}
          {data && data.indicators && (
            <>
              <div className="chart-card">
                <div className="chart-header small">
                  <h3>RSI (14) - Relative Strength Index</h3>
                </div>
                <Chart options={rsiOptions} series={[{ name: 'RSI', data: rsiData }]} height={180} type="line" />
              </div>

              <div className="chart-card">
                <div className="chart-header small">
                  <h3>MACD (12, 26, 9) - Momentum</h3>
                </div>
                <Chart options={macdOptions} series={macdSeries} height={180} type="line" />
              </div>
            </>
          )}

        </div>

      </main>

      <style jsx>{`
        .container {
          min-height: 100vh;
          background-color: #020617;
          color: white;
          padding: 2rem;
          font-family: 'Inter', sans-serif;
        }

        .top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3rem;
            flex-wrap: wrap;
            gap: 2rem;
        }

        .branding h1 {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(to right, #22d3ee, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
            letter-spacing: -1px;
        }

        .branding p {
            color: #94a3b8;
            margin: 0.5rem 0 0 0;
            font-size: 0.9rem;
        }

        .search-actions {
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap;
        }

        .search-box {
            position: relative;
            width: 300px;
            z-index: 50;
        }

        .search-icon {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: #64748b;
        }

        .search-box input {
            width: 100%;
            padding: 0.8rem 1rem 0.8rem 2.5rem;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 0.75rem;
            color: white;
            font-family: 'JetBrains Mono', monospace;
            text-transform: uppercase;
            outline: none;
            transition: all 0.2s;
        }

        .search-box input:focus {
            border-color: #22d3ee;
            box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.1);
        }

        .suggestions-dropdown {
            position: absolute;
            top: 110%;
            left: 0;
            right: 0;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 0.75rem;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            max-height: 300px;
            overflow-y: auto;
        }

        .suggestion-item {
            padding: 0.75rem 1rem;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #334155;
            transition: background 0.2s;
        }

        .suggestion-item:last-child {
            border-bottom: none;
        }

        .suggestion-item:hover {
            background: #334155;
        }

        .suggestion-symbol {
            font-weight: bold;
            color: #22d3ee;
        }

        .suggestion-name {
            font-size: 0.8rem;
            color: #94a3b8;
        }

        .days-input {
            display: flex;
            align-items: center;
            background: #1e293b;
            border: 1px solid #334155;
            padding: 0.4rem 0.8rem;
            border-radius: 0.75rem;
            gap: 0.5rem;
        }

         .days-input .label {
            font-size: 0.75rem;
            color: #94a3b8;
            text-transform: uppercase;
            font-weight: 600;
         }

        .days-input input {
            background: transparent;
            border: none;
            color: white;
            width: 3rem;
            text-align: center;
            outline: none;
            font-weight: bold;
        }

        .predict-btn {
            background: linear-gradient(135deg, #06b6d4, #2563eb);
            border: none;
            padding: 0.8rem 2rem;
            border-radius: 0.75rem;
            color: white;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(6, 182, 212, 0.3);
            transition: all 0.2s;
            font-size: 0.9rem;
            letter-spacing: 0.05em;
        }

        .predict-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(6, 182, 212, 0.4);
        }

        .predict-btn.loading {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .trend-up { color: #4ade80; font-weight: 600; }
        .trend-down { color: #f87171; font-weight: 600; }
        .sub-text { color: #64748b; font-size: 0.8rem; }

        .charts-wrapper {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .chart-card {
            background: rgba(30, 41, 59, 0.4);
            backdrop-filter: blur(10px);
            border: 1px solid #334155;
            border-radius: 1.5rem;
            padding: 2rem;
        }

        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }

        .chart-header.small h3 {
            font-size: 1rem;
            color: #94a3b8;
            margin: 0;
        }

        .chart-header h2 {
            margin: 0;
            font-size: 1.25rem;
            color: #e2e8f0;
        }

        .last-updated {
            font-size: 0.8rem;
            color: #64748b;
            background: #0f172a;
            padding: 0.3rem 0.6rem;
            border-radius: 0.3rem;
        }

        .loading-state, .empty-state {
            height: 400px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #64748b;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.1);
            border-radius: 50%;
            border-top-color: #22d3ee;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }

        .error-banner {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            color: #fca5a5;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 2rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
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
