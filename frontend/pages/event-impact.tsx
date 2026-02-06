import { useState } from "react";
import Head from "next/head";

interface EventImpactResult {
  ok: boolean;
  stock: string;
  event: string;
  sector: string;
  sentiment: string;
  impact: string;
  impact_strength: string;
  confidence_percent: number;
  risk_level: string;
  short_term_outlook: string;
  long_term_outlook: string;
  explanation: string;
}

export default function EventImpact() {
  const [stock, setStock] = useState("");
  const [event, setEvent] = useState("");
  const [result, setResult] = useState<EventImpactResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setError(null);
    setResult(null);

    if (!stock.trim() || !event.trim()) {
      setError("Stock and event are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/event-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock: stock.trim().toUpperCase(),
          event: event.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error("Server error");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const tone = (v: string) =>
    v.toLowerCase().includes("positive") ? "#22c55e" :
    v.toLowerCase().includes("negative") ? "#ef4444" : "#38bdf8";

  return (
    <>
      <Head>
        <title>Event Impact Analysis</title>
      </Head>

      {/* STOCK MARKET THEMED BACKGROUND */}
      <div className="bg">
        {/* Market Grid */}
        <div className="market-grid" />
        
        {/* Floating Stock Tickers */}
        <div className="tickers">
          {['AAPL ↑ $182.50', 'GOOGL ↓ $138.20', 'MSFT ↑ $415.30', 'TSLA ↑ $245.80', 'AMZN ↓ $178.90', 'NVDA ↑ $875.20'].map((ticker, i) => (
            <div 
              key={i} 
              className="ticker" 
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${i * 2}s`,
                animationDuration: `${15 + Math.random() * 10}s`
              }}
            >
              {ticker}
            </div>
          ))}
        </div>

        {/* Candlestick Charts */}
        <div className="candlesticks">
          {[...Array(12)].map((_, i) => (
            <div 
              key={i} 
              className="candlestick" 
              style={{
                left: `${(i * 8) + 5}%`,
                height: `${30 + Math.random() * 60}px`,
                animationDelay: `${i * 0.3}s`,
                background: Math.random() > 0.5 ? '#22c55e' : '#ef4444'
              }}
            />
          ))}
        </div>

        {/* Line Chart Waves */}
        <svg className="chart-waves" viewBox="0 0 1200 400" preserveAspectRatio="none">
          <path 
            className="wave wave1" 
            d="M0,200 Q300,150 600,180 T1200,200" 
            fill="none" 
            stroke="rgba(34, 197, 94, 0.3)" 
            strokeWidth="2"
          />
          <path 
            className="wave wave2" 
            d="M0,220 Q300,270 600,240 T1200,220" 
            fill="none" 
            stroke="rgba(239, 68, 68, 0.3)" 
            strokeWidth="2"
          />
          <path 
            className="wave wave3" 
            d="M0,210 Q300,190 600,220 T1200,210" 
            fill="none" 
            stroke="rgba(56, 189, 248, 0.3)" 
            strokeWidth="2"
          />
        </svg>

        {/* Dollar Signs & Percentage Symbols */}
        <div className="symbols">
          {['$', '%', '↑', '↓', '€', '¥', '£', '₿'].map((symbol, i) => (
            <div 
              key={i} 
              className="symbol" 
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${8 + Math.random() * 12}s`,
                fontSize: `${20 + Math.random() * 30}px`,
                opacity: 0.1 + Math.random() * 0.2
              }}
            >
              {symbol}
            </div>
          ))}
        </div>

        {/* Glowing Orbs */}
        <div className="orbs">
          <div className="orb orb1" />
          <div className="orb orb2" />
          <div className="orb orb3" />
        </div>

        {/* Gradient Overlay */}
        <div className="gradient-overlay" />
      </div>

      <main className="container">
        <h1>📊 Event Impact Intelligence</h1>
        <p className="subtitle">
          AI-driven market reaction analysis for real-world events
        </p>

        {/* INPUT CARD */}
        <section className="card input-card">
          <div className="card-glow" />
          <input
            placeholder="Stock Symbol (AAPL)"
            value={stock}
            onChange={(e) => setStock(e.target.value.toUpperCase())}
          />
          <textarea
            placeholder="Describe the market event..."
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          />
          <button onClick={analyze} disabled={loading}>
            {loading ? (
              <>
                <span className="btn-spinner" />
                Analyzing Market...
              </>
            ) : (
              <>
                <span className="btn-icon">⚡</span>
                Analyze Impact
              </>
            )}
          </button>

          {loading && <div className="loader" />}
          {error && <div className="error">❌ {error}</div>}
        </section>

        {/* RESULT */}
        {result && (
          <>
            <section className="card result-card">
              <div className="card-glow" />
              <h3>📈 Market Snapshot</h3>
              <div className="tags">
                <span className="tag tag-stock">{result.stock}</span>
                <span className="tag tag-sector">{result.sector}</span>
                <span className="tag tag-sentiment" style={{ 
                  borderColor: tone(result.sentiment),
                  color: tone(result.sentiment) 
                }}>
                  {result.sentiment}
                </span>
              </div>
            </section>

            <section className="card metrics-card">
              <div className="card-glow" />
              <h3>💹 Impact & Risk</h3>
              <div className="metrics">
                <Metric label="Impact" value={result.impact} icon="📊" />
                <Metric label="Strength" value={result.impact_strength} icon="⚡" />
                <Metric label="Risk" value={result.risk_level} icon="⚠️" />
              </div>
            </section>

            <section className="card confidence-card">
              <div className="card-glow" />
              <h3>🎯 Confidence Level</h3>
              <div className="confidence">
                <div className="confidence-circle">
                  <svg className="confidence-svg" viewBox="0 0 200 200">
                    <circle
                      cx="100"
                      cy="100"
                      r="90"
                      fill="none"
                      stroke="rgba(30, 41, 59, 0.5)"
                      strokeWidth="12"
                    />
                    <circle
                      cx="100"
                      cy="100"
                      r="90"
                      fill="none"
                      stroke={tone(
                        result.confidence_percent > 70
                          ? "positive"
                          : result.confidence_percent > 40
                          ? "neutral"
                          : "negative"
                      )}
                      strokeWidth="12"
                      strokeDasharray={`${result.confidence_percent * 5.65} 565`}
                      strokeLinecap="round"
                      transform="rotate(-90 100 100)"
                      className="confidence-progress"
                    />
                  </svg>
                  <div className="confidence-number">{result.confidence_percent}%</div>
                </div>
                <div className="bar">
                  <div
                    className="fill"
                    style={{
                      width: `${result.confidence_percent}%`,
                      background: tone(
                        result.confidence_percent > 70
                          ? "positive"
                          : result.confidence_percent > 40
                          ? "neutral"
                          : "negative"
                      ),
                    }}
                  >
                    <div className="shimmer" />
                  </div>
                </div>
              </div>
            </section>

            <section className="card outlook-card">
              <div className="card-glow" />
              <h3>🔮 Market Outlook</h3>
              <div className="outlook-grid">
                <div className="outlook-item short-term">
                  <div className="outlook-header">
                    <span className="outlook-icon">⚡</span>
                    <div>
                      <b>Short-term</b>
                      <span className="outlook-period">0-3 Months</span>
                    </div>
                  </div>
                  <p>{result.short_term_outlook}</p>
                  <div className="outlook-bar">
                    <div className="outlook-fill short" />
                  </div>
                </div>
                <div className="outlook-item long-term">
                  <div className="outlook-header">
                    <span className="outlook-icon">🎯</span>
                    <div>
                      <b>Long-term</b>
                      <span className="outlook-period">6+ Months</span>
                    </div>
                  </div>
                  <p>{result.long_term_outlook}</p>
                  <div className="outlook-bar">
                    <div className="outlook-fill long" />
                  </div>
                </div>
              </div>
            </section>

            <section className="card explanation-card">
              <div className="card-glow" />
              <h3>🤖 AI Analysis</h3>
              <div className="explain-wrapper">
                <div className="explain-icon">💡</div>
                <p className="explain">{result.explanation}</p>
              </div>
            </section>
          </>
        )}
      </main>

      {/* STYLES */}
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        /* STOCK MARKET BACKGROUND */
        .bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          overflow: hidden;
          background: linear-gradient(135deg, #020617 0%, #0a0f1e 50%, #020617 100%);
        }

        .market-grid {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(56, 189, 248, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56, 189, 248, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: gridScroll 20s linear infinite;
        }

        @keyframes gridScroll {
          from { background-position: 0 0; }
          to { background-position: 50px 50px; }
        }

        /* Floating Tickers */
        .tickers {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .ticker {
          position: absolute;
          padding: 8px 16px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 8px;
          color: #38bdf8;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          backdrop-filter: blur(10px);
          animation: tickerFloat 15s infinite ease-in-out;
          white-space: nowrap;
        }

        @keyframes tickerFloat {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 0.3;
          }
          50% {
            transform: translate(100px, -100px) rotate(5deg);
            opacity: 0.7;
          }
        }

        /* Candlesticks */
        .candlesticks {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 200px;
          display: flex;
          align-items: flex-end;
          gap: 2%;
          opacity: 0.15;
        }

        .candlestick {
          position: absolute;
          bottom: 20px;
          width: 15px;
          border-radius: 3px;
          animation: candleGrow 2s ease-out infinite;
          box-shadow: 0 0 20px currentColor;
        }

        @keyframes candleGrow {
          0%, 100% { transform: scaleY(0.8); }
          50% { transform: scaleY(1.2); }
        }

        /* Chart Waves */
        .chart-waves {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 400px;
          opacity: 0.3;
        }

        .wave {
          animation: waveMove 8s ease-in-out infinite;
        }

        .wave1 { animation-delay: 0s; }
        .wave2 { animation-delay: 1s; }
        .wave3 { animation-delay: 2s; }

        @keyframes waveMove {
          0%, 100% { d: path('M0,200 Q300,150 600,180 T1200,200'); }
          50% { d: path('M0,200 Q300,250 600,220 T1200,200'); }
        }

        /* Symbols */
        .symbols {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .symbol {
          position: absolute;
          color: #38bdf8;
          font-weight: 700;
          animation: symbolFloat 10s infinite ease-in-out;
        }

        @keyframes symbolFloat {
          0%, 100% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% { opacity: 0.3; }
          50% {
            transform: translateY(50vh) rotate(180deg);
            opacity: 0.3;
          }
          90% { opacity: 0.3; }
        }

        /* Glowing Orbs */
        .orbs {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          animation: orbFloat 15s infinite ease-in-out;
        }

        .orb1 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.3), transparent);
          top: 10%;
          left: 10%;
        }

        .orb2 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.2), transparent);
          top: 40%;
          right: 10%;
          animation-delay: 3s;
        }

        .orb3 {
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, rgba(34, 197, 94, 0.2), transparent);
          bottom: 10%;
          left: 50%;
          animation-delay: 6s;
        }

        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(50px, -50px) scale(1.1); }
          66% { transform: translate(-50px, 50px) scale(0.9); }
        }

        .gradient-overlay {
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%);
          animation: pulseOverlay 8s ease-in-out infinite;
        }

        @keyframes pulseOverlay {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }

        .container {
          max-width: 1100px;
          margin: auto;
          padding: 60px 40px;
          color: #e5e7eb;
          position: relative;
        }

        h1 {
          font-size: 48px;
          font-weight: 800;
          background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 10px;
          animation: slideDown 0.8s ease;
          text-shadow: 0 0 40px rgba(56, 189, 248, 0.3);
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .subtitle {
          color: #9ca3af;
          margin-bottom: 40px;
          font-size: 16px;
          animation: fadeIn 1s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .card {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 24px;
          padding: 32px;
          margin-bottom: 28px;
          backdrop-filter: blur(20px);
          box-shadow: 
            0 20px 60px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          animation: cardAppear 0.6s ease backwards;
        }

        @keyframes cardAppear {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .card-glow {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.1), transparent 70%);
          animation: cardGlowRotate 10s linear infinite;
          pointer-events: none;
        }

        @keyframes cardGlowRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.15), transparent);
          transition: left 0.6s ease;
        }

        .card:hover::before {
          left: 100%;
        }

        .card:hover {
          transform: translateY(-8px);
          box-shadow: 
            0 30px 80px rgba(56, 189, 248, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          border-color: rgba(56, 189, 248, 0.5);
        }

        .input-card { animation-delay: 0.1s; }
        .result-card { animation-delay: 0.2s; }
        .metrics-card { animation-delay: 0.3s; }
        .confidence-card { animation-delay: 0.4s; }
        .outlook-card { animation-delay: 0.5s; }
        .explanation-card { animation-delay: 0.6s; }

        h3 {
          font-size: 22px;
          margin-bottom: 20px;
          color: #f1f5f9;
          font-weight: 700;
          position: relative;
          z-index: 1;
        }

        input, textarea {
          width: 100%;
          padding: 18px 20px;
          margin-bottom: 18px;
          background: rgba(2, 6, 23, 0.9);
          border: 2px solid #334155;
          border-radius: 16px;
          color: #fff;
          font-size: 16px;
          transition: all 0.3s ease;
          font-family: inherit;
          position: relative;
          z-index: 1;
        }

        input:focus, textarea:focus {
          outline: none;
          border-color: #38bdf8;
          box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.15), 0 0 40px rgba(56, 189, 248, 0.3);
          transform: translateY(-2px);
          background: rgba(2, 6, 23, 1);
        }

        textarea {
          resize: vertical;
          min-height: 120px;
        }

        button {
          width: 100%;
          padding: 18px;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          border: none;
          border-radius: 16px;
          font-weight: 700;
          font-size: 16px;
          color: white;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          box-shadow: 
            0 10px 30px rgba(37, 99, 235, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transition: left 0.5s ease;
        }

        button:hover::before {
          left: 100%;
        }

        button:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 40px rgba(37, 99, 235, 0.5);
        }

        button:active {
          transform: translateY(-1px);
        }

        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .btn-icon {
          font-size: 20px;
        }

        .btn-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loader {
          height: 6px;
          margin-top: 18px;
          background: linear-gradient(90deg, transparent, #2563eb, transparent);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 3px;
          box-shadow: 0 0 20px rgba(37, 99, 235, 0.6);
          position: relative;
          z-index: 1;
        }

        @keyframes loading {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .tags {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          position: relative;
          z-index: 1;
        }

        .tag {
          padding: 10px 20px;
          background: rgba(15, 23, 42, 0.8);
          border: 2px solid rgba(56, 189, 248, 0.4);
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
          animation: tagPop 0.5s ease backwards;
          backdrop-filter: blur(10px);
        }

        @keyframes tagPop {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .tag:nth-child(1) { animation-delay: 0.1s; }
        .tag:nth-child(2) { animation-delay: 0.2s; }
        .tag:nth-child(3) { animation-delay: 0.3s; }

        .tag:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 10px 25px rgba(56, 189, 248, 0.4);
        }

        .tag-stock {
          border-color: #38bdf8;
          color: #38bdf8;
        }

        .tag-sector {
          border-color: #818cf8;
          color: #818cf8;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
          position: relative;
          z-index: 1;
        }

        .confidence {
          text-align: center;
          position: relative;
          z-index: 1;
        }

        .confidence-circle {
          position: relative;
          width: 200px;
          height: 200px;
          margin: 0 auto 30px;
        }

        .confidence-svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }

        .confidence-progress {
          transition: stroke-dasharray 2s cubic-bezier(0.4, 0, 0.2, 1);
          filter: drop-shadow(0 0 10px currentColor);
        }

        .confidence-number {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 48px;
          font-weight: 800;
          background: linear-gradient(135deg, #38bdf8, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: pulse 2s ease infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
        }

        .bar {
          height: 16px;
          background: rgba(30, 41, 59, 0.8);
          border-radius: 12px;
          margin-top: 10px;
          overflow: hidden;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
          position: relative;
        }

        .fill {
          height: 100%;
          border-radius: 12px;
          transition: width 1.5s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          box-shadow: 0 0 20px currentColor;
        }

        .shimmer {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          to { left: 100%; }
        }

        .outlook-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          position: relative;
          z-index: 1;
        }

        .outlook-item {
          padding: 24px;
          background: rgba(2, 6, 23, 0.7);
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 16px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .outlook-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.1), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .outlook-item:hover::before {
          opacity: 1;
        }

        .outlook-item:hover {
          transform: translateY(-5px);
          background: rgba(2, 6, 23, 0.9);
          border-color: rgba(56, 189, 248, 0.5);
          box-shadow: 0 15px 40px rgba(56, 189, 248, 0.3);
        }

        .outlook-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .outlook-icon {
          font-size: 28px;
          animation: bounce 2s infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .outlook-header b {
          display: block;
          font-size: 16px;
          margin-bottom: 4px;
        }

        .outlook-period {
          display: block;
          font-size: 12px;
          color: #64748b;
          font-weight: normal;
        }

        .outlook-item p {
          line-height: 1.7;
          color: #d1d5db;
          margin-bottom: 16px;
        }

        .outlook-bar {
          height: 4px;
          background: rgba(30, 41, 59, 0.5);
          border-radius: 2px;
          overflow: hidden;
        }

        .outlook-fill {
          height: 100%;
          animation: barGrow 2s ease-out;
        }

        .outlook-fill.short {
          background: linear-gradient(90deg, #38bdf8, #818cf8);
          width: 70%;
        }

        .outlook-fill.long {
          background: linear-gradient(90deg, #22c55e, #10b981);
          width: 85%;
        }

        @keyframes barGrow {
          from { width: 0; }
        }

        .explain-wrapper {
          display: flex;
          gap: 20px;
          align-items: flex-start;
          position: relative;
          z-index: 1;
        }

        .explain-icon {
          font-size: 40px;
          flex-shrink: 0;
          animation: bounce 2s infinite;
        }

        .explain {
          line-height: 1.9;
          color: #e2e8f0;
          font-size: 15px;
          padding: 20px;
          background: rgba(2, 6, 23, 0.5);
          border-left: 4px solid #38bdf8;
          border-radius: 8px;
          flex: 1;
        }

        .error {
          margin-top: 18px;
          background: rgba(127, 29, 29, 0.4);
          border: 1px solid #991b1b;
          padding: 16px;
          border-radius: 14px;
          color: #fca5a5;
          font-weight: 600;
          animation: shake 0.5s ease;
          position: relative;
          z-index: 1;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .container {
            padding: 40px 20px;
          }

          h1 {
            font-size: 32px;
          }

          .card {
            padding: 24px;
          }

          .confidence-circle {
            width: 150px;
            height: 150px;
          }

          .confidence-number {
            font-size: 36px;
          }

          .metrics {
            grid-template-columns: 1fr;
          }

          .outlook-grid {
            grid-template-columns: 1fr;
          }

          .tickers {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

function Metric({ label, value, icon }: any) {
  return (
    <div className="metric-item">
      <div className="metric-icon">{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      
      <style jsx>{`
        .metric-item {
          padding: 24px;
          background: rgba(2, 6, 23, 0.7);
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 16px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          text-align: center;
        }

        .metric-item::before {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: linear-gradient(90deg, #38bdf8, #818cf8);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
        }

        .metric-item:hover::before {
          transform: scaleX(1);
        }

        .metric-item:hover {
          transform: translateY(-5px) scale(1.02);
          background: rgba(2, 6, 23, 0.9);
          border-color: rgba(56, 189, 248, 0.5);
          box-shadow: 0 15px 40px rgba(56, 189, 248, 0.3);
        }

        .metric-icon {
          font-size: 32px;
          margin-bottom: 12px;
          animation: iconBounce 2s infinite;
        }

        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        .metric-label {
          color: #9ca3af;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .metric-value {
          font-size: 22px;
          font-weight: 700;
          color: #f1f5f9;
        }
      `}</style>
    </div>
  );
}
