'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

// Dark theme matching navbar
const THEME = {
  colors: {
    bg: '#0F1419',
    bgSecondary: '#1A1F29',
    cardBg: '#1E2329',
    bullish: '#00C853',
    bearish: '#FF3B30',
    accent: '#00D09C',
    textPrimary: '#E8EAED',
    textSecondary: '#9AA0A6',
    border: '#2D3139',
  }
};

export default function Dashboard() {
  const router = useRouter();
  const [marketData, setMarketData] = useState([
    { symbol: 'AAPL', name: 'Apple Inc.', price: 178.23, change: 2.45, changePercent: 1.39, volume: '52.3M' },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 242.84, change: -5.21, changePercent: -2.10, volume: '98.7M' },
    { symbol: 'MSFT', name: 'Microsoft', price: 378.91, change: 4.67, changePercent: 1.25, volume: '28.4M' },
    { symbol: 'GOOGL', name: 'Alphabet', price: 141.80, change: -1.23, changePercent: -0.86, volume: '35.2M' },
  ]);

  const [portfolioValue, setPortfolioValue] = useState(125430.50);
  const [dayChange, setDayChange] = useState(2340.25);
  const [dayChangePercent, setDayChangePercent] = useState(1.90);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: THEME.colors.bg, 
      padding: '24px',
      paddingTop: '94px' // Account for fixed navbar
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Page Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '800', 
            color: THEME.colors.textPrimary,
            marginBottom: '8px'
          }}>
            Dashboard
          </h1>
          <p style={{ 
            fontSize: '14px', 
            color: THEME.colors.textSecondary 
          }}>
            Welcome back! Here's your portfolio overview.
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* Portfolio Value Card */}
          <StatCard
            title="Portfolio Value"
            value={`$${portfolioValue.toLocaleString()}`}
            change={dayChange}
            changePercent={dayChangePercent}
            icon="💼"
          />

          {/* Today's Gain/Loss */}
          <StatCard
            title="Today's Change"
            value={`${dayChange >= 0 ? '+' : ''}$${Math.abs(dayChange).toLocaleString()}`}
            change={dayChange}
            changePercent={dayChangePercent}
            icon="📈"
          />

          {/* Active Positions */}
          <StatCard
            title="Active Positions"
            value="12"
            subtitle="4 stocks, 8 options"
            icon="📊"
          />

          {/* Market Status */}
          <div style={{
            background: THEME.colors.cardBg,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${THEME.colors.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>🔔</span>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: THEME.colors.textSecondary, margin: 0 }}>
                Market Status
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: THEME.colors.bullish,
                animation: 'pulse 2s infinite'
              }} />
              <span style={{ fontSize: '20px', fontWeight: '700', color: THEME.colors.textPrimary }}>
                OPEN
              </span>
            </div>
            <p style={{ fontSize: '13px', color: THEME.colors.textSecondary, margin: 0 }}>
              Closes in 3h 24m
            </p>
          </div>
        </div>

        {/* Watchlist Section */}
        <div style={{
          background: THEME.colors.cardBg,
          borderRadius: '12px',
          padding: '24px',
          border: `1px solid ${THEME.colors.border}`,
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: THEME.colors.textPrimary, margin: 0 }}>
              Your Watchlist
            </h2>
            <button style={{
              background: THEME.colors.accent,
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              + Add Stock
            </button>
          </div>

          {/* Stock List */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.colors.border}` }}>
                  <th style={tableHeaderStyle}>Symbol</th>
                  <th style={tableHeaderStyle}>Name</th>
                  <th style={{...tableHeaderStyle, textAlign: 'right'}}>Price</th>
                  <th style={{...tableHeaderStyle, textAlign: 'right'}}>Change</th>
                  <th style={{...tableHeaderStyle, textAlign: 'right'}}>Volume</th>
                  <th style={{...tableHeaderStyle, textAlign: 'right'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {marketData.map((stock) => (
                  <tr 
                    key={stock.symbol}
                    style={{ 
                      borderBottom: `1px solid ${THEME.colors.border}`,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = THEME.colors.bgSecondary}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={tableCellStyle}>
                      <span style={{ fontWeight: '700', color: THEME.colors.textPrimary }}>
                        {stock.symbol}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{ color: THEME.colors.textSecondary }}>
                        {stock.name}
                      </span>
                    </td>
                    <td style={{...tableCellStyle, textAlign: 'right'}}>
                      <span style={{ fontWeight: '600', color: THEME.colors.textPrimary }}>
                        ${stock.price}
                      </span>
                    </td>
                    <td style={{...tableCellStyle, textAlign: 'right'}}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ 
                          color: stock.change >= 0 ? THEME.colors.bullish : THEME.colors.bearish,
                          fontWeight: '600'
                        }}>
                          {stock.change >= 0 ? '+' : ''}{stock.change}
                        </span>
                        <span style={{ 
                          color: stock.change >= 0 ? THEME.colors.bullish : THEME.colors.bearish,
                          fontSize: '12px'
                        }}>
                          ({stock.change >= 0 ? '+' : ''}{stock.changePercent}%)
                        </span>
                      </div>
                    </td>
                    <td style={{...tableCellStyle, textAlign: 'right'}}>
                      <span style={{ color: THEME.colors.textSecondary, fontSize: '14px' }}>
                        {stock.volume}
                      </span>
                    </td>
                    <td style={{...tableCellStyle, textAlign: 'right'}}>
                      <button 
                        onClick={() => router.push(`/stock/${stock.symbol}`)}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${THEME.colors.border}`,
                          color: THEME.colors.accent,
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = THEME.colors.accent;
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = THEME.colors.accent;
                        }}
                      >
                        Predict
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Predictions Section */}
        <div style={{
          background: THEME.colors.cardBg,
          borderRadius: '12px',
          padding: '24px',
          border: `1px solid ${THEME.colors.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '24px' }}>🤖</span>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: THEME.colors.textPrimary, margin: 0 }}>
              AI Predictions
            </h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <PredictionCard
              stock="AAPL"
              prediction="BULLISH"
              confidence={85}
              targetPrice={185.50}
            />
            <PredictionCard
              stock="TSLA"
              prediction="BEARISH"
              confidence={72}
              targetPrice={230.00}
            />
            <PredictionCard
              stock="MSFT"
              prediction="BULLISH"
              confidence={91}
              targetPrice={395.20}
            />
          </div>
        </div>

      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// Stat Card Component
const StatCard = ({ title, value, change, changePercent, subtitle, icon }: any) => (
  <div style={{
    background: THEME.colors.cardBg,
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${THEME.colors.border}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <h3 style={{ fontSize: '14px', fontWeight: '600', color: THEME.colors.textSecondary, margin: 0 }}>
        {title}
      </h3>
    </div>
    <p style={{ fontSize: '28px', fontWeight: '800', color: THEME.colors.textPrimary, margin: '0 0 8px 0' }}>
      {value}
    </p>
    {change !== undefined && (
      <p style={{ 
        fontSize: '14px', 
        fontWeight: '600',
        color: change >= 0 ? THEME.colors.bullish : THEME.colors.bearish,
        margin: 0
      }}>
        {change >= 0 ? '+' : ''}{changePercent}% today
      </p>
    )}
    {subtitle && (
      <p style={{ fontSize: '13px', color: THEME.colors.textSecondary, margin: 0 }}>
        {subtitle}
      </p>
    )}
  </div>
);

// Prediction Card Component
const PredictionCard = ({ stock, prediction, confidence, targetPrice }: any) => (
  <div style={{
    background: THEME.colors.bgSecondary,
    borderRadius: '10px',
    padding: '16px',
    border: `1px solid ${THEME.colors.border}`,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <span style={{ fontSize: '16px', fontWeight: '700', color: THEME.colors.textPrimary }}>
        {stock}
      </span>
      <span style={{
        fontSize: '12px',
        fontWeight: '700',
        color: prediction === 'BULLISH' ? THEME.colors.bullish : THEME.colors.bearish,
        background: prediction === 'BULLISH' ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 59, 48, 0.1)',
        padding: '4px 10px',
        borderRadius: '6px'
      }}>
        {prediction}
      </span>
    </div>
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: THEME.colors.textSecondary }}>Confidence</span>
        <span style={{ fontSize: '12px', fontWeight: '600', color: THEME.colors.textPrimary }}>{confidence}%</span>
      </div>
      <div style={{ 
        width: '100%', 
        height: '6px', 
        background: THEME.colors.border, 
        borderRadius: '3px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${confidence}%`,
          height: '100%',
          background: prediction === 'BULLISH' ? THEME.colors.bullish : THEME.colors.bearish,
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: THEME.colors.textSecondary }}>Target Price</span>
      <span style={{ fontSize: '16px', fontWeight: '700', color: THEME.colors.textPrimary }}>
        ${targetPrice}
      </span>
    </div>
  </div>
);

// Table Styles
const tableHeaderStyle = {
  padding: '12px 16px',
  fontSize: '13px',
  fontWeight: '600',
  color: THEME.colors.textSecondary,
  textAlign: 'left' as const,
};

const tableCellStyle = {
  padding: '16px',
  fontSize: '14px',
};
