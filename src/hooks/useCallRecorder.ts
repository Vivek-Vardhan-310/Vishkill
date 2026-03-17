import { useState, useRef, useCallback, useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { addNativeScamMonitorListener, isNativeScamMonitorAvailable, ScamMonitor } from '../lib/scamMonitor';
import type { CallStatus, DetectedLanguage, Emotion } from '../types';

const SCAM_KEYWORDS = [
    'bank', 'account', 'blocked', 'arrest', 'police', 'irs', 'tax',
    'refund', 'verify', 'social security', 'otp', 'password', 'urgent',
    'immediately', 'credit card', 'wire transfer', 'gift card', 'bitcoin',
    'suspended', 'lawsuit', 'warrant', 'fraud', 'penalty', 'overdue',
    'aadhaar', 'pan card', 'kyc', 'debit', 'loan', 'court',
];

const TELUGU_TO_ENGLISH_KEYWORDS: Record<string, string> = {
    బ్యాంక్: 'bank',
    ఖాతా: 'account',
    అరెస్ట్: 'arrest',
    పోలీసులు: 'police',
    పాస్వర్డ్: 'password',
    ఓటీపీ: 'otp',
    అత్యవసరం: 'urgent',
    మోసం: 'fraud',
    కోర్టు: 'court',
    రుణం: 'loan',
};

const EMOTION_TRIGGERS: Record<Emotion, string[]> = {
    urgency: ['immediately', 'urgent', 'now', 'today', 'deadline', 'overdue', 'quickly'],
    fear: ['arrest', 'police', 'court', 'lawsuit', 'warrant', 'penalty', 'jail'],
    pressure: ['must', 'have to', 'required', 'mandatory', 'no choice', 'otherwise'],
    aggression: ['demand', 'pay', 'fine', 'forfeit', 'seized', 'confiscate'],
    neutral: [],
};

function detectLanguage(text: string): DetectedLanguage {
    if (/[\u0C00-\u0C7F]/.test(text)) return 'telugu';
    if (/[a-z]/i.test(text)) return 'english';
    return 'unknown';
}

function translateTeluguKeywords(text: string): string {
    return Object.entries(TELUGU_TO_ENGLISH_KEYWORDS).reduce(
        (translated, [source, target]) => translated.replaceAll(source, target),
        text,
    );
}

function getAnalysisText(transcript: string, translatedText: string | null, language: DetectedLanguage): string {
    if (translatedText?.trim()) return translatedText;
    if (language === 'telugu') return translateTeluguKeywords(transcript);
    return transcript;
}

function detectEmotion(text: string): Emotion {
    const lower = text.toLowerCase();
    for (const [emotion, triggers] of Object.entries(EMOTION_TRIGGERS) as [Emotion, string[]][]) {
        if (emotion === 'neutral') continue;
        if (triggers.some(trigger => lower.includes(trigger))) return emotion;
    }
    return 'neutral';
}

function detectKeywords(text: string): string[] {
    const lower = text.toLowerCase();
    return SCAM_KEYWORDS.filter(keyword => lower.includes(keyword));
}

function calculateRiskScore(keywords: string[], emotion: Emotion, base: number): number {
    let score = base;
    score += keywords.length * 10;
    if (emotion === 'urgency') score += 15;
    if (emotion === 'fear') score += 20;
    if (emotion === 'pressure') score += 12;
    if (emotion === 'aggression') score += 18;
    return Math.min(100, Math.max(0, score));
}

export interface UseCallRecorderReturn {
    callStatus: CallStatus;
    riskScore: number;
    spamProbability: number | null;
    emotion: Emotion;
    detectedLanguage: DetectedLanguage;
    keywords: string[];
    transcripts: { text: string; translatedText: string | null; detectedLanguage: DetectedLanguage; timestamp: string; emotion: Emotion; spamProbability?: number | null }[];
    isRecording: boolean;
    currentCallId: string | null;
    startCall: (phoneNumber: string) => Promise<void>;
    endCall: () => Promise<void>;
}

export function useCallRecorder(): UseCallRecorderReturn {
    const nativeMonitoringAvailable = isNativeScamMonitorAvailable();
    const [callStatus, setCallStatus] = useState<CallStatus>('idle');
    const [riskScore, setRiskScore] = useState(0);
    const [spamProbability, setSpamProbability] = useState<number | null>(null);
    const [emotion, setEmotion] = useState<Emotion>('neutral');
    const [detectedLanguage, setDetectedLanguage] = useState<DetectedLanguage>('unknown');
    const [keywords, setKeywords] = useState<string[]>([]);
    const [transcripts, setTranscripts] = useState<{ text: string; translatedText: string | null; detectedLanguage: DetectedLanguage; timestamp: string; emotion: Emotion; spamProbability?: number | null }[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [currentCallId, setCurrentCallId] = useState<string | null>(null);

    const phoneRef = useRef('');
    const callIdRef = useRef<string | null>(null);
    const scoreRef = useRef(0);

    const handleNativeAnalysis = useCallback((result: {
        transcript?: string;
        translatedText?: string | null;
        detectedLanguage?: string;
        emotion?: string;
        keywords?: string[];
        riskScore?: number;
        spamProbability?: number;
        timestamp?: string;
    }) => {
        const transcript = result.transcript ?? '';
        const lang = (result.detectedLanguage as DetectedLanguage | undefined) ?? detectLanguage(transcript);
        const translatedText = result.translatedText ?? null;
        const analysisText = getAnalysisText(transcript, translatedText, lang);
        const emo = (result.emotion as Emotion | undefined) ?? detectEmotion(analysisText);
        const kws = result.keywords?.length ? result.keywords : detectKeywords(analysisText);
        const risk = result.riskScore ?? calculateRiskScore(kws, emo, scoreRef.current);

        scoreRef.current = risk;
        setRiskScore(risk);
        setSpamProbability(result.spamProbability ?? null);
        setEmotion(emo);
        setDetectedLanguage(lang);
        setKeywords(prev => Array.from(new Set([...prev, ...kws])));

        if (transcript) {
            setTranscripts(prev => [
                ...prev,
                {
                    text: transcript,
                    translatedText,
                    detectedLanguage: lang,
                    timestamp: result.timestamp ?? new Date().toISOString(),
                    emotion: emo,
                    spamProbability: result.spamProbability ?? null,
                },
            ]);
        }
    }, []);

    const startCall = useCallback(async (phoneNumber: string) => {
        if (callStatus === 'active' || callStatus === 'connecting') return;

        setCallStatus('connecting');
        phoneRef.current = phoneNumber;
        scoreRef.current = 0;
        setRiskScore(0);
        setSpamProbability(null);
        setEmotion('neutral');
        setDetectedLanguage('unknown');
        setKeywords([]);
        setTranscripts([]);

        const newCallId = `local-${Date.now()}`;
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

        try {
            await ScamMonitor.stopMonitoring();
        } catch {
            // ignore
        }

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
        if (!nativeMonitoringAvailable) return;

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
                handleNativeAnalysis({
                    transcript: event.transcript,
                    translatedText: event.translatedText ?? null,
                    detectedLanguage: event.detectedLanguage,
                    emotion: event.emotion,
                    keywords: event.keywords,
                    riskScore: event.riskScore,
                    spamProbability: event.spamProbability,
                    timestamp: event.timestamp,
                });
            }),
            addNativeScamMonitorListener('SCAM_ALERT', (event) => {
                handleNativeAnalysis({
                    transcript: event.transcript,
                    translatedText: event.translatedText ?? null,
                    detectedLanguage: event.detectedLanguage,
                    emotion: event.emotion,
                    keywords: event.keywords,
                    riskScore: event.riskScore,
                    spamProbability: event.spamProbability,
                    timestamp: event.timestamp,
                });
            }),
        ];

        return () => {
            removers.forEach(remove => remove());
        };
    }, [handleNativeAnalysis, nativeMonitoringAvailable]);

    return {
        callStatus,
        riskScore,
        spamProbability,
        emotion,
        detectedLanguage,
        keywords,
        transcripts,
        isRecording,
        currentCallId,
        startCall,
        endCall,
    };
}
