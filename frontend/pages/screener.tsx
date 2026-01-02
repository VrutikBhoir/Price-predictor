import { useState } from 'react';
import Head from 'next/head';
import { screenTickers, ScreenerFilters } from '../lib/api';

export default function ScreenerPage() {
  const [tickers, setTickers] = useState('AAPL, MSFT, TSLA, NVDA, AMZN');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ ticker: string; match?: boolean; metrics?: any; error?: string }>>([]);
  const [filters, setFilters] = useState<ScreenerFilters>({ lookback_days: 60 });

  const run = async () => {
    try {
      setLoading(true);
      const list = (tickers || '').split(',').map(t => t.trim()).filter(Boolean);
      const res = await screenTickers(list, filters);
      setResults(res.results || []);
    } catch (error) {
      console.error('Screener error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate match score (0-100)
  const getScore = (metrics: any) => {
    if (!metrics) return 0;
    let score = 50;
    
    if (metrics.rsi < 30) score += 20; // Oversold
    else if (metrics.rsi > 70) score -= 20; // Overbought
    
    if (metrics.macd_cross_bullish) score += 20;
    if (metrics.macd_cross_bearish) score -= 20;
    
    if (metrics.price_change_pct > 5) score += 10;
    else if (metrics.price_change_pct < -5) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  };

  // Get signal label based on score
  const getSignal = (score: number) => {
    if (score >= 80) return { label: '🟢 Strong Buy', color: 'text-green-400' };
    if (score >= 60) return { label: '🟡 Buy', color: 'text-yellow-400' };
    if (score >= 40) return { label: '⚪ Neutral', color: 'text-gray-400' };
    if (score >= 20) return { label: '🟠 Risky', color: 'text-orange-400' };
    return { label: '🔴 Avoid', color: 'text-red-400' };
  };

  // Get RSI color
  const getRSIColor = (rsi: number) => {
    if (rsi < 30) return 'text-green-400 font-bold';
    if (rsi > 70) return 'text-red-400 font-bold';
    return 'text-gray-300';
  };

  // Get price change color
  const getPriceChangeColor = (change: number) => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-300';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <Head><title>Stock Screener | LASTICA</title></Head>
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🧮 Stock Screener</h1>
        <p className="text-gray-400">Filter stocks by technical indicators and metrics</p>
      </div>

      {/* Filters Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6 shadow-xl">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-blue-400">⚙️</span> Configuration
        </h2>
        
        <div className="space-y-4">
          {/* Tickers Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tickers (comma-separated)
            </label>
            <input 
              type="text"
              value={tickers} 
              onChange={(e) => setTickers(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="AAPL, MSFT, TSLA, NVDA"
            />
          </div>

          {/* Filter Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">RSI Below</label>
              <input 
                type="number" 
                placeholder="e.g., 30"
                onChange={(e) => setFilters(f => ({ ...f, rsi_below: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Price Change % {'>'}</label>
              <input 
                type="number" 
                placeholder="e.g., 5"
                onChange={(e) => setFilters(f => ({ ...f, price_change_pct_gt: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Price Change % {'<'}</label>
              <input 
                type="number" 
                placeholder="e.g., -5"
                onChange={(e) => setFilters(f => ({ ...f, price_change_pct_lt: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Lookback Days</label>
              <input 
                type="number" 
                defaultValue={60}
                onChange={(e) => setFilters(f => ({ ...f, lookback_days: Number(e.target.value) || 60 }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                onChange={(e) => setFilters(f => ({ ...f, macd_cross_bullish: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-gray-300">📈 MACD Bullish Cross</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                onChange={(e) => setFilters(f => ({ ...f, macd_cross_bearish: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-gray-300">📉 MACD Bearish Cross</span>
            </label>
          </div>

          {/* Run Button */}
          <button 
            onClick={run} 
            disabled={loading}
            className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Running...
              </>
            ) : (
              <>🚀 Run Screener</>
            )}
          </button>
        </div>
      </div>

      {/* Results Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 shadow-xl">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-green-400">📊</span> Results
          {results.length > 0 && (
            <span className="text-sm text-gray-400 ml-2">({results.length} stocks)</span>
          )}
        </h3>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-400">Analyzing stocks...</p>
            </div>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Ticker</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Price</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">RSI</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Δ%</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-300">Bull</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-300">Bear</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Score</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Signal</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-300">Match</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const score = getScore(r.metrics);
                  const signal = getSignal(score);
                  
                  return (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">{r.ticker}</td>
                      <td className="py-3 px-4">
                        {r.metrics?.price != null ? `$${Number(r.metrics.price).toFixed(2)}` : '—'}
                      </td>
                      <td className={`py-3 px-4 ${r.metrics?.rsi != null ? getRSIColor(r.metrics.rsi) : 'text-gray-500'}`}>
                        {r.metrics?.rsi != null ? Number(r.metrics.rsi).toFixed(1) : '—'}
                      </td>
                      <td className={`py-3 px-4 font-semibold ${r.metrics?.price_change_pct != null ? getPriceChangeColor(r.metrics.price_change_pct) : 'text-gray-500'}`}>
                        {r.metrics?.price_change_pct != null ? `${Number(r.metrics.price_change_pct).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {r.metrics?.macd_cross_bullish === true ? '✅' : (r.metrics?.macd_cross_bullish === false ? '❌' : '—')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {r.metrics?.macd_cross_bearish === true ? '✅' : (r.metrics?.macd_cross_bearish === false ? '❌' : '—')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-gray-700 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${score >= 60 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-400">{score}</span>
                        </div>
                      </td>
                      <td className={`py-3 px-4 font-semibold ${signal.color}`}>
                        {signal.label}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {r.match === true ? '✅' : (r.match === false ? '❌' : (r.error ? `⚠️ ${r.error}` : '—'))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-400 text-lg">No results yet. Configure filters and run a screen above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
