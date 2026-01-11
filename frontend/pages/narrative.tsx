import React, { useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface AnalysisResult {
    sentiment: 'Positive' | 'Negative' | 'Neutral';
    confidence: number;
    scores: { pos: number; neg: number; neu: number; compound: number };
    narrative: string;
    key_phrases: string[];
    word_count: number;
}

const API_URL = 'http://localhost:5000/analyze';

const NarrativeEngineDashboard: React.FC = () => {
    const [text, setText] = useState('');
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);

    const analyzeText = async () => {
        if (!text.trim()) return;
        setLoading(true);
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        setResult(await res.json());
        setLoading(false);
    };

    const chartData = result && {
        labels: ['Positive', 'Negative', 'Neutral'],
        datasets: [
            {
                data: [
                    result.scores.pos * 100,
                    result.scores.neg * 100,
                    result.scores.neu * 100,
                ],
                backgroundColor: ['#22c55e', '#ef4444', '#3b82f6'],
                borderRadius: 12,
            },
        ],
    };

    return (
        <div style={styles.page}>
            {/* HEADER */}
            <header style={styles.header}>
                <h1 style={styles.title}>Narrative Engine</h1>
                <p style={styles.subtitle}>
                    Financial Sentiment Intelligence Platform
                </p>
            </header>

            {/* INPUT CARD */}
            <div style={styles.card}>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste financial news, earnings report, or market commentary..."
                    style={styles.textarea}
                />

                <button onClick={analyzeText} disabled={loading} style={styles.button}>
                    {loading ? 'Analyzing…' : 'Analyze Sentiment'}
                </button>
            </div>

            {/* RESULTS */}
            {result && (
                <>
                    <div style={{ ...styles.card, height: 340 }}>
                        <Bar
                            data={chartData!}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: { y: { min: 0, max: 100 } },
                            }}
                        />
                    </div>

                    <div style={styles.metrics}>
                        <Metric title="Positive" value={result.scores.pos} color="#22c55e" />
                        <Metric title="Negative" value={result.scores.neg} color="#ef4444" />
                        <Metric title="Neutral" value={result.scores.neu} color="#3b82f6" />
                    </div>

                    <div style={styles.card}>
                        <h3 style={{ marginBottom: '0.8rem' }}>📌 Insight</h3>
                        <p>{result.narrative}</p>
                        <p style={styles.muted}>
                            Confidence: {(result.confidence * 100).toFixed(1)}%
                        </p>
                        <p style={styles.muted}>
                            Key Signals: {result.key_phrases.join(', ') || 'None'}
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};

/* ---------------- COMPONENTS ---------------- */

const Metric = ({ title, value, color }: any) => (
    <div style={{ ...styles.metric, borderColor: color }}>
        <h4 style={{ color }}>{title}</h4>
        <p style={styles.metricValue}>{(value * 100).toFixed(1)}%</p>
    </div>
);

/* ---------------- STYLES ---------------- */

const styles: any = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0B0F1A, #020617)',
        padding: '3rem',
        color: '#E5E7EB',
        fontFamily: 'Inter, system-ui',
    },
    header: {
        textAlign: 'center',
        marginBottom: '2.5rem',
    },
    title: {
        fontSize: '2.8rem',
        fontWeight: 800,
        letterSpacing: '1px',
    },
    subtitle: {
        color: '#9CA3AF',
        marginTop: '0.5rem',
    },
    card: {
        background: '#111827',
        borderRadius: '20px',
        padding: '2rem',
        border: '1px solid #1F2937',
        marginBottom: '2rem',
        maxWidth: 900,
        marginInline: 'auto',
    },
    textarea: {
        width: '100%',
        height: 140,
        background: '#020617',
        border: '1px solid #1F2937',
        borderRadius: '14px',
        padding: '1.2rem',
        color: '#E5E7EB',
        fontSize: '1rem',
        outline: 'none',
        marginBottom: '1.5rem',
    },
    button: {
        width: '100%',
        padding: '0.9rem',
        borderRadius: '999px',
        background: 'linear-gradient(90deg, #22c55e, #3b82f6)',
        border: 'none',
        color: '#020617',
        fontWeight: 600,
        cursor: 'pointer',
    },
    metrics: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.5rem',
        maxWidth: 900,
        margin: '0 auto 2rem',
    },
    metric: {
        background: '#020617',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid',
        textAlign: 'center',
    },
    metricValue: {
        fontSize: '2rem',
        fontWeight: 700,
    },
    muted: {
        color: '#9CA3AF',
        marginTop: '0.4rem',
    },
};

export default NarrativeEngineDashboard;