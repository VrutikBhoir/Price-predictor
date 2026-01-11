import os
import joblib
import numpy as np


# ============================================
#  Load ML Models
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")

risk_model_path = os.path.join(MODEL_DIR, "risk_model.pkl")
action_model_path = os.path.join(MODEL_DIR, "action_model.pkl")

risk_model = joblib.load(risk_model_path)
action_model = joblib.load(action_model_path)

# The 7 features generated during training
FEATURES = ["close", "ret", "vol5", "sma5", "sma15", "above_sma15", "mom5"]

ACTION_MAP = {0: "SELL", 1: "HOLD", 2: "BUY"}


# ============================================
#   Prediction Core Functions
# ============================================

def preprocess(data: dict):
    """
    Converts incoming features into the correct numpy format.
    """
    return np.array([[data[f] for f in FEATURES]])


def predict_risk(data: dict) -> float:
    x = preprocess(data)
    return float(risk_model.predict(x)[0])


def predict_action(data: dict) -> str:
    x = preprocess(data)
    label = int(action_model.predict(x)[0])
    return ACTION_MAP[label]


def predict_full(data: dict) -> dict:
    risk = predict_risk(data)
    action = predict_action(data)
    explanation = generate_explanation(risk, action, data)

    return {
        "risk_score": risk,
        "action": action,
        "explanation": explanation
    }


# ============================================
#   Simple Explanation Engine
# ============================================

def generate_explanation(risk: float, action: str, f: dict) -> str:

    msg = ""

    # Explain risk level
    if risk < 20:
        msg += "Risk is low due to stable price movement. "
    elif risk < 50:
        msg += "Moderate risk from mild volatility. "
    else:
        msg += "High risk detected from strong downside movement. "

    # Explain action
    if action == "BUY":
        msg += "Market momentum looks positive."
    elif action == "HOLD":
        msg += "Momentum and volatility are balanced."
    else:
        msg += "Negative trends suggest selling pressure."

    return msg
