import { useState, useRef, useCallback, useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { addNativeScamMonitorListener, isNativeScamMonitorAvailable, ScamMonitor } from '../lib/scamMonitor';
import type { AnalysisResult, CallStatus, Emotion } from '../types';

const SCAM_KEYWORDS = [
    'bank', 'account', 'blocked', 'arrest', 'police', 'irs', 'tax',
    'refund', 'verify', 'social security', 'otp', 'password', 'urgent',
    'immediately', 'credit card', 'wire transfer', 'gift card', 'bitcoin',
    'suspended', 'lawsuit', 'warrant', 'fraud', 'penalty', 'overdue',
    'aadhaar', 'pan card', 'kyc', 'debit', 'loan', 'court',
];

const EMOTION_TRIGGERS: Record<Emotion, string[]> = {
    urgency: ['immediately', 'urgent', 'now', 'today', 'deadline', 'overdue', 'quickly'],
    fear: ['arrest', 'police', 'court', 'lawsuit', 'warrant', 'penalty', 'jail'],
    pressure: ['must', 'have to', 'required', 'mandatory', 'no choice', 'otherwise'],
    aggression: ['demand', 'pay', 'fine', 'forfeit', 'seized', 'confiscate'],
    neutral: [],
};

function detectEmotion(text: string): Emotion {
    const lower = text.toLowerCase();
    for (const [emotion, triggers] of Object.entries(EMOTION_TRIGGERS) as [Emotion, string[]][]) {
        if (emotion === 'neutral') continue;
        if (triggers.some(t => lower.includes(t))) return emotion;
    }
    return 'neutral';
}

function detectKeywords(text: string): string[] {
    const lower = text.toLowerCase();
    return SCAM_KEYWORDS.filter(k => lower.includes(k));
}

function calculateRiskScore(keywords: string[], emotion: Emotion, base: number): number {
    let score = base + keywords.length * 10;
    if (emotion === 'urgency') score += 15;
    if (emotion === 'fear') score += 20;
    if (emotion === 'pressure') score += 12;
    if (emotion === 'aggression') score += 18;
    return Math.min(100, Math.max(0, score));
}

// Call Supabase edge function for online analysis
async function analyzeOnline(
    transcript: string,
    phoneNumber: string,
    callId: string,
): Promise<AnalysisResult | null> {
    try {
        if (!isSupabaseConfigured) return null;
        const { data, error } = await supabase.functions.invoke('analyze-call', {
            body: { transcript, phone_number: phoneNumber, call_id: callId },
        });
        if (!error && data) return data as AnalysisResult;
    } catch {
        // fall through
    }
    return null;
}

export interface UseCallRecorderReturn {
    callStatus: CallStatus;
    riskScore: number;
    emotion: Emotion;
    keywords: string[];
    transcripts: { text: string; timestamp: string; emotion: Emotion }[];
    isRecording: boolean;
    currentCallId: string | null;
    startCall: (phoneNumber: string) => Promise<void>;
    endCall: () => Promise<void>;
}

export function useCallRecorder(): UseCallRecorderReturn {
    const nativeAvailable = isNativeScamMonitorAvailable();
    const [callStatus, setCallStatus] = useState<CallStatus>('idle');
    const [riskScore, setRiskScore] = useState(0);
    const [emotion, setEmotion] = useState<Emotion>('neutral');
    const [keywords, setKeywords] = useState<string[]>([]);
    const [transcripts, setTranscripts] = useState<{ text: string; timestamp: string; emotion: Emotion }[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [currentCallId, setCurrentCallId] = useState<string | null>(null);

    const phoneRef = useRef('');
    const callIdRef = useRef<string | null>(null);
    const scoreRef = useRef(0);

    const handleTranscript = useCallback(async (result: {
        transcript?: string;
        emotion?: string;
        keywords?: string[];
        riskScore?: number;
        timestamp?: string;
    }) => {
        const transcript = result.transcript ?? '';
        if (!transcript) return;

        // Try online analysis first, fall back to local
        const online = await analyzeOnline(transcript, phoneRef.current, callIdRef.current ?? '');

        const emo = (online?.emotion ?? result.emotion as Emotion | undefined) ?? detectEmotion(transcript);
        const kws = (online?.keywords?.length ? online.keywords : result.keywords) ?? detectKeywords(transcript);
        const risk = online?.risk_score ?? result.riskScore ?? calculateRiskScore(kws, emo, scoreRef.current);

        scoreRef.current = risk;
        setRiskScore(risk);
        setEmotion(emo);
        setKeywords(prev => Array.from(new Set([...prev, ...kws])));
        setTranscripts(prev => [
            ...prev,
            { text: transcript, timestamp: result.timestamp ?? new Date().toISOString(), emotion: emo },
        ]);

        // Persist to Supabase
        try {
            if (!isSupabaseConfigured || !callIdRef.current || callIdRef.current.startsWith('local-')) return;
            await supabase.from('call_transcripts').insert({
                call_id: callIdRef.current,
                text: transcript,
                timestamp: new Date().toISOString(),
                emotion: emo,
            });
            await supabase.from('calls').update({
                risk_score: risk,
                status: risk >= 70 ? 'scam' : risk >= 40 ? 'suspicious' : 'safe',
            }).eq('id', callIdRef.current);
        } catch {
            // non-blocking
        }
    }, []);

    const startCall = useCallback(async (phoneNumber: string) => {
        if (callStatus === 'active' || callStatus === 'connecting') return;

        setCallStatus('connecting');
        phoneRef.current = phoneNumber;
        scoreRef.current = 0;
        setRiskScore(0);
        setEmotion('neutral');
        setKeywords([]);
        setTranscripts([]);

        // Create call record in Supabase
        let newCallId = `local-${Date.now()}`;
        try {
            if (isSupabaseConfigured) {
                const { data } = await supabase
                    .from('calls')
                    .insert({
                        phone_number: phoneNumber,
                        start_time: new Date().toISOString(),
                        risk_score: 0,
                        status: 'safe',
                    })
                    .select('id')
                    .single();
                if (data?.id) newCallId = data.id;
            }
        } catch {
            // use local id
        }

        callIdRef.current = newCallId;
        setCurrentCallId(newCallId);

        await new Promise(resolve => setTimeout(resolve, 1200));

        try {
            const permissionResult = await ScamMonitor.requestPermissions();
            if (!permissionResult.granted) {
                setCallStatus('ended');
                setIsRecording(false);
                return;
            }
            await ScamMonitor.requestOverlayPermission();
            await ScamMonitor.startMonitoring({
                phoneNumber,
                callId: newCallId,
                alertThreshold: 70,
            });
            setCallStatus('active');
            setIsRecording(true);
        } catch {
            setCallStatus('ended');
            setIsRecording(false);
        }
    }, [callStatus]);

    const endCall = useCallback(async () => {
        if (callStatus === 'idle' || callStatus === 'ended') return;

        setCallStatus('ended');
        setIsRecording(false);

        try { await ScamMonitor.stopMonitoring(); } catch { /* ignore */ }

        const finalScore = scoreRef.current;
        const finalStatus = finalScore >= 70 ? 'scam' : finalScore >= 40 ? 'suspicious' : 'safe';

        try {
            if (!isSupabaseConfigured || !callIdRef.current || callIdRef.current.startsWith('local-')) return;
            await supabase.from('calls').update({
                end_time: new Date().toISOString(),
                risk_score: finalScore,
                status: finalStatus,
            }).eq('id', callIdRef.current);
        } catch {
            // non-blocking
        }
    }, [callStatus]);

    useEffect(() => {
        if (!nativeAvailable) return;

        const removers = [
            addNativeScamMonitorListener('CALL_STARTED', () => {
                setCallStatus('active');
                setIsRecording(true);
            }),
            addNativeScamMonitorListener('CALL_ENDED', () => {
                setCallStatus('ended');
                setIsRecording(false);
            }),
            addNativeScamMonitorListener('TRANSCRIPT_UPDATE', (event) => {
                void handleTranscript({
                    transcript: event.transcript,
                    emotion: event.emotion,
                    keywords: event.keywords,
                    riskScore: event.riskScore,
                    timestamp: event.timestamp,
                });
            }),
            addNativeScamMonitorListener('SCAM_ALERT', (event) => {
                void handleTranscript({
                    transcript: event.transcript,
                    emotion: event.emotion,
                    keywords: event.keywords,
                    riskScore: event.riskScore,
                    timestamp: event.timestamp,
                });
            }),
        ];

        return () => removers.forEach(r => r());
    }, [handleTranscript, nativeAvailable]);

    return { callStatus, riskScore, emotion, keywords, transcripts, isRecording, currentCallId, startCall, endCall };
}
