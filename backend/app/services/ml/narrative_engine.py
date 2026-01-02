def generate_narrative(text: str):
    try:
        if not text:
            return {
                "sentiment": "Neutral",
                "narrative": "No text provided for analysis."
            }
        
        positive_words = ["profit", "gain", "growth", "bull", "surge", "jump", "rally", "strong", "beat", "outperform"]
        negative_words = ["loss", "decline", "bear", "crash", "drop", "fall", "weak", "miss", "underperform", "risk"]
        
        text_lower = text.lower()
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count:
            sentiment = "Positive"
        elif negative_count > positive_count:
            sentiment = "Negative"
        else:
            sentiment = "Neutral"
        
        return {
            "sentiment": sentiment,
            "narrative": f"Market shows {sentiment} sentiment based on text analysis."
        }
    except Exception as e:
        print(f"Narrative generation error: {e}")
        return {
            "sentiment": "Neutral",
            "narrative": "Unable to analyze sentiment."
        }
