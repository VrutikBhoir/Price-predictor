import sys
import json
import os
import pickle
import traceback
from datetime import datetime
# ✅ FastAPI entry function (REQUIRED)
def predict_event_impact(stock: str, event_text: str):
    """
    FastAPI-compatible function
    """
    return predict_event(stock, event_text)

def predict_event(stock: str, event_text: str):
    """
    FastAPI-compatible wrapper for event impact prediction
    """
    try:
        # Try to load model exactly like CLI logic
        script_dir = os.path.dirname(os.path.abspath(__file__))

        possible_paths = [
            os.path.join(script_dir, "models", "event_impact_model.pkl"),
            os.path.join(script_dir, "..", "..", "models", "event_impact_model.pkl"),
            os.path.join(script_dir, "..", "..", "..", "models", "event_impact_model.pkl"),
        ]

        model_path = next((p for p in possible_paths if os.path.exists(p)), None)

        use_ml_model = model_path is not None

        if use_ml_model:
            model = load_model(model_path)
            prediction, confidence = predict_with_model(model, event_text)

            pred_value = int(prediction)
            sentiment = "positive" if pred_value == 1 else "negative"
            impact = f"{sentiment.title()} Impact"

        else:
            # fallback
            pos_count, neg_count = simple_sentiment_analysis(event_text)
            sentiment = "positive" if pos_count > neg_count else "negative"
            confidence = 0.6
            impact = f"{sentiment.title()} Impact (Keyword-based)"

        return {
            "stock": stock,
            "event": event_text,
            "impact": impact,
            "sentiment": sentiment,
            "confidence": round(confidence * 100, 2),
            "model_loaded": use_ml_model
        }

    except Exception as e:
        return {
            "error": str(e),
            "stock": stock,
            "event": event_text
        }

def safe_print(obj):
    """Safely print JSON to stdout"""
    try:
        sys.stdout.write(json.dumps(obj, ensure_ascii=False))
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"Failed to print JSON: {str(e)}\n")
        sys.stderr.flush()

def load_model(model_path):
    """Load the trained model from pickle file"""
    try:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        
        return model
    except Exception as e:
        raise Exception(f"Failed to load model: {str(e)}")

def predict_with_model(model, event_text):
    """Make prediction using the trained model"""
    try:
        # Make prediction
        prediction = model.predict([event_text])[0]
        
        # Get confidence score
        confidence = 0.75  # Default confidence
        
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba([event_text])[0]
            confidence = float(max(proba))
        elif hasattr(model, "decision_function"):
            # For SVM or similar models
            decision = model.decision_function([event_text])[0]
            # Convert to probability-like score
            confidence = 1 / (1 + abs(decision))
        
        return prediction, confidence
        
    except Exception as e:
        raise Exception(f"Prediction failed: {str(e)}")

def simple_sentiment_analysis(event_text):
    """Fallback sentiment analysis if model fails"""
    positive_words = [
        'beat', 'profit', 'growth', 'gain', 'rise', 'surge', 'success', 
        'expand', 'revenue', 'bullish', 'upgrade', 'acquisition', 'breakthrough',
        'innovation', 'increase', 'rally', 'exceed'
    ]
    negative_words = [
        'loss', 'decline', 'miss', 'fall', 'drop', 'layoff', 'scandal', 
        'crisis', 'lawsuit', 'downgrade', 'bankruptcy', 'fraud', 'recall',
        'investigation', 'deficit', 'bearish', 'collapse'
    ]
    
    event_lower = event_text.lower()
    pos_count = sum(1 for word in positive_words if word in event_lower)
    neg_count = sum(1 for word in negative_words if word in event_lower)
    
    return pos_count, neg_count

def main():
    try:
        # Check arguments
        if len(sys.argv) < 3:
            safe_print({
                "ok": False,
                "error": "Insufficient arguments",
                "usage": "python event_impact_predict.py <STOCK> <EVENT>"
            })
            return
        
        stock = sys.argv[1].strip().upper()
        event_text = sys.argv[2].strip()
        
        # Debug logging to stderr
        sys.stderr.write(f"Processing: Stock={stock}, Event={event_text[:50]}...\n")
        sys.stderr.flush()
        
        # Validate inputs
        if not stock or not event_text:
            safe_print({
                "ok": False,
                "error": "Stock and event are required"
            })
            return
        
        if len(event_text) <10:
            safe_print({
                "ok": False,
                "error": "Event description too short (minimum 10 characters only)"
            })
            return
        
        # Get the absolute path to the model
        # Assuming the model is in backend/app/services/ml/models/ or backend/models/
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Try multiple possible model locations
        possible_paths = [
            os.path.join(script_dir, "models", "event_impact_model.pkl"),
            os.path.join(script_dir, "..", "..", "models", "event_impact_model.pkl"),
            os.path.join(script_dir, "..", "..", "..", "models", "event_impact_model.pkl"),
        ]
        
        model_path = None
        for path in possible_paths:
            if os.path.exists(path):
                model_path = path
                break
        
        use_ml_model = model_path is not None
        
        if use_ml_model:
            sys.stderr.write(f"Loading model from: {model_path}\n")
            sys.stderr.flush()
            
            try:
                # Load and use the trained model
                model = load_model(model_path)
                prediction, confidence = predict_with_model(model, event_text)
                
                # Convert prediction to impact label
                pred_value = int(prediction)
                
                if pred_value == 1:
                    sentiment = "positive"
                    impact_direction = "Positive"
                else:
                    sentiment = "negative"
                    impact_direction = "Negative"
                
                # Determine confidence level
                if confidence >= 0.75:
                    confidence_level = "High"
                elif confidence >= 0.6:
                    confidence_level = "Moderate"
                else:
                    confidence_level = "Low"
                
                impact = f"{impact_direction} Impact - {confidence_level} Confidence"
                
                # Get additional sentiment info
                pos_count, neg_count = simple_sentiment_analysis(event_text)
                
                # Generate analysis
                analysis = f"Analysis for {stock}: "
                analysis += f"The ML model predicts a {sentiment} impact with {confidence*100:.1f}% confidence. "
                analysis += f"The event '{event_text[:60]}...' contains {pos_count} positive and {neg_count} negative sentiment indicators. "
                
                if sentiment == "positive":
                    analysis += "The stock may experience upward momentum."
                else:
                    analysis += "The stock may face downward pressure."
                
                method = "ML model prediction"
                
            except Exception as model_error:
                sys.stderr.write(f"Model error: {str(model_error)}, falling back to keyword analysis\n")
                sys.stderr.flush()
                use_ml_model = False
        
        if not use_ml_model:
            # Fallback to keyword-based analysis
            sys.stderr.write("Using keyword-based analysis (model not available)\n")
            sys.stderr.flush()
            
            pos_count, neg_count = simple_sentiment_analysis(event_text)
            
            # Determine impact
            if pos_count > neg_count:
                impact = "Positive Impact - Moderate Confidence"
                sentiment = "positive"
                confidence = min(0.65 + (pos_count * 0.05), 0.90)
            elif neg_count > pos_count:
                impact = "Negative Impact - Moderate Confidence"
                sentiment = "negative"
                confidence = min(0.65 + (neg_count * 0.05), 0.90)
            else:
                impact = "Neutral Impact - Low Confidence"
                sentiment = "neutral"
                confidence = 0.55
            
            # Generate analysis
            analysis = f"Analysis for {stock}: "
            analysis += f"Keyword-based analysis detected {pos_count} positive and {neg_count} negative indicators. "
            analysis += f"The event '{event_text[:60]}...' suggests {sentiment} market sentiment. "
            analysis += "Note: This is a simple keyword analysis. Train and deploy an ML model for better accuracy."
            
            method = "keyword-based (fallback)"
        
        # Success response
        safe_print({
            "ok": True,
            "stock": stock,
            "event": event_text,
            "impact": impact,
            "confidence": round(confidence * 100, 2),
            "analysis": analysis,
            "sentiment": sentiment,
            "sentiment_score": round(confidence, 2),
            "positive_indicators": pos_count,
            "negative_indicators": neg_count,
            "timestamp": datetime.now().isoformat(),
            "method": method,
            "model_loaded": use_ml_model
        })
        
    except Exception as e:
        sys.stderr.write(f"Error in main: {str(e)}\n")
        sys.stderr.write(traceback.format_exc())
        sys.stderr.flush()
        
        safe_print({
            "ok": False,
            "error": str(e),
            "trace": traceback.format_exc() if os.getenv("DEBUG") == "1" else None
        })

if __name__ == "__main__":
    main()
