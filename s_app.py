import streamlit as st
import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import warnings
warnings.filterwarnings('ignore')

from utils.data_processor import DataProcessor
from utils.model_trainer import ModelTrainer
from utils.technical_indicators import TechnicalIndicators
from utils.visualizations import Visualizations

# Page configuration
st.set_page_config(
    page_title="Stock Price Prediction Platform",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'data' not in st.session_state:
    st.session_state.data = None
if 'predictions' not in st.session_state:
    st.session_state.predictions = None
if 'model_metrics' not in st.session_state:
    st.session_state.model_metrics = None
# Add login state to session
if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False
if 'user_info' not in st.session_state:
    st.session_state.user_info = {}


def login_page():
    # Add custom CSS for background and form styling
    st.markdown(
        """
        <style>
        .login-header {
            color: #111;
            background: linear-gradient(90deg, #e0eafc 0%, #cfdef3 100%);
            padding: 1.5rem;
            border-radius: 12px;
            text-align: center;
            margin-bottom: 2rem;
            font-size: 2rem;
            font-weight: bold;
            letter-spacing: 1px;
        }
        .stApp {
            background: linear-gradient(120deg, #e0eafc 0%, #cfdef3 100%);
        }
        .login-form {
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(30,60,114,0.08);
            padding: 2rem 2.5rem 1.5rem 2.5rem;
            margin: auto;
            max-width: 400px;
            color: #111;
            color-scheme: light;
        }
        .login-form * label,
        .login-form label,
        .login-form [data-testid="stTextInput"] label,
        .login-form [data-testid="stNumberInput"] label,
        .login-form .st-bb,
        .login-form .st-cz,
        .login-form .st-em,
        .login-form span,
        .login-form div[role="textbox"] label,
        .login-form div[role="spinbutton"] label {
            color: #111 !important;
            -webkit-text-fill-color: #111 !important;
        }
        .login-form ::placeholder {
            color: #555 !important;
            opacity: 1 !important;
        }
        </style>
        """,
        unsafe_allow_html=True
    )
    st.markdown('<div class="login-header">🔐 Welcome to Stock Predictor</div>', unsafe_allow_html=True)
    st.markdown('<div class="login-form">', unsafe_allow_html=True)
    st.markdown('<p style="text-align:center;font-size:1.1rem;color:#111;">Predict the future. Invest smart. Please log in to continue.</p>', unsafe_allow_html=True)
    # Add logo
    st.image("https://img.icons8.com/fluency/96/000000/line-chart.png", width=80)
    # Use columns for icons and fields
    with st.form("login_form"):
        email_col, user_col = st.columns([1,1])
        with email_col:
            email = st.text_input("✉️ Email", key="login_email")
        with user_col:
            username = st.text_input("👤 Username", key="login_username")
        age = st.number_input("🎂 Age", min_value=1, max_value=120, step=1, key="login_age")
        submitted = st.form_submit_button("🚀 Login")
        if submitted:
            if not email or not username or not age:
                st.error("All fields are required.")
            elif age < 18:
                st.error("You must be at least 18 years old to use this platform.")
            else:
                st.session_state.logged_in = True
                st.session_state.user_info = {
                    'email': email,
                    'username': username,
                    'age': age
                }
                st.success(f"Welcome, {username}!")
                st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)



def main():
    # If not logged in, show login page
    if not st.session_state.logged_in:
        login_page()
        return

    st.title("📈 Stock Price Predictor")
    st.markdown("Predict future stock trends using ARIMA/SARIMA models with technical indicators")
    
    # Initialize utility classes
    data_processor = DataProcessor()
    model_trainer = ModelTrainer()
    technical_indicators = TechnicalIndicators()
    visualizations = Visualizations()
    
    # Sidebar for user inputs
    with st.sidebar:
        st.header("🔧 Configuration")
        # CSV upload
        st.subheader("📂 Upload Stock Data (CSV)")
        uploaded_file = st.file_uploader("Choose a CSV file", type=["csv"])
        user_csv_data = None
        if uploaded_file is not None:
            try:
                user_csv_data = pd.read_csv(uploaded_file, parse_dates=["Date"])
                user_csv_data.set_index("Date", inplace=True)
                st.success(f"CSV uploaded: {uploaded_file.name}")
            except Exception as e:
                st.error(f"Invalid CSV file: {str(e)}")
                user_csv_data = None
        
        # Stock ticker input
        ticker = st.text_input(
            "Stock Ticker",
            value="AAPL",
            help="Enter a valid stock ticker symbol (e.g., AAPL, GOOGL, MSFT)"
        ).upper()
        
        # Date range selector
        st.subheader("📅 Date Range")
        col1, col2 = st.columns(2)
        
        with col1:
            start_date = st.date_input(
                "Start Date",
                value=datetime.now() - timedelta(days=365*2),
                max_value=datetime.now() - timedelta(days=1)
            )
        
        with col2:
            end_date = st.date_input(
                "End Date",
                value=datetime.now() - timedelta(days=1),
                max_value=datetime.now()
            )
        
        # Model parameters
        st.subheader("🤖 Model Parameters")
        forecast_days = st.slider(
            "Forecast Days",
            min_value=1,
            max_value=30,
            value=10,
            help="Number of days to forecast into the future"
        )
        
        model_type = st.selectbox(
            "Model Type",
            ["ARIMA", "SARIMA"],
            help="Choose between ARIMA and SARIMA models"
        )
        
        # Technical indicators selection
        st.subheader("📊 Technical Indicators")
        include_sma = st.checkbox("Simple Moving Average (SMA)", value=True)
        include_ema = st.checkbox("Exponential Moving Average (EMA)", value=True)
        include_rsi = st.checkbox("RSI", value=True)
        include_macd = st.checkbox("MACD", value=True)
        include_bollinger = st.checkbox("Bollinger Bands", value=True)
        
        # Fetch data button
        if st.button("📥 Fetch Data & Train Model", type="primary"):
            if uploaded_file is not None and user_csv_data is not None:
                data = user_csv_data.copy()
                st.session_state.data = data
                st.success(f"✅ Successfully loaded {len(data)} records from uploaded CSV.")
            else:
                if not ticker:
                    st.error("Please enter a stock ticker symbol")
                    return
                if start_date >= end_date:
                    st.error("Start date must be before end date")
                    return
                # Fetch and process data
                with st.spinner("Fetching stock data..."):
                    try:
                        data = data_processor.fetch_stock_data(ticker, start_date, end_date)
                        if data is None or data.empty:
                            st.error(f"No data found for ticker {ticker}")
                            return
                        st.session_state.data = data
                        st.success(f"✅ Successfully fetched {len(data)} days of data for {ticker}")
                    except Exception as e:
                        st.error(f"Error fetching data: {str(e)}")
                        return
            # Calculate technical indicators
            with st.spinner("Calculating technical indicators..."):
                try:
                    indicators = {}
                    if include_sma:
                        indicators['SMA'] = technical_indicators.calculate_sma(st.session_state.data['Close'])
                    if include_ema:
                        indicators['EMA'] = technical_indicators.calculate_ema(st.session_state.data['Close'])
                    if include_rsi:
                        indicators['RSI'] = technical_indicators.calculate_rsi(st.session_state.data['Close'])
                    if include_macd:
                        macd_data = technical_indicators.calculate_macd(st.session_state.data['Close'])
                        indicators.update(macd_data)
                    if include_bollinger:
                        bollinger_data = technical_indicators.calculate_bollinger_bands(st.session_state.data['Close'])
                        indicators.update(bollinger_data)
                    st.session_state.data = pd.concat([st.session_state.data, pd.DataFrame(indicators)], axis=1)
                except Exception as e:
                    st.error(f"Error calculating technical indicators: {str(e)}")
                    return
            # Train model
            with st.spinner(f"Training {model_type} model..."):
                try:
                    if model_type == "ARIMA":
                        predictions, metrics = model_trainer.train_arima(
                            st.session_state.data['Close'], forecast_days
                        )
                    else:  # SARIMA
                        predictions, metrics = model_trainer.train_sarima(
                            st.session_state.data['Close'], forecast_days
                        )
                    st.session_state.predictions = predictions
                    st.session_state.model_metrics = metrics
                    st.success(f"✅ {model_type} model trained successfully!")
                except Exception as e:
                    st.error(f"Error training model: {str(e)}")
                    return
    
    # Main content area
    if st.session_state.data is not None:
        col1, col2 = st.columns([2, 1])
        
        with col1:
            st.subheader(f"📊 {ticker} Stock Analysis")
            
            # Display basic statistics
            latest_price = st.session_state.data['Close'].iloc[-1]
            price_change = st.session_state.data['Close'].iloc[-1] - st.session_state.data['Close'].iloc[-2]
            price_change_pct = (price_change / st.session_state.data['Close'].iloc[-2]) * 100
            
            metric_col1, metric_col2, metric_col3, metric_col4 = st.columns(4)
            with metric_col1:
                st.metric("Latest Price", f"${latest_price:.2f}", f"{price_change:.2f} ({price_change_pct:.2f}%)")
            with metric_col2:
                st.metric("High", f"${st.session_state.data['High'].max():.2f}")
            with metric_col3:
                st.metric("Low", f"${st.session_state.data['Low'].min():.2f}")
            with metric_col4:
                st.metric("Volume", f"{st.session_state.data['Volume'].mean():.0f}")
            
            # Historical price chart
            st.subheader("📈 Historical Price & Technical Indicators")
            price_chart = visualizations.create_price_chart(st.session_state.data, ticker)
            st.plotly_chart(price_chart, use_container_width=True)
            
            # Technical indicators chart
            if any([include_rsi, include_macd]):
                st.subheader("📊 Technical Indicators")
                
                if include_rsi and 'RSI' in st.session_state.data.columns:
                    rsi_chart = visualizations.create_rsi_chart(st.session_state.data)
                    st.plotly_chart(rsi_chart, use_container_width=True)
                
                if include_macd and 'MACD' in st.session_state.data.columns:
                    macd_chart = visualizations.create_macd_chart(st.session_state.data)
                    st.plotly_chart(macd_chart, use_container_width=True)
        
        with col2:
            st.subheader("📋 Data Summary")
            
            # Display data info
            start_dt = pd.to_datetime(st.session_state.data.index[0])
            end_dt = pd.to_datetime(st.session_state.data.index[-1])
            st.write(f"**Data Range:** {start_dt.strftime('%Y-%m-%d')} to {end_dt.strftime('%Y-%m-%d')}")
            st.write(f"**Total Records:** {len(st.session_state.data)}")
            
            # Model metrics
            if st.session_state.model_metrics is not None:
                st.subheader("🎯 Model Performance")
                for metric, value in st.session_state.model_metrics.items():
                    st.metric(metric, f"{value:.4f}")
            
            # Predictions summary
            if st.session_state.predictions is not None:
                st.subheader("🔮 Forecast Summary")
                forecast_data = st.session_state.predictions['forecast']
                st.write(f"**Forecast Period:** {len(forecast_data)} days")
                st.write(f"**Predicted Price Range:** ${forecast_data.min():.2f} - ${forecast_data.max():.2f}")
                
                # Export predictions
                if st.button("📥 Export Predictions"):
                    csv = pd.DataFrame(st.session_state.predictions).to_csv()
                    st.download_button(
                        label="Download CSV",
                        data=csv,
                        file_name=f"{ticker}_predictions.csv",
                        mime="text/csv"
                    )
            
            # Display recent data
            st.subheader("📊 Recent Data")
            st.dataframe(
                st.session_state.data[['Open', 'High', 'Low', 'Close', 'Volume']].tail(10),
                use_container_width=True
            )
    
    else:
        st.info("👆 Please configure the parameters in the sidebar and click 'Fetch Data & Train Model' to get started!")
        
        # Show sample usage
        st.subheader("🚀 How to Use")
        st.markdown("""
        1. **Enter a stock ticker** (e.g., AAPL, GOOGL, MSFT)
        2. **Select date range** for historical data
        3. **Choose model type** (ARIMA or SARIMA)
        4. **Select technical indicators** to include
        5. **Click 'Fetch Data & Train Model'** to analyze
        """)
        
        st.subheader("📚 About the Models")
        st.markdown("""
        **ARIMA (AutoRegressive Integrated Moving Average)**
        - Best for stationary time series
        - Captures trends and patterns in historical data
        - Suitable for short to medium-term forecasting
        
        **SARIMA (Seasonal ARIMA)**
        - Extension of ARIMA with seasonal components
        - Captures seasonal patterns in stock prices
        - Better for stocks with clear seasonal behavior
        """)

    # Add logout button at the top right
    st.sidebar.markdown("---")
    if st.sidebar.button("Logout"):
        st.session_state.logged_in = False
        st.session_state.user_info = {}
        st.rerun()

if __name__ == "__main__":
    main() 