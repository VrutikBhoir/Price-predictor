import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import time

class DataProcessor:
    def fetch_stock_data(self, ticker: str, start_date, end_date):
        try:
            # Ensure ticker is uppercase and valid
            ticker = ticker.upper().strip()
            if not ticker:
                print("Error: Ticker cannot be empty")
                return None
            
            # Validate dates
            if start_date >= end_date:
                print(f"Error: Start date {start_date} must be before end date {end_date}")
                return None
            
            # Download historical data with progress=True for better error handling
            print(f"Fetching data for {ticker} from {start_date} to {end_date}")
            
            try:
                df = yf.download(ticker, start=start_date, end=end_date, progress=False, threads=False)
            except Exception as download_error:
                print(f"Error downloading data for {ticker}: {download_error}")
                return None

            if df is None or df.empty:
                print(f"No data found for {ticker}")
                return None

            # Fix for new yfinance MultiIndex columns
            if isinstance(df.columns, pd.MultiIndex):
                # Flatten the column names by taking only the first level
                df.columns = df.columns.get_level_values(0)
                print(f"Fixed MultiIndex columns: {df.columns.tolist()}")

            # Get real-time data if end_date is today or in the future
            today = datetime.now().date()
            if end_date >= today:
                try:
                    stock = yf.Ticker(ticker)
                    
                    # Get real-time price data
                    live_data = stock.history(period="1d", interval="1m")
                    
                    if not live_data.empty:
                        # Get the latest minute data
                        latest = live_data.iloc[-1]
                        current_time = datetime.now()
                        
                        # Create real-time entry
                        real_time_data = {
                            "Date": pd.to_datetime(current_time).normalize(),
                            "Open": latest['Open'],
                            "High": latest['High'],
                            "Low": latest['Low'],
                            "Close": latest['Close'],
                            "Volume": latest['Volume']
                        }
                        
                        # Check if today's data already exists
                        today_str = current_time.strftime("%Y-%m-%d")
                        if today_str not in [d.strftime("%Y-%m-%d") for d in df.index]:
                            # Add real-time data
                            real_time_df = pd.DataFrame([real_time_data]).set_index("Date")
                            df = pd.concat([df, real_time_df])
                            print(f"Added real-time data for {ticker}: ${latest['Close']:.2f}")
                        else:
                            # Update today's data with real-time
                            df.loc[today_str] = real_time_data
                            print(f"Updated real-time data for {ticker}: ${latest['Close']:.2f}")
                    
                    # Also try to get additional real-time info
                    try:
                        info = stock.fast_info
                        if hasattr(info, 'last_price') and info.last_price:
                            print(f"Current price for {ticker}: ${info.last_price:.2f}")
                    except:
                        pass
                        
                except Exception as e:
                    print(f"Could not fetch real-time data for {ticker}: {e}")
                    # Continue with historical data only

            print(f"Successfully fetched {len(df)} records for {ticker}")
            return df
            
        except Exception as e:
            print(f"Error fetching stock data for {ticker}: {e}")
            return None

    def get_live_price(self, ticker: str):
        """Get just the current live price for a ticker"""
        try:
            ticker = ticker.upper()
            stock = yf.Ticker(ticker)
            
            # Try multiple methods to get live price
            try:
                # Method 1: Fast info
                price = stock.fast_info.last_price
                if price:
                    return price
            except:
                pass
                
            try:
                # Method 2: Recent history
                recent = stock.history(period="1d", interval="1m")
                if not recent.empty:
                    return recent.iloc[-1]['Close']
            except:
                pass
                
            try:
                # Method 3: Info
                info = stock.info
                if 'regularMarketPrice' in info:
                    return info['regularMarketPrice']
            except:
                pass
                
            return None
            
        except Exception as e:
            print(f"Error getting live price for {ticker}: {e}")
            return None
