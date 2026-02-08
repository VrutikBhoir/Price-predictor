import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import Head from "next/head";
import type { ApexOptions } from "apexcharts";
import { POPULAR_STOCKS } from "../data/stocks";
import axios from "axios";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

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

interface InvestmentRecommendation {
  action: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  description: string;
  confidence: "high" | "medium" | "low";
}

interface InvestmentScores {
  technical: number;
  trend: number;
  risk: number;
  momentum: number;
}

interface RiskAssessment {
  level: "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH";
  volatility: number;
  confidence: number;
}

interface ExpectedPerformance {
  short_term_return: number;
  medium_term_return: number;
  risk_reward_ratio: number;
}

interface EntryExitStrategy {
  entry_points: {
    optimal: number;
    acceptable: number;
  };
  exit_points: {
    target: number;
    stop_loss: number;
  };
}

interface InvestmentAnalysis {
  symbol: string;
  recommendation: InvestmentRecommendation;
  overall_score: number;
  investment_horizon: string;
  scores: InvestmentScores;
  risk_assessment: RiskAssessment;
  expected_performance: ExpectedPerformance;
  entry_exit_strategy: EntryExitStrategy;
  reasoning: string[];
  key_insights: string[];
  warnings: string[];
}

interface CombinedResponse {
  prediction: PredictionData;
  investment_analysis: InvestmentAnalysis;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

// Configure axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
  },
});

// Add response interceptor for global error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNABORTED") {
      throw new Error("Request timeout. Please try again.");
    } else if (error.response) {
      // Server responded with error status
      const message = error.response.data?.detail || error.response.data?.message || error.message;
      throw new Error(message);
    } else if (error.request) {
      // Request made but no response received
      throw new Error("Unable to connect to server. Please check your connection.");
    } else {
      throw new Error(error.message || "An unexpected error occurred");
    }
  }
);

function PredictPage() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [analysis, setAnalysis] = useState<InvestmentAnalysis | null>(null);
  const [symbol, setSymbol] = useState<string>("AAPL");
  const [steps, setSteps] = useState<number>(10);
  const [investmentHorizon, setInvestmentHorizon] =
    useState<string>("medium_term");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"charts" | "analysis">("charts");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const filteredStocks = POPULAR_STOCKS.filter(
    (stock) =>
      stock.symbol.includes(symbol.toUpperCase()) ||
      stock.name.toLowerCase().includes(symbol.toLowerCase())
  ).slice(0, 5);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPrediction = useCallback(
    async (overrideSymbol?: string) => {
      const targetSymbol = overrideSymbol || symbol;

      if (!targetSymbol || targetSymbol.trim() === "") {
        setError("Please enter a stock ticker symbol (e.g., AAPL)");
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await apiClient.get<CombinedResponse>(
          `/predict/${targetSymbol}`,
          {
            params: { steps },
          }
        );

        setData(response.data.prediction);
        setAnalysis(response.data.investment_analysis);
      } catch (err: any) {
        setError(err.message || "Failed to load prediction data");
        console.error("API error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [symbol, steps]
  );

  useEffect(() => {
    fetchPrediction();
  }, []);

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

  const historicalData =
    data?.historical.map((point) => ({
      x: new Date(point.date).getTime(),
      y: point.price,
    })) || [];

  const forecastData =
    data?.forecast.map((point) => ({
      x: new Date(point.date).getTime(),
      y: point.price,
    })) || [];

  const confidenceLower =
    data?.forecast.map((point) => ({
      x: new Date(point.date).getTime(),
      y: point.lower_bound || point.price,
    })) || [];

  const confidenceUpper =
    data?.forecast.map((point) => ({
      x: new Date(point.date).getTime(),
      y: point.upper_bound || point.price,
    })) || [];

  const indicators = data?.indicators;

  const rsiData =
    indicators?.rsi
      .map((val, i) => ({
        x: new Date(indicators.dates[i]).getTime(),
        y: val,
      }))
      .slice(-60) || [];

  const macdData =
    indicators?.macd
      .map((val, i) => ({
        x: new Date(indicators.dates[i]).getTime(),
        y: val,
      }))
      .slice(-60) || [];

  const macdSignal =
    indicators?.macd_signal
      .map((val, i) => ({
        x: new Date(indicators.dates[i]).getTime(),
        y: val,
      }))
      .slice(-60) || [];

  const macdHist =
    indicators?.macd_hist
      .map((val, i) => ({
        x: new Date(indicators.dates[i]).getTime(),
        y: val,
      }))
      .slice(-60) || [];

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
      width: [2, 3, 0, 0],
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
        style: { colors: "#94a3b8" },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `$${val.toFixed(2)}`,
        style: { colors: "#94a3b8" },
      },
      tooltip: { enabled: true },
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
    legend: { show: true, position: "top", horizontalAlign: "right" },
  };

  const series = [
    {
      name: "Historical Price",
      type: "line",
      data: historicalData.slice(-100),
    },
    { name: "Predicted Price", type: "line", data: forecastData },
    { name: "Confidence Lower", type: "area", data: confidenceLower },
    { name: "Confidence Upper", type: "area", data: confidenceUpper },
  ];

  const rsiOptions: ApexOptions = {
    chart: {
      type: "line",
      height: 150,
      background: "transparent",
      toolbar: { show: false },
    },
    theme: { mode: "dark" },
    stroke: { width: 2, curve: "smooth" },
    colors: ["#8b5cf6"],
    yaxis: {
      min: 0,
      max: 100,
      tickAmount: 2,
      labels: { style: { colors: "#64748b" } },
    },
    xaxis: {
      type: "datetime",
      labels: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    grid: { borderColor: "#1e293b", strokeDashArray: 4 },
    annotations: {
      yaxis: [
        {
          y: 70,
          borderColor: "#ef4444",
          label: {
            text: "Overbought",
            style: { color: "#fff", background: "#ef4444" },
          },
        },
        {
          y: 30,
          borderColor: "#10b981",
          label: {
            text: "Oversold",
            style: { color: "#fff", background: "#10b981" },
          },
        },
      ],
    },
  };

  const macdOptions: ApexOptions = {
    chart: {
      type: "line",
      height: 150,
      background: "transparent",
      toolbar: { show: false },
    },
    theme: { mode: "dark" },
    stroke: { width: [2, 2], curve: "straight" },
    colors: ["#3b82f6", "#f59e0b", "#10b981"],
    yaxis: { labels: { style: { colors: "#64748b" } } },
    xaxis: {
      type: "datetime",
      labels: { style: { colors: "#64748b" } },
      tooltip: { enabled: false },
    },
    grid: { borderColor: "#1e293b", strokeDashArray: 4 },
    plotOptions: {
      bar: {
        colors: {
          ranges: [
            { from: -1000, to: 0, color: "#ef4444" },
            { from: 0, to: 1000, color: "#10b981" },
          ],
        },
      },
    },
    legend: { show: true, position: "top", horizontalAlign: "left" },
  };

  const macdSeries = [
    { name: "MACD", type: "line", data: macdData },
    { name: "Signal", type: "line", data: macdSignal },
    { name: "Histogram", type: "bar", data: macdHist },
  ];

  const priceChange = data
    ? data.live_price -
      (data.historical[data.historical.length - 2]?.price || data.live_price)
    : 0;
  const priceChangePercent = data
    ? (priceChange /
        (data.historical[data.historical.length - 2]?.price || 1)) *
      100
    : 0;

  const getRecommendationColor = (action: string) => {
    switch (action) {
      case "STRONG BUY":
        return "#10b981";
      case "BUY":
        return "#22c55e";
      case "HOLD":
        return "#f59e0b";
      case "SELL":
        return "#f97316";
      case "STRONG SELL":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "LOW":
        return "#10b981";
      case "MEDIUM":
        return "#f59e0b";
      case "HIGH":
        return "#f97316";
      case "VERY HIGH":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  return (
    <>
      <Head>
        <title>AI Stock Predictor | Investment Analysis Dashboard</title>
      </Head>

      <div className="page-container">
        <main className="main-content">
          <div className="top-bar">
            <div className="branding">
              <h1>🤖 AI Stock Predictor</h1>
              <p>
                Advanced forecasting with AI-powered investment recommendations
              </p>
            </div>

            <div className="search-actions">
              <div className="search-box" ref={searchContainerRef}>
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => handleSymbolChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setShowSuggestions(false);
                      fetchPrediction();
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="ENTER TICKER (E.G. AAPL)"
                />

                <AnimatePresence>
                  {showSuggestions &&
                    symbol &&
                    filteredStocks.length > 0 && (
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
                            <span className="suggestion-symbol">
                              {stock.symbol}
                            </span>
                            <span className="suggestion-name">
                              {stock.name}
                            </span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                </AnimatePresence>
              </div>

              <div className="horizon-select">
                <span className="label">Horizon</span>
                <select
                  value={investmentHorizon}
                  onChange={(e) => setInvestmentHorizon(e.target.value)}
                >
                  <option value="short_term">Short-term</option>
                  <option value="medium_term">Medium-term</option>
                  <option value="long_term">Long-term</option>
                </select>
              </div>

              <div className="days-input">
                <span className="label">Days</span>
                <input
                  type="number"
                  value={steps}
                  onChange={(e) => handleStepsChange(Number(e.target.value))}
                  min="1"
                  max="30"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fetchPrediction()}
                disabled={isLoading}
                className={`predict-btn ${isLoading ? "loading" : ""}`}
              >
                {isLoading ? "🧠 ANALYZING..." : "🚀 ANALYZE"}
              </motion.button>
            </div>
          </div>

          {error && (
            <div className="error-banner">
              <span>⚠️</span> {error}
            </div>
          )}

          {analysis && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="recommendation-banner"
              style={{
                borderColor: getRecommendationColor(
                  analysis.recommendation.action
                ),
                background: `linear-gradient(135deg, ${getRecommendationColor(
                  analysis.recommendation.action
                )}15, transparent)`,
              }}
            >
              <div className="rec-icon">
                {analysis.recommendation.action === "STRONG BUY" && "🚀"}
                {analysis.recommendation.action === "BUY" && "📈"}
                {analysis.recommendation.action === "HOLD" && "✋"}
                {analysis.recommendation.action === "SELL" && "📉"}
                {analysis.recommendation.action === "STRONG SELL" && "🔻"}
              </div>
              <div className="rec-content">
                <div className="rec-header">
                  <h2
                    style={{
                      color: getRecommendationColor(
                        analysis.recommendation.action
                      ),
                    }}
                  >
                    {analysis.recommendation.action}
                  </h2>
                  <span className="rec-score">
                    {analysis.overall_score.toFixed(1)}/100
                  </span>
                </div>
                <p>{analysis.recommendation.description}</p>
              </div>
            </motion.div>
          )}

          {data && analysis && (
            <div className="stats-grid">
              <MetricCard
                title="Live Price"
                value={`$${data.live_price.toFixed(2)}`}
                subtitle={
                  <span
                    className={
                      priceChange >= 0 ? "trend-up" : "trend-down"
                    }
                  >
                    {priceChange >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(priceChangePercent).toFixed(2)}%
                  </span>
                }
                icon="💰"
              />
              <MetricCard
                title="Investment Score"
                value={`${analysis.overall_score.toFixed(1)}/100`}
                subtitle={
                  <span className="sub-text">
                    AI Confidence: {analysis.recommendation.confidence}
                  </span>
                }
                icon="🎯"
              />
              <MetricCard
                title="Risk Level"
                value={analysis.risk_assessment.level}
                subtitle={
                  <span
                    className="sub-text"
                    style={{
                      color: getRiskColor(analysis.risk_assessment.level),
                    }}
                  >
                    Volatility: {analysis.risk_assessment.volatility.toFixed(2)}
                  </span>
                }
                icon="🛡️"
              />
              <MetricCard
                title="Expected Return"
                value={`${
                  analysis.expected_performance.medium_term_return > 0
                    ? "+"
                    : ""
                }${analysis.expected_performance.medium_term_return.toFixed(
                  2
                )}%`}
                subtitle={
                  <span className="sub-text">
                    {investmentHorizon.replace("_", " ")}
                  </span>
                }
                icon="📊"
              />
            </div>
          )}

          <div className="tab-navigation">
            <button
              className={`tab ${activeTab === "charts" ? "active" : ""}`}
              onClick={() => setActiveTab("charts")}
            >
              📈 Charts & Indicators
            </button>
            <button
              className={`tab ${activeTab === "analysis" ? "active" : ""}`}
              onClick={() => setActiveTab("analysis")}
            >
              🤖 AI Analysis
            </button>
          </div>

          {activeTab === "charts" && (
            <div className="charts-wrapper">
              <div className="chart-card">
                <div className="chart-header">
                  <h2>{data ? data.symbol : symbol || "Stock"} Price Forecast</h2>
                  {data && (
                    <div className="last-updated">
                      Updated: {new Date().toLocaleTimeString()}
                    </div>
                  )}
                </div>

                <div className="chart-content">
                  {isLoading ? (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <p>Calculating Technical Indicators & AI Analysis...</p>
                    </div>
                  ) : data ? (
                    <Chart
                      options={chartOptions}
                      series={series}
                      height={400}
                      type="line"
                    />
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">📊</div>
                      <p>Enter a stock symbol to generate predictions</p>
                    </div>
                  )}
                </div>
              </div>

              {data && data.indicators && (
                <>
                  <div className="chart-card">
                    <div className="chart-header small">
                      <h3>RSI (14) - Relative Strength Index</h3>
                    </div>
                    <Chart
                      options={rsiOptions}
                      series={[{ name: "RSI", data: rsiData }]}
                      height={180}
                      type="line"
                    />
                  </div>

                  <div className="chart-card">
                    <div className="chart-header small">
                      <h3>MACD (12, 26, 9) - Momentum</h3>
                    </div>
                    <Chart
                      options={macdOptions}
                      series={macdSeries}
                      height={180}
                      type="line"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "analysis" && analysis && (
            <div className="analysis-wrapper">
              <div className="analysis-card">
                <h3>📊 Multi-Factor Analysis</h3>
                <div className="scores-grid">
                  <ScoreBar label="Technical" score={analysis.scores.technical} />
                  <ScoreBar label="Trend" score={analysis.scores.trend} />
                  <ScoreBar label="Risk" score={analysis.scores.risk} />
                  <ScoreBar label="Momentum" score={analysis.scores.momentum} />
                </div>
              </div>

              <div className="analysis-card">
                <h3>🎯 Entry & Exit Strategy</h3>
                <div className="entry-exit-grid">
                  <div className="entry-section">
                    <h4>Entry Points</h4>
                    <div className="price-point optimal">
                      <span className="label">Optimal Entry</span>
                      <span className="value">
                        $
                        {analysis.entry_exit_strategy.entry_points.optimal.toFixed(
                          2
                        )}
                      </span>
                    </div>
                    <div className="price-point">
                      <span className="label">Acceptable Entry</span>
                      <span className="value">
                        $
                        {analysis.entry_exit_strategy.entry_points.acceptable.toFixed(
                          2
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="exit-section">
                    <h4>Exit Points</h4>
                    <div className="price-point target">
                      <span className="label">Target Price</span>
                      <span className="value">
                        $
                        {analysis.entry_exit_strategy.exit_points.target.toFixed(
                          2
                        )}
                      </span>
                    </div>
                    <div className="price-point stop-loss">
                      <span className="label">Stop Loss</span>
                      <span className="value">
                        $
                        {analysis.entry_exit_strategy.exit_points.stop_loss.toFixed(
                          2
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="analysis-card">
                <h3>🧠 AI Reasoning</h3>
                <div className="reasoning-list">
                  {analysis.reasoning.map((reason, idx) => (
                    <div key={idx} className="reasoning-item">
                      <span className="bullet">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {analysis.key_insights.length > 0 && (
                <div className="analysis-card insights">
                  <h3>💡 Key Insights</h3>
                  <div className="insights-list">
                    {analysis.key_insights.map((insight, idx) => (
                      <div key={idx} className="insight-item">
                        {insight}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.warnings.length > 0 && (
                <div className="analysis-card warnings">
                  <h3>⚠️ Risk Warnings</h3>
                  <div className="warnings-list">
                    {analysis.warnings.map((warning, idx) => (
                      <div key={idx} className="warning-item">
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="analysis-card performance">
                <h3>📈 Expected Performance</h3>
                <div className="performance-grid">
                  <div className="perf-item">
                    <span className="perf-label">Short-term</span>
                    <span
                      className={`perf-value ${
                        analysis.expected_performance.short_term_return >= 0
                          ? "positive"
                          : "negative"
                      }`}
                    >
                      {analysis.expected_performance.short_term_return > 0
                        ? "+"
                        : ""}
                      {analysis.expected_performance.short_term_return.toFixed(
                        2
                      )}
                      %
                    </span>
                  </div>
                  <div className="perf-item">
                    <span className="perf-label">Medium-term</span>
                    <span
                      className={`perf-value ${
                        analysis.expected_performance.medium_term_return >= 0
                          ? "positive"
                          : "negative"
                      }`}
                    >
                      {analysis.expected_performance.medium_term_return > 0
                        ? "+"
                        : ""}
                      {analysis.expected_performance.medium_term_return.toFixed(
                        2
                      )}
                      %
                    </span>
                  </div>
                  <div className="perf-item">
                    <span className="perf-label">Risk/Reward Ratio</span>
                    <span className="perf-value">
                      {analysis.expected_performance.risk_reward_ratio.toFixed(
                        2
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .page-container {
          min-height: 100vh;
          background-color: #020617;
          color: white;
          padding: 2rem;
          font-family: 'Inter', sans-serif;
        }

        .main-content {
          max-width: 1400px;
          margin: 0 auto;
        }

        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 2rem;
        }

        .branding h1 {
          font-size: 2.5rem;
          font-weight: 800;
          background: linear-gradient(to right, #22d3ee, #3b82f6, #8b5cf6);
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
          width: 280px;
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

        .horizon-select {
          display: flex;
          align-items: center;
          background: #1e293b;
          border: 1px solid #334155;
          padding: 0.4rem 0.8rem;
          border-radius: 0.75rem;
          gap: 0.5rem;
        }

        .horizon-select .label {
          font-size: 0.75rem;
          color: #94a3b8;
          text-transform: uppercase;
          font-weight: 600;
        }

        .horizon-select select {
          background: transparent;
          border: none;
          color: white;
          outline: none;
          font-weight: 600;
          cursor: pointer;
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

        .recommendation-banner {
          background: rgba(30, 41, 59, 0.6);
          backdrop-filter: blur(10px);
          border: 2px solid;
          border-radius: 1.5rem;
          padding: 2rem;
          margin-bottom: 2rem;
          display: flex;
          gap: 1.5rem;
          align-items: center;
        }

        .rec-icon {
          font-size: 3rem;
          line-height: 1;
        }

        .rec-content {
          flex: 1;
        }

        .rec-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .rec-header h2 {
          margin: 0;
          font-size: 1.8rem;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .rec-score {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 1.2rem;
          font-weight: 700;
        }

        .rec-content p {
          color: #cbd5e1;
          margin: 0;
          font-size: 1.05rem;
          line-height: 1.5;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .trend-up { 
          color: #4ade80; 
          font-weight: 600; 
        }
        
        .trend-down { 
          color: #f87171; 
          font-weight: 600; 
        }
        
        .sub-text { 
          color: #64748b; 
          font-size: 0.8rem; 
        }

        .tab-navigation {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          border-bottom: 2px solid #1e293b;
        }

        .tab {
          background: transparent;
          border: none;
          color: #94a3b8;
          padding: 1rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #e2e8f0;
        }

        .tab.active {
          color: #22d3ee;
          border-bottom-color: #22d3ee;
        }

        .charts-wrapper {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .analysis-wrapper {
          display: grid;
          gap: 1.5rem;
        }

        .chart-card, .analysis-card {
          background: rgba(30, 41, 59, 0.4);
          backdrop-filter: blur(10px);
          border: 1px solid #334155;
          border-radius: 1.5rem;
          padding: 2rem;
        }

        .analysis-card h3 {
          margin: 0 0 1.5rem 0;
          font-size: 1.3rem;
          color: #e2e8f0;
        }

        .scores-grid {
          display: grid;
          gap: 1rem;
        }

        .entry-exit-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 2rem;
        }

        .entry-section h4, .exit-section h4 {
          margin: 0 0 1rem 0;
          color: #94a3b8;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .price-point {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid #334155;
          border-radius: 0.75rem;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .price-point.optimal {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }

        .price-point.target {
          border-color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
        }

        .price-point.stop-loss {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .price-point .label {
          color: #94a3b8;
          font-size: 0.85rem;
        }

        .price-point .value {
          font-size: 1.2rem;
          font-weight: 700;
          color: #e2e8f0;
        }

        .reasoning-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .reasoning-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem;
          background: rgba(15, 23, 42, 0.4);
          border-radius: 0.5rem;
          line-height: 1.6;
        }

        .reasoning-item .bullet {
          color: #22d3ee;
          font-weight: bold;
          font-size: 1.2rem;
        }

        .insights-list, .warnings-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .insight-item, .warning-item {
          padding: 1rem;
          background: rgba(15, 23, 42, 0.4);
          border-radius: 0.75rem;
          border-left: 3px solid #22d3ee;
          line-height: 1.6;
        }

        .warning-item {
          border-left-color: #f59e0b;
          background: rgba(245, 158, 11, 0.05);
        }

        .performance-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
        }

        .perf-item {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid #334155;
          border-radius: 0.75rem;
          padding: 1.5rem;
          text-align: center;
        }

        .perf-label {
          display: block;
          color: #94a3b8;
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .perf-value {
          display: block;
          font-size: 1.8rem;
          font-weight: 700;
        }

        .perf-value.positive {
          color: #10b981;
        }

        .perf-value.negative {
          color: #ef4444;
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

        .empty-icon { 
          font-size: 3rem; 
          margin-bottom: 1rem; 
          opacity: 0.5; 
        }

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

        .score-bar-wrapper {
          margin-bottom: 1rem;
        }

        .score-bar-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .score-label {
          color: #94a3b8;
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .score-value {
          color: #e2e8f0;
          font-weight: 700;
        }

        .score-bar-track {
          height: 8px;
          background: rgba(15, 23, 42, 0.6);
          border-radius: 4px;
          overflow: hidden;
        }

        .score-bar-fill {
          height: 100%;
          border-radius: 4px;
        }

        @media (max-width: 768px) {
          .top-bar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-actions {
            flex-direction: column;
          }

          .search-box {
            width: 100%;
          }

          .entry-exit-grid {
            grid-template-columns: 1fr;
          }

          .tab-navigation {
            overflow-x: auto;
          }
        }
      `}</style>
    </>
  );
}

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

      <style>{`
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

interface ScoreBarProps {
  label: string;
  score: number;
}

function ScoreBar({ label, score }: ScoreBarProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return "#10b981";
    if (score >= 50) return "#f59e0b";
    if (score >= 30) return "#f97316";
    return "#ef4444";
  };

  return (
    <div className="score-bar-wrapper">
      <div className="score-bar-header">
        <span className="score-label">{label}</span>
        <span className="score-value">{score.toFixed(1)}</span>
      </div>
      <div className="score-bar-track">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="score-bar-fill"
          style={{ backgroundColor: getScoreColor(score) }}
        />
      </div>

      <style>{`
        .score-bar-wrapper {
          margin-bottom: 1rem;
        }

        .score-bar-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .score-label {
          color: #94a3b8;
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .score-value {
          color: #e2e8f0;
          font-weight: 700;
        }

        .score-bar-track {
          height: 8px;
          background: rgba(15, 23, 42, 0.6);
          border-radius: 4px;
          overflow: hidden;
        }

        .score-bar-fill {
          height: 100%;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

export default dynamic(() => Promise.resolve(PredictPage), {
  ssr: false,
});
