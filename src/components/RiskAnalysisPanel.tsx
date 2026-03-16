import React, { useEffect, useRef } from 'react';
import { AlertTriangle, TrendingUp, Tag, Brain, FileText } from 'lucide-react';
import type { Emotion, VoiceAuthenticity } from '../types';

interface RiskAnalysisPanelProps {
    riskScore: number;
    emotion: Emotion;
    keywords: string[];
    transcripts: { text: string; timestamp: string; emotion: Emotion }[];
    voiceAuthenticity: VoiceAuthenticity;
    scamSignals: string[];
}

const EMOTION_CONFIG: Record<Emotion, { label: string; color: string; bg: string }> = {
    neutral: { label: 'Neutral', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
    urgency: { label: 'Urgency', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    fear: { label: 'Fear', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    pressure: { label: 'Pressure', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    aggression: { label: 'Aggression', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
};

function getRiskConfig(score: number) {
    if (score >= 70) return { label: 'HIGH RISK', color: '#ef4444', glow: 'rgba(239,68,68,0.4)', textClass: 'text-red-400' };
    if (score >= 40) return { label: 'MEDIUM', color: '#f59e0b', glow: 'rgba(245,158,11,0.4)', textClass: 'text-yellow-400' };
    return { label: 'LOW', color: '#22c55e', glow: 'rgba(34,197,94,0.4)', textClass: 'text-green-400' };
}

const RiskMeter: React.FC<{ score: number }> = ({ score }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cfg = getRiskConfig(score);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H - 10;
        const R = W / 2 - 16;

        ctx.clearRect(0, 0, W, H);

        ctx.beginPath();
        ctx.arc(cx, cy, R, Math.PI, 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';
        ctx.stroke();

        const angle = Math.PI + (score / 100) * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, R, Math.PI, angle);
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';
        ctx.shadowColor = cfg.glow;
        ctx.shadowBlur = 20;
        ctx.stroke();

        ctx.shadowBlur = 0;
        for (let i = 0; i <= 10; i++) {
            const a = Math.PI + (i / 10) * Math.PI;
            const x1 = cx + (R - 12) * Math.cos(a);
            const y1 = cy + (R - 12) * Math.sin(a);
            const x2 = cx + (R + 12) * Math.cos(a);
            const y2 = cy + (R + 12) * Math.sin(a);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        const needleAngle = Math.PI + (score / 100) * Math.PI;
        const nx = cx + (R - 28) * Math.cos(needleAngle);
        const ny = cy + (R - 28) * Math.sin(needleAngle);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.shadowColor = cfg.glow;
        ctx.shadowBlur = 8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = cfg.glow;
        ctx.shadowBlur = 10;
        ctx.fill();
    }, [score, cfg.color, cfg.glow]);

    return (
        <div className="flex flex-col items-center">
            <canvas ref={canvasRef} width={220} height={120} className="w-full max-w-[220px]" />
            <div className="text-center -mt-2">
                <p className={`text-4xl font-bold ${cfg.textClass}`}>{score}</p>
                <p className={`text-xs font-semibold tracking-widest mt-1 ${cfg.textClass}`}>{cfg.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">Risk Score</p>
            </div>
            <div className="flex items-center justify-between w-full max-w-[220px] mt-2 px-2">
                <span className="text-xs text-green-400 font-medium">LOW</span>
                <span className="text-xs text-yellow-400 font-medium">MED</span>
                <span className="text-xs text-red-400 font-medium">HIGH</span>
            </div>
        </div>
    );
};

const RiskAnalysisPanel: React.FC<RiskAnalysisPanelProps> = ({
    riskScore, emotion, keywords, transcripts, voiceAuthenticity, scamSignals,
}) => {
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    const emotionCfg = EMOTION_CONFIG[emotion];
    const voiceStatus = voiceAuthenticity.label === 'suspected_ai'
        ? { label: 'Suspected AI Voice', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' }
        : voiceAuthenticity.label === 'human'
            ? { label: 'Likely Human Voice', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' }
            : { label: 'Voice Check Unavailable', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' };

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcripts]);

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="glass rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-yellow-400" />
                    Risk Meter
                </h2>
                <RiskMeter score={riskScore} />
            </div>

            <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Detected Emotion
                </h3>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${emotionCfg.bg} ${emotionCfg.color}`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    {emotionCfg.label}
                </div>
            </div>

            <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Voice Authenticity
                </h3>
                <div className={`rounded-2xl border px-4 py-3 ${voiceStatus.bg}`}>
                    <div className="flex items-center justify-between gap-3">
                        <span className={`text-sm font-semibold ${voiceStatus.color}`}>{voiceStatus.label}</span>
                        <span className="text-xs text-gray-500">
                            {voiceAuthenticity.score === null ? 'No score' : `${voiceAuthenticity.score}% confidence`}
                        </span>
                    </div>
                    {voiceAuthenticity.source && (
                        <p className="text-xs text-gray-500 mt-2">Detected source: {voiceAuthenticity.source}</p>
                    )}
                </div>
            </div>

            <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Scam Keywords Detected
                    {keywords.length > 0 && (
                        <span className="ml-auto bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2 py-0.5 rounded-full">
                            {keywords.length}
                        </span>
                    )}
                </h3>
                {keywords.length === 0 ? (
                    <p className="text-sm text-gray-500">No scam keywords detected yet.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {keywords.map(keyword => (
                            <span
                                key={keyword}
                                className="px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-1"
                            >
                                <AlertTriangle className="w-3 h-3" />
                                {keyword}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Scam Pattern Signals
                </h3>
                {scamSignals.length === 0 ? (
                    <p className="text-sm text-gray-500">No high-confidence scam patterns detected yet.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {scamSignals.map(signal => (
                            <span key={signal} className="px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-xs font-medium">
                                {signal}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Live Transcript
                </h3>
                {transcripts.length === 0 ? (
                    <p className="text-sm text-gray-500">Transcript will appear here as you speak...</p>
                ) : (
                    <div className="max-h-48 overflow-y-auto space-y-3 pr-1">
                        {transcripts.map((transcript, index) => (
                            <div key={index} className="text-sm text-gray-300 bg-white/3 rounded-xl p-3 border border-white/5">
                                <p className="leading-relaxed">&quot;{transcript.text}&quot;</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className={`text-xs font-medium ${EMOTION_CONFIG[transcript.emotion].color}`}>
                                        {EMOTION_CONFIG[transcript.emotion].label}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                        {new Date(transcript.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                        <div ref={transcriptEndRef} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default RiskAnalysisPanel;
