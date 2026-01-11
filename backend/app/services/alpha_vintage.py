import yfinance as yf
import pandas as pd
import requests
import os
from dotenv import load_dotenv

load_dotenv()

ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY")

def get_historical(symbol: str):
    # 1. Try Alpha Vantage
    if ALPHA_VANTAGE_KEY:
        try:
            url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&apikey={ALPHA_VANTAGE_KEY}&outputsize=full"
            r = requests.get(url, timeout=10)
            data = r.json()
            
            if "Time Series (Daily)" in data:
                df = pd.DataFrame(data["Time Series (Daily)"]).T
                df.index = pd.to_datetime(df.index)
                df = df.sort_index()
                df["Close"] = df["4. close"].astype(float)
                return df["Close"]
        except Exception as e:
            print(f"⚠️ Alpha Vantage failed for history: {e}")

    # 2. Fallback to yfinance
    try:
        print(f"Using yfinance fallback for {symbol} history")
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="2y")
        if df.empty:
             raise ValueError(f"No historical data found for {symbol}")
        if df.index.tz is not None:
             df.index = df.index.tz_localize(None)
        return df["Close"]
    except Exception as e:
        raise ValueError(f"Error fetching historical data for {symbol}: {str(e)}")


def get_live_price(symbol: str):
    # 1. Try Alpha Vantage (Global Quote)
    if ALPHA_VANTAGE_KEY:
        try:
            url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={ALPHA_VANTAGE_KEY}"
            r = requests.get(url, timeout=5)
            data = r.json()
            
            if "Global Quote" in data and "05. price" in data["Global Quote"]:
                price = float(data["Global Quote"]["05. price"])
                return price, str(pd.Timestamp.now())
        except Exception as e:
             print(f"⚠️ Alpha Vantage failed for live price: {e}")

    # 2. Fallback to yfinance
    try:
        print(f"Using yfinance fallback for {symbol} live price")
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="1d", interval="1m")
        if df.empty:
            df = ticker.history(period="1d")
        if df.empty:
            info = ticker.info
            price = info.get('regularMarketPrice') or info.get('currentPrice') or info.get('previousClose')
            if price:
                 return float(price), str(pd.Timestamp.now())
            raise ValueError(f"No live data data found for {symbol}")
        latest = df.iloc[-1]
        price = float(latest["Close"])
        last_time = df.index[-1]
        time_str = str(last_time)
        return price, time_str
    except Exception as e:
        raise ValueError(f"Error fetching live price for {symbol}: {str(e)}")
