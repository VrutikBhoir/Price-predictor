import requests
import pandas as pd

API_KEY = "4PV82V2URSCMN9OM"

def get_historical(symbol: str):
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "TIME_SERIES_DAILY",
        "symbol": symbol,
        "apikey": API_KEY,
        "outputsize": "compact"
    }

    r = requests.get(url, params=params).json()
    ts = r["Time Series (Daily)"]

    df = pd.DataFrame(ts).T
    df.index = pd.to_datetime(df.index)
    df = df.sort_index()
    df["close"] = df["4. close"].astype(float)

    return df["close"]


def get_live_price(symbol: str):
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "TIME_SERIES_INTRADAY",
        "symbol": symbol,
        "interval": "1min",
        "apikey": API_KEY
    }

    r = requests.get(url, params=params).json()
    ts = r["Time Series (1min)"]

    latest_time = sorted(ts.keys())[-1]
    return float(ts[latest_time]["4. close"]), latest_time
