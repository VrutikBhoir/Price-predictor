from flask import Flask, request, jsonify
from flask_cors import CORS
import re

app = Flask(__name__)
CORS(app)


class SentimentEngine:
    def __init__(self):
        self.positive_patterns = [
            r'\b(growth|profit|profits|strong|improved|record|gain|positive|increase|beat)\b'
        ]
        self.negative_patterns = [
            r'\b(loss|decline|drop|risk|pressure|inflation|costs|weak|fall|negative)\b'
        ]
        self.neutral_patterns = [
            r'\b(stable|steady|forecast|future|conditions|aligned|expected|moderate)\b'
        ]

    def _count_matches(self, text, patterns):
        count = 0
        for pattern in patterns:
            matches = re.findall(pattern, text)
            count += len(matches)
        return count

    def analyze(self, text):
        text = text.lower()

        pos_count = self._count_matches(text, self.positive_patterns)
        neg_count = self._count_matches(text, self.negative_patterns)
        neu_count = self._count_matches(text, self.neutral_patterns)

        # FORCE MIXED DISTRIBUTION IF CONTENT IS MIXED
        if pos_count == 0 and neg_count == 0 and neu_count == 0:
            pos_count = neg_count = neu_count = 1

        total = pos_count + neg_count + neu_count

        pos_score = round(pos_count / total, 3)
        neg_score = round(neg_count / total, 3)
        neu_score = round(neu_count / total, 3)

        scores = {
            "pos": pos_score,
            "neg": neg_score,
            "neu": neu_score,
            "compound": round(pos_score - neg_score, 3)
        }

        overall_sentiment = max(
            [("Positive", pos_score), ("Negative", neg_score), ("Neutral", neu_score)],
            key=lambda x: x[1]
        )[0]

        confidence = round(max(pos_score, neg_score, neu_score), 2)

        return {
            "sentiment": overall_sentiment,
            "confidence": confidence,
            "scores": scores,
            "word_count": len(text.split()),
            "analysis_type": "distribution_based",
            "message": "Sentiment calculated using independent signal distribution"
        }



def generate_narrative(text):
    engine = SentimentEngine()
    return engine.analyze(text)


@app.route("/analyze", methods=["POST"])
def analyze_sentiment():
    data = request.get_json()

    if not data or "text" not in data:
        return jsonify({"error": "Text field is required"}), 400

    engine = SentimentEngine()
    result = engine.analyze(data["text"])

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)