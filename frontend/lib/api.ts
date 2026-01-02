import axios from 'axios';
// ... existing imports

// 1. ADD THIS: Define the response type for Finnhub so TypeScript is happy
type FinnhubQuote = {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
};

// ... existing code ...

// 2. REPLACE THE EXISTING getLivePrice FUNCTION WITH THIS:
export async function getLivePrice(ticker: string) {
  // Option A: Direct Frontend Call (Real Data)
  // WARNING: In a production app, you should not expose API keys in the frontend.
  // For a portfolio project or local dashboard, this is acceptable.
  const API_KEY = '4PV82V2URSCMN9OM'; // <--- PASTE YOUR KEY HERE
  
  try {
    // We use standard axios here, not the 'api' instance, to avoid localhost base URL
    const url = `https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${API_KEY}`;
    const { data } = await axios.get<FinnhubQuote>(url);

    // Finnhub returns '0' if the ticker is invalid
    if (data.c === 0 && data.h === 0) {
        throw new Error('Invalid Ticker');
    }

    return {
      ticker: ticker.toUpperCase(),
      price: data.c, // 'c' is the current price property in Finnhub
      timestamp: new Date().toISOString(),
      changePercent: data.dp, // Bonus: You now have percentage change
    };
  } catch (error) {
    console.error("Error fetching live price:", error);
    
    // Fallback: If the API fails, return a safe object or re-throw
    return {
      ticker: ticker,
      price: 0,
      timestamp: new Date().toISOString(),
      error: 'Failed to fetch live price'
    };
  }
}

// Use Next.js API proxy to avoid CORS issues
export const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // increase timeout to 120s to accommodate data fetch and training
  withCredentials: false,
});

export type Ohlcv = {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
};

export async function fetchData(ticker: string, start: string, end: string) {
  try {
    console.log('🔍 DEBUG: fetchData called with:', { ticker, start_date: start, end_date: end });
    console.log('🔍 DEBUG: API base URL:', api.defaults.baseURL);
    
    // Validate inputs before making the request
    if (!ticker || !ticker.trim()) {
      throw new Error('Ticker symbol is required');
    }
    
    if (!start || !end) {
      throw new Error('Start date and end date are required');
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || !dateRegex.test(end)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }
    
    const payload = { ticker, start_date: start, end_date: end };
    console.log('📤 DEBUG: Sending payload to /fetch-data:', payload);
    console.log('📤 DEBUG: Full request URL:', `${api.defaults.baseURL}/fetch-data`);
    
    const { data } = await api.post('/fetch-data', payload);
    console.log('✅ DEBUG: fetchData response received:', data);
    
    // Check if the response contains an error
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data as { data: Ohlcv[] };
  } catch (error: any) {
    console.error('❌ DEBUG: fetchData error:', error);
    
    // Handle different types of errors
    if (error.response) {
      console.error('❌ DEBUG: Response status:', error.response.status);
      console.error('❌ DEBUG: Response data:', error.response.data);
      console.error('❌ DEBUG: Response headers:', error.response.headers);
      console.error('❌ DEBUG: Request URL:', error.config?.url);
      console.error('❌ DEBUG: Request method:', error.config?.method);
      console.error('❌ DEBUG: Request payload:', error.config?.data);
      
      if (error.response.status === 422) {
        // Validation error - try to extract specific error message
        const errorData = error.response.data;
        if (errorData.detail) {
          // FastAPI validation errors
          if (Array.isArray(errorData.detail)) {
            const validationErrors = errorData.detail.map((err: any) => 
              `${err.loc.join('.')}: ${err.msg}`
            ).join(', ');
            throw new Error(`Validation error: ${validationErrors}`);
          } else {
            throw new Error(`Validation error: ${errorData.detail}`);
          }
        } else if (errorData.error) {
          throw new Error(errorData.error);
        } else {
          throw new Error('Invalid request data (422 error)');
        }
      } else if (error.response.status === 400) {
        throw new Error(error.response.data.error || 'Bad request');
      } else if (error.response.status === 500) {
        throw new Error('Server error. Please try again later.');
      }
    }
    
    // Re-throw the error with a user-friendly message
    throw error;
  }
}

export async function indicators(payload: {
  data: Ohlcv[];
  include_sma: boolean;
  include_ema: boolean;
  include_rsi: boolean;
  include_macd: boolean;
  include_bollinger: boolean;
}) {
  try {
    console.log('📤 Calling /indicators endpoint');
    const { data } = await api.post('/indicators', payload);
    console.log('✅ Indicators response received:', data);
    return data as { 
      indicators: Record<string, (number | null)[]>;
      error?: string;
    };
  } catch (error: any) {
    console.error('❌ Indicators error:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      const errorMsg = error.response.data?.error || `Server error: ${error.response.status}`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}

export async function trainModel(payload: {
  dates: string[];
  close: number[];
  model_type: 'ARIMA' | 'SARIMA';
  forecast_days: number;
}) {
  try {
    console.log('📤 Calling /train endpoint with:', { model: payload.model_type, forecast_days: payload.forecast_days });
    const { data } = await api.post('/train', payload);
    console.log('✅ Train response received:', data);
    return data as {
      predictions?: {
        forecast: { date: string; value: number }[];
        lower_ci: { date: string; value: number }[];
        upper_ci: { date: string; value: number }[];
      };
      metrics?: Record<string, number | null>;
      error?: string;
    };
  } catch (error: any) {
    console.error('❌ Train error:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      const errorMsg = error.response.data?.error || `Server error: ${error.response.status}`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}


// Screener
export type ScreenerFilters = {
  rsi_below?: number;
  rsi_above?: number;
  price_change_pct_gt?: number;
  price_change_pct_lt?: number;
  lookback_days?: number;
  macd_cross_bullish?: boolean;
  macd_cross_bearish?: boolean;
};

export async function screenTickers(tickers: string[], filters: ScreenerFilters) {
  // Prefer Next.js proxy first to avoid CORS and network issues; fallback to direct API
  try {
    const { data } = await axios.post('/api/screener', { tickers, filters });
    return data as { results: Array<{ ticker: string; match?: boolean; metrics?: any; error?: string }>; };
  } catch (proxyErr) {
    try {
      const { data } = await api.post('/screener', { tickers, filters });
      return data as { results: Array<{ ticker: string; match?: boolean; metrics?: any; error?: string }>; };
    } catch (directErr) {
      throw directErr;
    }
  }
}

export type AdviceResponse = {
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasons: string[];
  current_price: number | null;
  indicators: Record<string, number | null>;
  forecast: {
    forecast: { date: string; value: number }[];
    lower_ci: { date: string; value: number }[];
    upper_ci: { date: string; value: number }[];
    metrics: Record<string, number | null>;
  };
  expected_return_pct?: number | null;
  risk_level?: 'low' | 'medium' | 'high' | null;
  time_horizon_days?: number;
  targets?: { entry: number | null; stop_loss: number | null; target1: number | null; target2: number | null };
  decision_summary?: string | null;
  performance?: { return_7d: number | null; return_30d: number | null };
  trend_label?: 'up' | 'down' | 'flat' | null;
  alternatives?: { ticker: string; score: number; reasons: string[]; expected_return_pct?: number; return_band?: 'low'|'medium'|'high'; one_liner?: string }[];
  error?: string;
};

export async function getAdvice(payload: {
  data: Ohlcv[];
  model_type: 'ARIMA' | 'SARIMA';
  forecast_days: number;
  ticker?: string;
}) {
  try {
    console.log('📤 Calling /advice endpoint');
    const { data } = await api.post('/advice', payload);
    console.log('✅ Advice response received:', data);
    return data as AdviceResponse;
  } catch (error: any) {
    console.error('❌ Advice error:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      const errorMsg = error.response.data?.error || `Server error: ${error.response.status}`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}

// --- Auth ---
export async function signup(name: string, email: string, password: string) {
  const { data } = await api.post('/signup', { name, email, password });
  return data as { ok: boolean; user?: { name: string; email: string }; };
}

export async function login(email: string, password: string) {
  const { data } = await api.post('/login', { email, password });
  return data as { ok: boolean; user?: { name: string; email: string }; };
}
export async function getFullPrediction(features: any) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/predict/full`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(features),
  });

  return await res.json();
}
export async function fetchPredictionVsReality() {
  const res = await fetch("http://localhost:8000/prediction-vs-reality");
  return res.json();
}
