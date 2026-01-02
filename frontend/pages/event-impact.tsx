import { useState } from "react";
import Head from "next/head";

// Define proper TypeScript interfaces for type safety
interface EventImpactResult {
  ok: boolean;
  stock: string;
  event: string;
  impact: string;
  confidence: number;
  analysis?: string;
  timestamp?: string;
  error?: string;  // Add this for error responses
  details?: string;
  sentiment?: string;
  sentiment_score?: number;
}

interface ErrorState {
  message: string;
  type: 'validation' | 'network' | 'server';
}

export default function EventImpact() {
  const [stock, setStock] = useState<string>("");
  const [event, setEvent] = useState<string>("");
  const [result, setResult] = useState<EventImpactResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [history, setHistory] = useState<EventImpactResult[]>([]);

  // Validation helper function
  const validateInputs = (): boolean => {
    const trimmedStock = stock.trim();
    const trimmedEvent = event.trim();

    if (!trimmedStock || !trimmedEvent) {
      setError({
        message: "Please enter both stock symbol and event description.",
        type: 'validation'
      });
      return false;
    }

    if (trimmedStock.length > 10) {
      setError({
        message: "Stock symbol should be 10 characters or less.",
        type: 'validation'
      });
      return false;
    }

    if (trimmedEvent.length < 5) {
      setError({
        message: "Event description should be at least 5 characters.",
        type: 'validation'
      });
      return false;
    }

    return true;
  };

  // Main analysis function with proper error handling
  const analyze = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setResult(null);

    // Validate inputs before making API call
    if (!validateInputs()) {
      setLoading(false);
      return;
    }

    const trimmedStock = stock.trim().toUpperCase();
    const trimmedEvent = event.trim();

    // Debug log
    console.log("Sending to API:", { stock: trimmedStock, event: trimmedEvent });

    try {
      const res = await fetch("/api/event-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock: trimmedStock,
          event: trimmedEvent,
        }),
      });

      // Parse response
      let data: EventImpactResult;
      try {
        data = await res.json();
      } catch (parseError) {
        throw new Error("Failed to parse server response");
      }

      console.log("API Response:", data);

      // Check for errors in response
      if (!res.ok || !data.ok) {
        const errorMessage = data.error || data.details || `Server error: ${res.status}`;
        throw new Error(errorMessage);
      }

      // Add timestamp to result if not present
      const resultWithTimestamp = {
        ...data,
        timestamp: data.timestamp || new Date().toISOString()
      };

      setResult(resultWithTimestamp);
      
      // Add to history (keep last 5 analyses)
      setHistory(prev => [resultWithTimestamp, ...prev].slice(0, 5));

    } catch (err: any) {
      console.error("Analysis error:", err);
      
      let errorType: 'validation' | 'network' | 'server' = 'server';
      let errorMessage = err.message || "An unexpected error occurred";

      if (err.message.includes('fetch') || err.message.includes('network')) {
        errorType = 'network';
        errorMessage = "Network error. Please check your connection.";
      } else if (err.message.includes('parse')) {
        errorType = 'server';
        errorMessage = "Invalid response from server.";
      }

      setError({
        message: errorMessage,
        type: errorType
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset form handler
  const handleReset = (): void => {
    setStock("");
    setEvent("");
    setResult(null);
    setError(null);
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && e.ctrlKey && !loading) {
      e.preventDefault();
      analyze();
    }
  };

  // Get impact color based on sentiment
  const getImpactColor = (impact: string): string => {
    const lowerImpact = impact.toLowerCase();
    if (lowerImpact.includes('positive') || lowerImpact.includes('bullish')) {
      return '#4ade80';
    } else if (lowerImpact.includes('negative') || lowerImpact.includes('bearish')) {
      return '#f87171';
    }
    return '#fbbf24';
  };

  return (
    <>
      <Head>
        <title>Event Impact Analysis | Lastica</title>
        <meta name="description" content="Analyze stock market event impacts" />
      </Head>

      <main style={{ 
        padding: 32, 
        color: "#fff",
        maxWidth: 800,
        margin: "0 auto",
        minHeight: "100vh"
      }}>
        <h1 style={{ marginBottom: 24, fontSize: 28 }}>📊 Event Impact Analysis</h1>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
            Stock Symbol
          </label>
          <input
            type="text"
            placeholder="e.g., AAPL, GOOGL, TSLA"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            disabled={loading}
            style={{ 
              display: "block", 
              marginBottom: 16, 
              width: "100%",
              maxWidth: 300,
              padding: "10px 12px",
              fontSize: 14,
              border: "1px solid #444",
              borderRadius: 6,
              backgroundColor: "#1a1a1a",
              color: "#fff",
              outline: "none"
            }}
          />

          <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
            Event Description
          </label>
          <textarea
            placeholder="Describe the event (e.g., Q4 earnings beat expectations, merger announcement with competitor, CEO resignation, Fed rate hike announced...)"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={loading}
            style={{ 
              display: "block", 
              marginBottom: 8, 
              width: "100%",
              maxWidth: 500,
              height: 100,
              padding: "10px 12px",
              fontSize: 14,
              border: "1px solid #444",
              borderRadius: 6,
              backgroundColor: "#1a1a1a",
              color: "#fff",
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit"
            }}
          />
          <small style={{ color: "#888", fontSize: 12 }}>
            Press Ctrl+Enter to analyze • Min 5 characters
          </small>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button 
            onClick={analyze} 
            disabled={loading}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 500,
              backgroundColor: loading ? "#555" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background-color 0.2s"
            }}
          >
            {loading ? "Analyzing..." : "Analyze Impact"}
          </button>

          <button 
            onClick={handleReset} 
            disabled={loading}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 500,
              backgroundColor: "#374151",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background-color 0.2s"
            }}
          >
            Reset
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ 
            marginTop: 20,
            padding: 16,
            backgroundColor: "#7f1d1d",
            borderLeft: "4px solid #dc2626",
            borderRadius: 6
          }}>
            <p style={{ margin: 0, fontWeight: 500 }}>
              ❌ {error.type.toUpperCase()} ERROR
            </p>
            <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>
              {error.message}
            </p>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div style={{ 
            marginTop: 24,
            padding: 20,
            backgroundColor: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 8
          }}>
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>
              Analysis Results
            </h2>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <strong style={{ color: "#888" }}>Stock:</strong>{" "}
                <span style={{ fontSize: 16, fontWeight: 500 }}>
                  {result.stock}
                </span>
              </div>

              <div>
                <strong style={{ color: "#888" }}>Event:</strong>{" "}
                <span>{result.event}</span>
              </div>

              <div>
                <strong style={{ color: "#888" }}>Impact:</strong>{" "}
                <span style={{ 
                  color: getImpactColor(result.impact),
                  fontWeight: 500
                }}>
                  {result.impact}
                </span>
              </div>

              <div>
                <strong style={{ color: "#888" }}>Confidence:</strong>{" "}
                <span style={{ fontSize: 16, fontWeight: 500 }}>
                  {result.confidence}%
                </span>
                <div style={{ 
                  marginTop: 8,
                  height: 8,
                  backgroundColor: "#333",
                  borderRadius: 4,
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: `${result.confidence}%`,
                    height: "100%",
                    backgroundColor: result.confidence > 70 ? "#22c55e" : 
                                   result.confidence > 40 ? "#eab308" : "#ef4444",
                    transition: "width 0.5s ease"
                  }} />
                </div>
              </div>

              {result.analysis && (
                <div>
                  <strong style={{ color: "#888" }}>Analysis:</strong>
                  <p style={{ marginTop: 8, lineHeight: 1.6, marginBottom: 0 }}>
                    {result.analysis}
                  </p>
                </div>
              )}

              {result.sentiment && (
                <div>
                  <strong style={{ color: "#888" }}>Sentiment:</strong>{" "}
                  <span style={{ 
                    textTransform: 'capitalize',
                    color: result.sentiment === 'positive' ? '#4ade80' : 
                           result.sentiment === 'negative' ? '#f87171' : '#fbbf24'
                  }}>
                    {result.sentiment}
                  </span>
                </div>
              )}

              {result.timestamp && (
                <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                  Analyzed at: {new Date(result.timestamp).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, color: "#ccc" }}>
              Recent Analyses
            </h3>
            <div style={{ display: "grid", gap: 12 }}>
              {history.map((item, index) => (
                <div 
                  key={index}
                  style={{
                    padding: 12,
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #222",
                    borderRadius: 6,
                    fontSize: 13
                  }}
                >
                  <strong>{item.stock}</strong> - {item.impact}{" "}
                  <span style={{ color: "#666" }}>
                    ({item.confidence}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
