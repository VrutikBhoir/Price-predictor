import { useCallback, useMemo, useState, useEffect, useRef, RefObject } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { format } from 'date-fns';
import { fetchData, indicators, trainModel, getLivePrice, getAdvice, Ohlcv, AdviceResponse, screenTickers, ScreenerFilters } from '../lib/api';
import Button from '../components/common/Button';
import Card from '../components/common/Card';

const Plot: any = dynamic(() => import('../components/Plot'), { ssr: false }) as any;

function toISO(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

const CalendarIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 2a1 1 0 0 0-1 1v1H5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3h-1V3a1 1 0 1 0-2 0v1H8V3a1 1 0 0 0-1-1Zm12 6H5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8ZM5 6h14a1 1 0 0 1 1 1v1H4V7a1 1 0 0 1 1-1Z"/>
  </svg>
);

export default function Home() {
  // ===== AUTH STATE =====
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.email && u?.name) {
          setUsername(u.name);
          setLoggedIn(true);
        }
      }
    } catch {}
  }, []);

  // ===== CONFIGURATION STATE =====
  const [ticker, setTicker] = useState('AAPL');
  const [start, setStart] = useState(toISO(new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)));
  const [end, setEnd] = useState(toISO(new Date()));
  const [forecastDays, setForecastDays] = useState(10);
  const [modelType, setModelType] = useState<'ARIMA' | 'SARIMA'>('ARIMA');
  const [includeSma, setIncludeSma] = useState(true);
  const [includeEma, setIncludeEma] = useState(true);
  const [includeRsi, setIncludeRsi] = useState(true);
  const [includeMacd, setIncludeMacd] = useState(true);
  const [includeBb, setIncludeBb] = useState(true);

  // ===== DATA STATE =====
  const [data, setData] = useState<Ohlcv[] | null>(null);
  const [ind, setInd] = useState<Record<string, (number | null)[]> | null>(null);
  const [metrics, setMetrics] = useState<Record<string, number | null> | null>(null);
  const [predictions, setPredictions] = useState<{
    forecast: { date: string; value: number }[];
    lower_ci: { date: string; value: number }[];
    upper_ci: { date: string; value: number }[];
  } | null>(null);
  const [advice, setAdvice] = useState<AdviceResponse | null>(null);
  const [hasFetchedData, setHasFetchedData] = useState(false);

  // ===== UI STATE =====
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<boolean>(true);
  const [alerts, setAlerts] = useState<{ priceAbove?: number; priceBelow?: number }>({});
  const [notify, setNotify] = useState<boolean>(false);
  const [screenerResults, setScreenerResults] = useState<Array<any>>([]);

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const resetData = useCallback(() => {
    setData(null);
    setInd(null);
    setMetrics(null);
    setPredictions(null);
    setHasFetchedData(false);
    setLivePrice(null);
    setLastUpdate(null);
    setAdvice(null);
    setError(null);
  }, []);

  const openDatePicker = useCallback((ref: RefObject<HTMLInputElement>) => {
    const input = ref.current;
    if (!input) return;
    const anyInput = input as any;
    if (typeof anyInput.showPicker === 'function') {
      anyInput.showPicker();
    } else {
      input.focus();
      input.click();
    }
  }, []);

  // ===== LIVE PRICE WEBSOCKET =====
  const fetchLivePrice = useCallback(async () => {
    if (!ticker) return;
    try {
      const result = await getLivePrice(ticker);
      if (result.price) {
        setLivePrice(result.price);
        setLastUpdate(result.timestamp);
      }
    } catch (e) {
      console.error('Error fetching live price:', e);
    }
  }, [ticker]);

  useEffect(() => {
    if (!ticker || !hasFetchedData) return;
    if (streaming) {
      try {
        if (wsRef.current) {
          try { wsRef.current.close(); } catch {}
        }
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = '127.0.0.1:8000';
        const ws = new WebSocket(`${wsProtocol}://${host}/ws/live/${encodeURIComponent(ticker)}`);
        wsRef.current = ws;
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data || '{}');
            if (typeof msg.price === 'number') {
              setLivePrice(msg.price);
              setLastUpdate(msg.timestamp || new Date().toISOString());
            }
          } catch {}
        };
        ws.onerror = () => setStreaming(false);
        return () => {
          try { ws.close(); } catch {}
          wsRef.current = null;
        };
      } catch {
        setStreaming(false);
      }
    } else {
      fetchLivePrice();
      const interval = setInterval(fetchLivePrice, 30000);
      return () => clearInterval(interval);
    }
  }, [ticker, hasFetchedData, streaming, fetchLivePrice]);

  // ===== PRICE ALERTS =====
  useEffect(() => {
    if (livePrice == null) return;
    if (alerts.priceAbove != null && livePrice >= alerts.priceAbove) {
      if (notify && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification(`${ticker} Alert`, { body: `Crossed above $${alerts.priceAbove}` }); } catch {}
      } else {
        alert(`${ticker} crossed above $${alerts.priceAbove}`);
      }
      setAlerts((a) => ({ ...a, priceAbove: undefined }));
    }
    if (alerts.priceBelow != null && livePrice <= alerts.priceBelow) {
      if (notify && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification(`${ticker} Alert`, { body: `Crossed below $${alerts.priceBelow}` }); } catch {}
      } else {
        alert(`${ticker} crossed below $${alerts.priceBelow}`);
      }
      setAlerts((a) => ({ ...a, priceBelow: undefined }));
    }
  }, [livePrice, alerts, ticker, notify]);

  // ===== FETCH AND TRAIN MODEL =====
  const onFetchAndTrain = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setMetrics(null);
      setPredictions(null);
      setInd(null);
      setHasFetchedData(false);

      if (!ticker || !ticker.trim()) throw new Error('Ticker symbol is required');
      if (!start || !end) throw new Error('Start date and end date are required');

      const res = await fetchData(ticker, start, end);
      const series = (res && res.data) || [];
      if (!Array.isArray(series) || !series.length) {
        setData(null);
        setError('No data found for the specified ticker and date range.');
        return;
      }
      setData(series);
      setHasFetchedData(true);

      try {
        const indRes = await indicators({
          data: series,
          include_sma: includeSma,
          include_ema: includeEma,
          include_rsi: includeRsi,
          include_macd: includeMacd,
          include_bollinger: includeBb,
        });
        setInd(indRes.error ? {} : (indRes.indicators || {}));
      } catch (indErr: any) {
        console.warn('Indicators calculation failed, continuing without them:', indErr);
        setInd({});
      }

      const dates = series.map((d) => d.Date);
      const close = series.map((d) => d.Close);
      
      try {
        const trainRes = await trainModel({
          close,
          dates,
          model_type: modelType,
          forecast_days: forecastDays,
        });
        if (trainRes && trainRes.error) {
          setError(trainRes.error);
          return;
        }
        setMetrics(trainRes.metrics || null);
        setPredictions(trainRes.predictions || null);
      } catch (trainErr: any) {
        console.error('Training failed:', trainErr);
        setError(trainErr?.message || 'Model training failed');
        return;
      }

      try {
        const adviceRes = await getAdvice({
          data: series,
          model_type: modelType,
          forecast_days: forecastDays,
          ticker,
        });
        if (adviceRes && !adviceRes.error) {
          setAdvice(adviceRes);
        }
      } catch (ae) {
        console.warn('Advice error:', ae);
      }
    } catch (e: any) {
      console.error('ERROR:', e);
      const errorMsg = e?.message || e?.response?.data?.error || 'Unexpected error occurred';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [ticker, start, end, includeSma, includeEma, includeRsi, includeMacd, includeBb, modelType, forecastDays]);

  const latestPrice = useMemo(() => data?.length ? data[data.length - 1].Close ?? null : null, [data]);

  const priceChange = useMemo(() => {
    if (!data || data.length < 2) return null;
    const last = data[data.length - 1].Close;
    const prev = data[data.length - 2].Close;
    if (last == null || prev == null) return null;
    return { abs: last - prev, pct: ((last - prev) / prev) * 100 };
  }, [data]);

  const downloadPredictions = useCallback(() => {
    if (!predictions) return;
    const rows = ['date,forecast,lower_ci,upper_ci'];
    const byDate: Record<string, any> = {};
    
    predictions.forecast?.forEach((p) => {
      if (p?.date) byDate[p.date] = { date: p.date, forecast: p.value };
    });
    predictions.lower_ci?.forEach((p) => {
      if (p?.date) byDate[p.date] = { ...(byDate[p.date] || { date: p.date }), lower_ci: p.value };
    });
    predictions.upper_ci?.forEach((p) => {
      if (p?.date) byDate[p.date] = { ...(byDate[p.date] || { date: p.date }), upper_ci: p.value };
    });

    if (!Object.keys(byDate).length) {
      alert('No prediction data available to export.');
      return;
    }

    Object.values(byDate).forEach((r: any) => {
      rows.push(`${r.date},${r.forecast ?? ''},${r.lower_ci ?? ''},${r.upper_ci ?? ''}`);
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ticker}_predictions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [predictions, ticker]);

  // ===== CHART FIGURES =====
  const priceFigure = useMemo(() => {
    if (!data) return null;
    const x = data.map((d) => d.Date);
    const traces: any[] = [
      {
        x,
        open: data.map((d) => d.Open),
        high: data.map((d) => d.High),
        low: data.map((d) => d.Low),
        close: data.map((d) => d.Close),
        type: 'candlestick',
        name: ticker,
        increasing: { line: { color: '#2ed573' } },
        decreasing: { line: { color: '#ff6b6b' } },
      },
    ];

    if (ind?.SMA) traces.push({ x, y: ind.SMA, mode: 'lines', name: 'SMA (20)', line: { color: '#3b82f6', width: 2 } });
    if (ind?.EMA) traces.push({ x, y: ind.EMA, mode: 'lines', name: 'EMA (20)', line: { color: '#f59e0b', width: 2 } });
    if (ind?.BB_Upper && ind?.BB_Lower) {
      traces.push(
        { x, y: ind.BB_Upper, mode: 'lines', name: 'BB Upper', line: { color: '#06b6d4', width: 1, dash: 'dash' }, showlegend: false },
        { x, y: ind.BB_Lower, mode: 'lines', name: 'BB Lower', line: { color: '#06b6d4', width: 1, dash: 'dash' }, fill: 'tonexty', fillcolor: 'rgba(6, 182, 212, 0.1)', showlegend: false }
      );
    }

    return {
      data: traces,
      layout: {
        title: { text: `${ticker} Stock Analysis`, font: { color: '#dbe7f3', size: 18 } },
        xaxis: { title: 'Date', gridcolor: 'rgba(255,255,255,0.05)', color: '#9fb0c2' },
        yaxis: { title: 'Price ($)', gridcolor: 'rgba(255,255,255,0.05)', color: '#9fb0c2' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#dbe7f3' },
        height: 500,
        showlegend: true,
        hovermode: 'x unified',
        legend: { orientation: 'h', y: -0.15, font: { color: '#9fb0c2' } },
      }
    };
  }, [data, ind, ticker]);

  const volumeFigure = useMemo(() => {
    if (!data) return null;
    const x = data.map((d) => d.Date);
    const colors = data.map((d) => (d.Close ?? 0) >= (d.Open ?? 0) ? 'rgba(46, 213, 115, 0.8)' : 'rgba(255, 107, 107, 0.8)');
    
    return {
      data: [{
        x,
        y: data.map((d) => d.Volume ?? 0),
        type: 'bar',
        name: 'Volume',
        marker: { color: colors },
        opacity: 0.9,
      }],
      layout: {
        title: { text: 'Volume', font: { color: '#dbe7f3', size: 16 } },
        xaxis: { title: 'Date', gridcolor: 'rgba(255,255,255,0.05)', color: '#9fb0c2' },
        yaxis: { title: 'Volume', gridcolor: 'rgba(255,255,255,0.05)', color: '#9fb0c2' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#dbe7f3' },
        height: 300,
        showlegend: false,
      }
    };
  }, [data]);

  const rsiFigure = useMemo(() => {
    if (!data || !ind?.RSI) return null;
    const x = data.map((d) => d.Date);
    
    return {
      data: [
        { x, y: ind.RSI, mode: 'lines', name: 'RSI', line: { color: '#3b82f6', width: 2 } },
        { x: [x[0], x[x.length - 1]], y: [70, 70], mode: 'lines', name: 'Overbought (70)', line: { dash: 'dash', color: '#ff6b6b' } },
        { x: [x[0], x[x.length - 1]], y: [30, 30], mode: 'lines', name: 'Oversold (30)', line: { dash: 'dash', color: '#2ed573' } },
        { x: [x[0], x[x.length - 1]], y: [50, 50], mode: 'lines', name: 'Neutral (50)', line: { dash: 'dot', color: '#9fb0c2' } },
      ],
      layout: {
        title: { text: 'RSI (Relative Strength Index)', font: { color: '#dbe7f3', size: 16 } },
        xaxis: { title: 'Date', gridcolor: 'rgba(255,255,255,0.05)', color: '#9fb0c2' },
        yaxis: { range: [0, 100], title: 'RSI', gridcolor: 'rgba(255,255,255,0.05)', color: '#9fb0c2' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#dbe7f3' },
        height: 300,
        showlegend: true,
        legend: { orientation: 'h', y: -0.25, font: { color: '#9fb0c2', size: 11 } },
      }
    };
  }, [data, ind]);

  const macdFigure = useMemo(() => {
    if (!data || !ind?.MACD || !ind?.MACD_Signal || !ind?.MACD_Histogram) return null;
    const x = data.map((d) => d.Date);
    const colors = (ind.MACD_Histogram || []).map((v) => (v && v < 0 ? '#ff6b6b' : '#2ed573'));
    
    return {
      data: [
        { x, y: ind.MACD, mode: 'lines', name: 'MACD', line: { color: '#3b82f6', width: 2 } },
        { x, y: ind.MACD_Signal, mode: 'lines', name: 'Signal', line: { color: '#f59e0b', width: 2 } },
        { x, y: ind.MACD_Histogram, type: 'bar', name: 'Histogram', marker: { color: colors }, opacity: 0.7 },
      ],
      layout: {
        title: { text: 'MACD', font: { color: '#dbe7f3', size: 16 } },
        xaxis: { title: 'Date', gridcolor: 'rgba(255,255,255,0.05)', color: '#9fb0c2' },
        yaxis: { title: 'Value', gridcolor: 'rgba(255,255,255,0.05)', color: '#9fb0c2' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#dbe7f3' },
        height: 300,
        showlegend: true,
        legend: { orientation: 'h', y: -0.25, font: { color: '#9fb0c2', size: 11 } },
      }
    };
  }, [data, ind]);

  const forecastFigure = useMemo(() => {
    if (!data || !predictions) return null;
    const recent = data.slice(Math.max(0, data.length - 60));
    const lastDate = data[data.length - 1].Date;
    
    return {
      data: [
        {
          x: recent.map((d) => d.Date),
          y: recent.map((d) => d.Close),
          mode: 'lines',
          name: 'Historical',
          line: { color: '#00d09c', width: 3 },
        },
        {
          x: predictions.upper_ci.map((p) => p.date),
          y: predictions.upper_ci.map((p) => p.value),
          mode: 'lines',
          name: 'Upper CI (95%)',
          line: { color: '#06b6d4', width: 1, dash: 'dash' },
        },
        {
          x: predictions.lower_ci.map((p) => p.date),
          y: predictions.lower_ci.map((p) => p.value),
          mode: 'lines',
          name: 'Lower CI (95%)',
          line: { color: '#06b6d4', width: 1, dash: 'dash' },
          fill: 'tonexty',
          fillcolor: 'rgba(6, 182, 212, 0.15)',
        },
        {
          x: predictions.forecast.map((p) => p.date),
          y: predictions.forecast.map((p) => p.value),
          mode: 'lines+markers',
          name: 'Forecast',
          line: { color: '#3b82f6', width: 3 },
          marker: { size: 8, color: '#3b82f6' },
        },
      ],
      layout: {
        title: { text: `${ticker} - ${forecastDays} Day Price Forecast`, font: { color: '#dbe7f3', size: 18 } },
        xaxis: { title: 'Date', gridcolor: 'rgba(255,255,255,0.05)', color: '#9fb0c2' },
        yaxis: { title: 'Price ($)', gridcolor: 'rgba(255,255,255,0.05)', color: '#9fb0c2' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#dbe7f3' },
        height: 450,
        showlegend: true,
        legend: { orientation: 'h', y: -0.15, font: { color: '#9fb0c2' } },
        shapes: [
          { 
            type: 'line', 
            x0: lastDate, 
            x1: lastDate, 
            y0: 0, 
            y1: 1, 
            yref: 'paper', 
            line: { dash: 'dash', color: '#9fb0c2', width: 2 } 
          },
        ],
      }
    };
  }, [data, predictions, ticker, forecastDays]);

  return (
    <div className="animated-bg" style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '40px' }}>
      <Head>
        <title>Stock Price Predictor - AI-Powered Market Analysis</title>
        <meta name="description" content="Advanced stock price prediction using ARIMA and SARIMA machine learning models with 94%+ accuracy" />
      </Head>

      <div className="content-container">
        {!loggedIn ? (
          // ===== LANDING PAGE (NON-LOGGED IN) =====
          <>
            {/* Hero Section */}
            <section style={{ padding: '100px 0 80px', textAlign: 'center' }} className="fade-in">
              <div style={{
                display: 'inline-block',
                padding: '10px 24px',
                borderRadius: '999px',
                fontSize: '13px',
                letterSpacing: '0.1em',
                background: 'rgba(0, 208, 156, 0.12)',
                border: '1px solid rgba(0, 208, 156, 0.3)',
                color: '#00d09c',
                marginBottom: '28px',
                fontWeight: '700',
                textTransform: 'uppercase',
              }}>
                🚀 Next-Gen Market Intelligence
              </div>
              
              <h1 className="gradient-text" style={{
                fontSize: 'clamp(42px, 7vw, 80px)',
                fontWeight: '900',
                marginBottom: '28px',
                lineHeight: '1.1',
                letterSpacing: '-0.03em',
              }}>
                Predict Stock Prices<br />with AI Precision
              </h1>
              
              <p style={{
                color: '#9fb0c2',
                fontSize: 'clamp(17px, 2.2vw, 22px)',
                marginBottom: '48px',
                maxWidth: '800px',
                margin: '0 auto 48px',
                lineHeight: '1.7',
              }}>
                Harness the power of advanced machine learning with ARIMA and SARIMA algorithms
                to forecast market trends with <strong style={{ color: '#00d09c', fontWeight: '700' }}>94%+ accuracy</strong>
              </p>
              
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '80px' }}>
                <Link href="/login">
                  <button className="primary" style={{ padding: '16px 40px', fontSize: '17px', fontWeight: '800' }}>
                    🚀 Get Started Free
                  </button>
                </Link>
                <Link href="/dashboard">
                  <button className="secondary" style={{ padding: '16px 40px', fontSize: '17px', fontWeight: '700' }}>
                    📊 View Live Demo
                  </button>
                </Link>
              </div>

              {/* Stats Bar */}
              <Card style={{
                display: 'flex',
                justifyContent: 'space-around',
                gap: '40px',
                flexWrap: 'wrap',
                padding: '40px 32px',
                background: 'rgba(15, 22, 34, 0.6)',
                backdropFilter: 'blur(20px)',
                maxWidth: '900px',
                margin: '0 auto',
              }}>
                <StatItem value="94%+" label="Prediction Accuracy" />
                <StatItem value="50+" label="Stock Tickers" />
                <StatItem value="24/7" label="Real-time Data" />
                <StatItem value="< 1s" label="Response Time" />
              </Card>
            </section>

            {/* Features Grid */}
            <section style={{ margin: '100px 0' }}>
              <h2 style={{ 
                fontSize: 'clamp(32px, 4vw, 48px)', 
                textAlign: 'center', 
                marginBottom: '64px', 
                fontWeight: '800',
                color: '#dbe7f3',
              }}>
                Powerful Features for Smart Trading
              </h2>
              <div className="dashboard-grid">
                <FeatureCard
                  icon="🤖"
                  title="AI Forecasting"
                  description="ARIMA & SARIMA models trained on years of historical data with confidence intervals and uncertainty visualization"
                />
                <FeatureCard
                  icon="📈"
                  title="Technical Indicators"
                  description="Professional-grade SMA, EMA, RSI, MACD, and Bollinger Bands for comprehensive technical analysis"
                />
                <FeatureCard
                  icon="💹"
                  title="Real-time Streaming"
                  description="WebSocket-powered live price updates with millisecond latency for instant market insights and alerts"
                />
                <FeatureCard
                  icon="🧠"
                  title="Smart AI Assistant"
                  description="Actionable buy/sell/hold recommendations powered by multi-factor analysis and market sentiment"
                />
                <FeatureCard
                  icon="📊"
                  title="Interactive Charts"
                  description="Dynamic candlestick charts with customizable timeframes, zoom controls, and one-click CSV export"
                />
                <FeatureCard
                  icon="🔒"
                  title="Secure & Private"
                  description="Bank-level encryption with zero third-party data sharing. Your trading strategies stay confidential"
                />
              </div>
            </section>

            {/* How It Works */}
            <Card style={{ textAlign: 'center', padding: '80px 48px', marginBottom: '60px' }}>
              <h2 style={{ 
                fontSize: 'clamp(28px, 3.5vw, 40px)', 
                marginBottom: '56px', 
                fontWeight: '800',
                color: '#dbe7f3',
              }}>
                Get Started in 4 Simple Steps
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '40px',
              }}>
                <StepCard step="1" title="Sign Up" description="Create your free account in 30 seconds. No credit card required." />
                <StepCard step="2" title="Select Stock" description="Choose any ticker symbol and configure your preferred date range." />
                <StepCard step="3" title="Train Model" description="Generate technical indicators and train AI prediction models instantly." />
                <StepCard step="4" title="Get Insights" description="View detailed forecasts, confidence intervals, and trading signals." />
              </div>
            </Card>
          </>
        ) : (
          // ===== MAIN DASHBOARD (LOGGED IN) =====
          <>
            {/* Welcome Header */}
            <section style={{ padding: '40px 0 32px' }}>
              <h1 style={{ fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: '800', marginBottom: '10px', color: '#dbe7f3' }}>
                Welcome back, <span className="gradient-text">{username}</span> 👋
              </h1>
              <p style={{ color: '#9fb0c2', fontSize: '16px', lineHeight: '1.6' }}>
                Advanced stock prediction with ARIMA & SARIMA machine learning models
              </p>
            </section>

            {/* Configuration Card */}
            <Card style={{ marginBottom: '28px' }}>
              <Card.Header>
                <Card.Title>🔧 Configuration Panel</Card.Title>
              </Card.Header>
              
              <Card.Body>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '24px', 
                  marginBottom: '24px' 
                }}>
                  <InputField
                    label="Stock Ticker"
                    value={ticker}
                    onChange={(e: any) => { setTicker(e.target.value.toUpperCase()); resetData(); }}
                    placeholder="e.g., AAPL, GOOGL"
                  />
                  
                  <DateField
                    label="Start Date"
                    value={start}
                    onChange={(e: any) => { setStart(e.target.value); resetData(); }}
                    inputRef={startInputRef}
                    onIconClick={() => openDatePicker(startInputRef)}
                  />

                  <DateField
                    label="End Date"
                    value={end}
                    onChange={(e: any) => { setEnd(e.target.value); resetData(); }}
                    inputRef={endInputRef}
                    onIconClick={() => openDatePicker(endInputRef)}
                  />

                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '10px', 
                      fontSize: '14px', 
                      color: '#9fb0c2', 
                      fontWeight: '600' 
                    }}>
                      Forecast Days: <strong style={{ color: '#00d09c' }}>{forecastDays}</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={forecastDays}
                      onChange={(e) => { setForecastDays(Number(e.target.value)); resetData(); }}
                      style={{ width: '100%' }}
                    />
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      fontSize: '12px', 
                      color: '#6b7c8e', 
                      marginTop: '6px' 
                    }}>
                      <span>1</span>
                      <span>15</span>
                      <span>30</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '10px', 
                      fontSize: '14px', 
                      color: '#9fb0c2', 
                      fontWeight: '600' 
                    }}>
                      Model Type
                    </label>
                    <select
                      value={modelType}
                      onChange={(e) => { setModelType(e.target.value as 'ARIMA' | 'SARIMA'); resetData(); }}
                      style={{ width: '100%' }}
                    >
                      <option value="ARIMA">ARIMA</option>
                      <option value="SARIMA">SARIMA (Seasonal)</option>
                    </select>
                  </div>
                </div>

                {/* Technical Indicators */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '14px', 
                    fontSize: '14px', 
                    color: '#9fb0c2', 
                    fontWeight: '600' 
                  }}>
                    📊 Technical Indicators
                  </label>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <Checkbox label="SMA (20)" checked={includeSma} onChange={(e: any) => { setIncludeSma(e.target.checked); resetData(); }} />
                    <Checkbox label="EMA (20)" checked={includeEma} onChange={(e: any) => { setIncludeEma(e.target.checked); resetData(); }} />
                    <Checkbox label="RSI (14)" checked={includeRsi} onChange={(e: any) => { setIncludeRsi(e.target.checked); resetData(); }} />
                    <Checkbox label="MACD" checked={includeMacd} onChange={(e: any) => { setIncludeMacd(e.target.checked); resetData(); }} />
                    <Checkbox label="Bollinger Bands" checked={includeBb} onChange={(e: any) => { setIncludeBb(e.target.checked); resetData(); }} />
                  </div>
                </div>

                {/* Price Alerts */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '14px', 
                    fontSize: '14px', 
                    color: '#9fb0c2', 
                    fontWeight: '600' 
                  }}>
                    🔔 Price Alerts
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: '13px', color: '#9fb0c2', marginBottom: '6px', display: 'block' }}>
                        Alert if price goes above
                      </label>
                      <input 
                        type="number" 
                        placeholder="e.g., 150.00" 
                        value={alerts.priceAbove ?? ''} 
                        onChange={(e) => setAlerts((a) => ({ ...a, priceAbove: e.target.value ? Number(e.target.value) : undefined }))} 
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', color: '#9fb0c2', marginBottom: '6px', display: 'block' }}>
                        Alert if price goes below
                      </label>
                      <input 
                        type="number" 
                        placeholder="e.g., 120.00" 
                        value={alerts.priceBelow ?? ''} 
                        onChange={(e) => setAlerts((a) => ({ ...a, priceBelow: e.target.value ? Number(e.target.value) : undefined }))} 
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <Checkbox 
                        label="Desktop Notifications" 
                        checked={notify} 
                        onChange={async (e: any) => {
                          const next = e.target.checked;
                          if (next && 'Notification' in window && Notification.permission !== 'granted') {
                            try { await Notification.requestPermission(); } catch {}
                          }
                          setNotify(next);
                          try { localStorage.setItem('notificationsEnabled', String(next)); } catch {}
                        }} 
                      />
                      <Checkbox 
                        label="WebSocket Streaming" 
                        checked={streaming} 
                        onChange={(e: any) => setStreaming(e.target.checked)} 
                      />
                    </div>
                  </div>
                </div>

                <button 
                  className="primary" 
                  onClick={onFetchAndTrain} 
                  disabled={loading}
                  style={{ width: '100%', maxWidth: '360px', padding: '14px 28px', fontSize: '16px' }}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ marginRight: '10px', borderTopColor: '#0b1119' }} />
                      Processing...
                    </>
                  ) : (
                    <>🚀 Fetch Data & Train Model</>
                  )}
                </button>

                {error && (
                  <div style={{
                    marginTop: '20px',
                    padding: '16px 18px',
                    borderRadius: '12px',
                    background: 'rgba(255, 107, 107, 0.12)',
                    border: '1px solid rgba(255, 107, 107, 0.3)',
                    color: '#ff6b6b',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    lineHeight: '1.5',
                  }}>
                    <span style={{ fontSize: '22px' }}>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Metrics Grid */}
            {data && hasFetchedData && (
              <>
                <div className="dashboard-grid" style={{ marginBottom: '28px' }}>
                  <MetricCard
                    title="Latest Price"
                    value={latestPrice != null ? `$${latestPrice.toFixed(2)}` : '--'}
                    change={priceChange ? `${Math.abs(priceChange.pct).toFixed(2)}%` : undefined}
                    isPositive={priceChange ? priceChange.abs >= 0 : undefined}
                    icon="💵"
                  />
                  
                  {livePrice && (
                    <LivePriceCard
                      ticker={ticker}
                      price={livePrice}
                      lastUpdate={lastUpdate}
                      latestHistoricalPrice={latestPrice}
                    />
                  )}

                  <MetricCard
                    title="24h High"
                    value={`$${Math.max(...data.map((d) => d.High ?? 0)).toFixed(2)}`}
                    icon="📈"
                    subtitle="Peak price in range"
                  />

                  <MetricCard
                    title="24h Low"
                    value={`$${Math.min(...data.map((d) => d.Low ?? Infinity)).toFixed(2)}`}
                    icon="📉"
                    subtitle="Lowest price in range"
                  />

                  <MetricCard
                    title="Avg Volume"
                    value={Math.round(data.reduce((a, b) => a + (b.Volume ?? 0), 0) / data.length).toLocaleString()}
                    icon="📊"
                    subtitle="Daily average"
                  />

                  {metrics && metrics.RMSE != null && (
                    <MetricCard
                      title="Model RMSE"
                      value={metrics.RMSE.toFixed(4)}
                      icon="🎯"
                      subtitle="Prediction accuracy"
                    />
                  )}
                </div>

                {/* Main Charts Grid */}
                <div className="grid" style={{ marginBottom: '28px' }}>
                  <div>
                    {/* Price Chart */}
                    {priceFigure && (
                      <Card style={{ marginBottom: '28px' }}>
                        <Card.Header>
                          <Card.Title>📊 {ticker} Stock Analysis</Card.Title>
                        </Card.Header>
                        <Card.Body>
                          <Plot
                            data={priceFigure.data}
                            layout={priceFigure.layout}
                            style={{ width: '100%' }}
                            config={{ responsive: true, displayModeBar: true }}
                          />
                        </Card.Body>
                      </Card>
                    )}

                    {/* Volume Chart */}
                    {volumeFigure && (
                      <Card style={{ marginBottom: '28px' }}>
                        <Card.Header>
                          <Card.Title>📊 Trading Volume</Card.Title>
                        </Card.Header>
                        <Card.Body>
                          <Plot
                            data={volumeFigure.data}
                            layout={volumeFigure.layout}
                            style={{ width: '100%' }}
                            config={{ responsive: true, displayModeBar: true }}
                          />
                        </Card.Body>
                      </Card>
                    )}

                    {/* RSI Chart */}
                    {includeRsi && rsiFigure && (
                      <Card style={{ marginBottom: '28px' }}>
                        <Card.Header>
                          <Card.Title>📈 RSI Indicator</Card.Title>
                        </Card.Header>
                        <Card.Body>
                          <Plot
                            data={rsiFigure.data}
                            layout={rsiFigure.layout}
                            style={{ width: '100%' }}
                            config={{ responsive: true, displayModeBar: true }}
                          />
                        </Card.Body>
                      </Card>
                    )}

                    {/* MACD Chart */}
                    {includeMacd && macdFigure && (
                      <Card style={{ marginBottom: '28px' }}>
                        <Card.Header>
                          <Card.Title>📉 MACD Indicator</Card.Title>
                        </Card.Header>
                        <Card.Body>
                          <Plot
                            data={macdFigure.data}
                            layout={macdFigure.layout}
                            style={{ width: '100%' }}
                            config={{ responsive: true, displayModeBar: true }}
                          />
                        </Card.Body>
                      </Card>
                    )}
                  </div>

                  <div>
                    {/* Data Summary */}
                    <Card style={{ marginBottom: '28px' }}>
                      <Card.Header>
                        <Card.Title>📋 Data Summary</Card.Title>
                      </Card.Header>
                      <Card.Body>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <SummaryRow label="Ticker" value={ticker} />
                          <SummaryRow label="Data Range" value={`${data[0].Date} to ${data[data.length - 1].Date}`} />
                          <SummaryRow label="Total Records" value={data.length.toLocaleString()} />
                          <SummaryRow label="Model Type" value={modelType} />
                          <SummaryRow label="Forecast Days" value={forecastDays.toString()} />
                        </div>
                      </Card.Body>
                    </Card>

                    {/* Model Performance */}
                    {metrics && (
                      <Card style={{ marginBottom: '28px' }}>
                        <Card.Header>
                          <Card.Title>🎯 Model Performance</Card.Title>
                        </Card.Header>
                        <Card.Body>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {Object.entries(metrics).map(([key, value]) => (
                              <SummaryRow 
                                key={key} 
                                label={key} 
                                value={value != null ? Number(value).toFixed(4) : '--'} 
                              />
                            ))}
                          </div>
                        </Card.Body>
                      </Card>
                    )}

                    {/* AI Assistant */}
                    {advice && (
                      <Card style={{ 
                        marginBottom: '28px',
                        background: advice.signal === 'buy' 
                          ? 'rgba(46, 213, 115, 0.08)' 
                          : advice.signal === 'sell' 
                          ? 'rgba(255, 107, 107, 0.08)' 
                          : 'rgba(251, 191, 36, 0.08)',
                        border: `1px solid ${
                          advice.signal === 'buy' 
                            ? 'rgba(46, 213, 115, 0.3)' 
                            : advice.signal === 'sell' 
                            ? 'rgba(255, 107, 107, 0.3)' 
                            : 'rgba(251, 191, 36, 0.3)'
                        } !important`,
                      }}>
                        <Card.Header>
                          <Card.Title>🧠 AI Assistant Recommendation</Card.Title>
                        </Card.Header>
                        <Card.Body>
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ 
                              fontSize: '28px', 
                              fontWeight: '800', 
                              color: advice.signal === 'buy' ? '#2ed573' : advice.signal === 'sell' ? '#ff6b6b' : '#fbbf24',
                              textTransform: 'uppercase',
                              marginBottom: '8px',
                            }}>
                              {advice.signal}
                            </div>
                            {advice.confidence && (
                              <div style={{ fontSize: '14px', color: '#9fb0c2' }}>
                                Confidence: <strong>{Math.round(advice.confidence * 100)}%</strong>
                              </div>
                            )}
                          </div>
                          {advice.decision_summary && (
                            <p style={{ 
                              margin: 0, 
                              fontSize: '15px', 
                              color: '#dbe7f3', 
                              lineHeight: '1.7',
                              borderLeft: '3px solid',
                              borderColor: advice.signal === 'buy' ? '#2ed573' : advice.signal === 'sell' ? '#ff6b6b' : '#fbbf24',
                              paddingLeft: '16px',
                            }}>
                              {advice.decision_summary}
                            </p>
                          )}
                          {advice.current_price != null && (
                            <div style={{ 
                              marginTop: '16px', 
                              fontSize: '13px', 
                              color: '#9fb0c2',
                              paddingTop: '12px',
                              borderTop: '1px solid rgba(255,255,255,0.1)',
                            }}>
                              Current Price: <strong style={{ color: '#00d09c' }}>${advice.current_price.toFixed(2)}</strong>
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    )}
                  </div>
                </div>

                {/* Forecast Chart - Full Width */}
                {forecastFigure && (
                  <Card style={{ marginBottom: '28px' }}>
                    <Card.Header>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <Card.Title>🔮 Price Forecast - Next {forecastDays} Days</Card.Title>
                        <button 
                          className="secondary" 
                          onClick={downloadPredictions}
                          style={{ padding: '10px 20px', fontSize: '14px' }}
                        >
                          📥 Export CSV
                        </button>
                      </div>
                    </Card.Header>
                    <Card.Body>
                      <Plot
                        data={forecastFigure.data}
                        layout={forecastFigure.layout}
                        style={{ width: '100%' }}
                        config={{ responsive: true, displayModeBar: true }}
                      />
                      
                      {predictions && (
                        <div style={{
                          marginTop: '20px',
                          padding: '18px',
                          background: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          borderRadius: '12px',
                        }}>
                          <div style={{ fontSize: '14px', color: '#dbe7f3', lineHeight: '1.7' }}>
                            <strong style={{ color: '#3b82f6' }}>Forecast Summary:</strong> 
                            {' '}The model predicts {predictions.forecast.length} days ahead with a {modelType} algorithm. 
                            Confidence intervals show the range of possible outcomes with 95% probability.
                          </div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                )}
              </>
            )}

            {/* Empty State */}
            {!hasFetchedData && (
              <Card style={{ textAlign: 'center', padding: '100px 48px', marginTop: '40px' }}>
                <div style={{ fontSize: '80px', marginBottom: '24px', opacity: 0.4 }}>📊</div>
                <h3 style={{ fontSize: '28px', marginBottom: '16px', fontWeight: '700', color: '#dbe7f3' }}>
                  No Data Yet
                </h3>
                <p style={{ 
                  color: '#9fb0c2', 
                  marginBottom: '32px', 
                  maxWidth: '600px', 
                  margin: '0 auto 32px',
                  fontSize: '16px',
                  lineHeight: '1.7',
                }}>
                  Configure your parameters above and click <strong style={{ color: '#00d09c' }}>"Fetch Data & Train Model"</strong> to see 
                  comprehensive stock analysis, interactive charts, and AI-powered predictions
                </p>
                <button 
                  className="primary" 
                  onClick={onFetchAndTrain}
                  style={{ padding: '14px 32px', fontSize: '16px' }}
                >
                  🚀 Get Started
                </button>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ========================================
// HELPER COMPONENTS
// ========================================

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ 
        fontSize: 'clamp(32px, 4vw, 44px)', 
        fontWeight: '900', 
        color: '#00d09c', 
        marginBottom: '6px',
        lineHeight: '1',
      }}>
        {value}
      </div>
      <div style={{ 
        fontSize: '13px', 
        color: '#9fb0c2', 
        textTransform: 'uppercase', 
        letterSpacing: '0.08em',
        fontWeight: '600',
      }}>
        {label}
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <Card style={{ textAlign: 'center', padding: '36px 28px' }}>
      <div style={{ fontSize: '56px', marginBottom: '20px' }}>{icon}</div>
      <h3 style={{ 
        fontSize: '20px', 
        fontWeight: '700', 
        marginBottom: '14px',
        color: '#dbe7f3',
      }}>
        {title}
      </h3>
      <p style={{ 
        color: '#9fb0c2', 
        fontSize: '15px', 
        lineHeight: '1.7', 
        margin: 0 
      }}>
        {description}
      </p>
    </Card>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '72px',
        height: '72px',
        margin: '0 auto 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #00d09c, #00b386)',
        color: '#0b1119',
        fontWeight: '900',
        borderRadius: '50%',
        fontSize: '32px',
        boxShadow: '0 8px 24px rgba(0, 208, 156, 0.35)',
      }}>
        {step}
      </div>
      <h4 style={{ 
        fontSize: '20px', 
        fontWeight: '700', 
        marginBottom: '10px',
        color: '#dbe7f3',
      }}>
        {title}
      </h4>
      <p style={{ 
        fontSize: '15px', 
        color: '#9fb0c2', 
        margin: 0,
        lineHeight: '1.6',
      }}>
        {description}
      </p>
    </div>
  );
}

function MetricCard({ title, value, change, isPositive, icon, subtitle }: any) {
  return (
    <Card style={{ textAlign: 'center' }}>
      {icon && <div style={{ fontSize: '40px', marginBottom: '14px' }}>{icon}</div>}
      <p style={{ 
        color: '#9fb0c2', 
        fontSize: '13px', 
        marginBottom: '10px', 
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {title}
      </p>
      <h3 style={{ 
        fontSize: '32px', 
        fontWeight: '800', 
        marginBottom: '8px', 
        color: '#dbe7f3',
        lineHeight: '1',
      }}>
        {value}
      </h3>
      {change && (
        <p className={isPositive ? 'price-up' : 'price-down'} style={{ 
          fontSize: '15px', 
          fontWeight: '700',
          marginBottom: '4px',
        }}>
          {isPositive ? '↑' : '↓'} {change}
        </p>
      )}
      {subtitle && (
        <p style={{ 
          fontSize: '12px', 
          color: '#6b7c8e', 
          marginTop: '6px',
          margin: 0,
        }}>
          {subtitle}
        </p>
      )}
    </Card>
  );
}

function LivePriceCard({ ticker, price, lastUpdate, latestHistoricalPrice }: any) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (price) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(timer);
    }
  }, [price]);

  const changeFromHistorical = price && latestHistoricalPrice ? price - latestHistoricalPrice : null;
  const changePercent = changeFromHistorical && latestHistoricalPrice 
    ? (changeFromHistorical / latestHistoricalPrice) * 100 
    : null;

  return (
    <Card
      className={pulse ? 'pulse-glow' : ''}
      style={{
        background: 'linear-gradient(145deg, rgba(0, 208, 156, 0.15), rgba(0, 191, 166, 0.08)) !important',
        border: '1px solid rgba(0, 208, 156, 0.35) !important',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        marginBottom: '14px',
        justifyContent: 'center',
      }}>
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: '#00d09c',
            boxShadow: '0 0 12px rgba(0, 208, 156, 0.8)',
            animation: 'blink 2s infinite',
          }}
        />
        <span style={{ 
          fontSize: '13px', 
          fontWeight: '700', 
          color: '#00d09c',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          🟢 LIVE PRICE
        </span>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#9fb0c2', marginBottom: '6px' }}>{ticker}</p>
        <h3 style={{ 
          fontSize: '32px', 
          fontWeight: '800', 
          color: '#dbe7f3', 
          margin: '0 0 8px 0',
          lineHeight: '1',
        }}>
          ${price?.toFixed(2) ?? '--'}
        </h3>
        {changeFromHistorical != null && changePercent != null && (
          <p
            className={changeFromHistorical >= 0 ? 'price-up' : 'price-down'}
            style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px' }}
          >
            {changeFromHistorical >= 0 ? '+' : ''}${changeFromHistorical.toFixed(2)} ({changePercent.toFixed(2)}%)
          </p>
        )}
        <p style={{ fontSize: '11px', color: '#6b7c8e', marginTop: '8px' }}>
          Updated {lastUpdate ? Math.round((Date.now() - new Date(lastUpdate).getTime()) / 1000) : 0}s ago
        </p>
      </div>
    </Card>
  );
}

function InputField({ label, value, onChange, placeholder }: any) {
  return (
    <div>
      <label style={{ 
        display: 'block', 
        marginBottom: '10px', 
        fontSize: '14px', 
        color: '#9fb0c2', 
        fontWeight: '600' 
      }}>
        {label}
      </label>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function DateField({ label, value, onChange, inputRef, onIconClick }: any) {
  return (
    <div>
      <label style={{ 
        display: 'block', 
        marginBottom: '10px', 
        fontSize: '14px', 
        color: '#9fb0c2', 
        fontWeight: '600' 
      }}>
        {label}
      </label>
      <div className="input-with-icon">
        <button
          type="button"
          className="input-icon-btn-left"
          onClick={onIconClick}
          aria-label={`Open ${label} picker`}
        >
          <CalendarIcon />
        </button>
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={onChange}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: any) {
  return (
    <label style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px', 
      cursor: 'pointer', 
      userSelect: 'none' 
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ cursor: 'pointer' }}
      />
      <span style={{ fontSize: '14px', fontWeight: '500', color: '#dbe7f3' }}>
        {label}
      </span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: '14px', color: '#9fb0c2', fontWeight: '500' }}>
        {label}
      </span>
      <span style={{ fontSize: '14px', color: '#dbe7f3', fontWeight: '700' }}>
        {value}
      </span>
    </div>
  );
}
