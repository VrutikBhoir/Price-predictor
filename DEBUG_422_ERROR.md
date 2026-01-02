# 🔍 Debugging the "Request failed with status code 422" Error

## What is a 422 Error?

A **422 Unprocessable Entity** error occurs when the server understands the request but cannot process it due to validation errors. In our case, this typically means the data being sent to the API doesn't match the expected schema.

## 🚨 Common Causes

### 1. **Invalid Date Format**
- **Expected**: `YYYY-MM-DD` (e.g., `2024-01-01`)
- **Problem**: Dates in wrong format or invalid dates
- **Solution**: Ensure dates are in ISO format

### 2. **Empty or Missing Fields**
- **Required fields**: `ticker`, `start_date`, `end_date`
- **Problem**: Missing or empty values
- **Solution**: Validate all required fields are present

### 3. **Invalid Ticker Symbol**
- **Problem**: Empty ticker or invalid stock symbol
- **Solution**: Ensure ticker is not empty and is valid

### 4. **Data Type Mismatch**
- **Problem**: Sending wrong data types
- **Solution**: Ensure all fields are strings

## 🛠️ Debugging Steps

### Step 1: Check Backend Server
```bash
# Make sure backend is running
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Step 2: Test API Health
```bash
curl http://localhost:8000/health
```
Should return: `{"status": "ok"}`

### Step 3: Use the Debug Tools

#### Option A: Python Test Script
```bash
python test_api_debug.py
```

#### Option B: Browser Test
Open `test_api_browser.html` in your browser

### Step 4: Check Console Logs
Look for these in your browser's developer console:
- Request payload being sent
- Response status codes
- Error messages

## 🔧 Fixes Applied

### Backend Improvements
1. **Better validation** in `/fetch-data` endpoint
2. **Detailed error messages** for debugging
3. **Input sanitization** for ticker and dates
4. **Graceful error handling** for yfinance failures

### Frontend Improvements
1. **Client-side validation** before API calls
2. **Better error handling** for 422 responses
3. **Detailed logging** for debugging
4. **User-friendly error messages**

## 📋 Testing Checklist

- [ ] Backend server is running on port 8000
- [ ] Frontend can connect to backend
- [ ] Health endpoint returns 200
- [ ] Valid ticker symbol (e.g., AAPL, GOOGL)
- [ ] Valid date format (YYYY-MM-DD)
- [ ] Start date is before end date
- [ ] No empty fields

## 🐛 Common Scenarios

### Scenario 1: Empty Ticker
```json
{
  "ticker": "",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```
**Result**: 422 error - "Ticker cannot be empty"

### Scenario 2: Invalid Date Format
```json
{
  "ticker": "AAPL",
  "start_date": "01/01/2024",
  "end_date": "12/31/2024"
}
```
**Result**: 422 error - "Invalid date format. Expected YYYY-MM-DD"

### Scenario 3: Missing Fields
```json
{
  "ticker": "AAPL"
  // Missing start_date and end_date
}
```
**Result**: 422 error - "Start date and end date are required"

## 🚀 Quick Fix Commands

```bash
# Start backend
cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Start frontend (in new terminal)
cd frontend && npm run dev

# Test API
python test_api_debug.py
```

## 📞 Still Having Issues?

If you're still getting 422 errors after trying these solutions:

1. **Check the console logs** for specific error messages
2. **Use the debug tools** to isolate the problem
3. **Verify the data being sent** matches the expected format
4. **Check if yfinance is working** (network issues, API limits)

## 🔍 Advanced Debugging

### Enable Verbose Logging
Add this to your backend:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check Network Tab
In browser dev tools, check the Network tab to see:
- Request payload
- Response headers
- Response body
- Status codes

### Test with curl
```bash
curl -X POST "http://localhost:8000/fetch-data" \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL","start_date":"2024-01-01","end_date":"2024-12-31"}'
```

---

**Remember**: The 422 error is usually a validation issue, not a server problem. Check your input data first!
