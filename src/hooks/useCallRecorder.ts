import { useState, useRef, useCallback, useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { AnalysisResult, CallStatus, Emotion, VoiceAuthenticity } from '../types';

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

async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
        const chunk = bytes.subarray(index, index + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

async function mockAnalyzeCall(
    transcript: string,
    phoneNumber: string,
    callId: string,
    currentScore: number,
    audioBlob?: Blob | null,
): Promise<AnalysisResult> {
    try {
        if (isSupabaseConfigured) {
            const audioBase64 = audioBlob ? await blobToBase64(audioBlob) : undefined;
            const { data, error } = await supabase.functions.invoke('analyze-call', {
                body: {
                    transcript,
                    audio_blob: audioBase64,
                    phone_number: phoneNumber,
                    call_id: callId,
                    current_risk_score: currentScore,
                },
            });
            if (!error && data) return data as AnalysisResult;
        }
    } catch {
        // fall through to local mock
    }

    await new Promise(resolve => setTimeout(resolve, 400));
    const keywords = detectKeywords(transcript);
    const emotion = detectEmotion(transcript);
    const riskScore = calculateRiskScore(keywords, emotion, currentScore);
    const status = riskScore >= 70 ? 'scam' : riskScore >= 40 ? 'suspicious' : 'safe';

    return {
        transcript,
        emotion,
        keywords,
        risk_score: riskScore,
        status,
        scam_score: Math.min(1, keywords.length * 0.18 + (emotion === 'fear' ? 0.25 : 0)),
        scam_signals: keywords,
        voice_authenticity: {
            label: 'unavailable',
            score: null,
            source: null,
            provider: 'local-fallback',
        },
        providers: {
            transcription: 'web-speech-api',
            scam_detection: 'local-keyword-rules',
            emotion_detection: 'local-trigger-rules',
            voice_detection: 'unavailable',
        },
    };
}

export interface UseCallRecorderReturn {
    callStatus: CallStatus;
    riskScore: number;
    emotion: Emotion;
    keywords: string[];
    transcripts: { text: string; timestamp: string; emotion: Emotion }[];
    isRecording: boolean;
    currentCallId: string | null;
    voiceAuthenticity: VoiceAuthenticity;
    scamSignals: string[];
    startCall: (phoneNumber: string) => Promise<void>;
    endCall: () => Promise<void>;
}

export function useCallRecorder(): UseCallRecorderReturn {
    const [callStatus, setCallStatus] = useState<CallStatus>('idle');
    const [riskScore, setRiskScore] = useState(0);
    const [emotion, setEmotion] = useState<Emotion>('neutral');
    const [keywords, setKeywords] = useState<string[]>([]);
    const [transcripts, setTranscripts] = useState<{ text: string; timestamp: string; emotion: Emotion }[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [currentCallId, setCurrentCallId] = useState<string | null>(null);
    const [voiceAuthenticity, setVoiceAuthenticity] = useState<VoiceAuthenticity>({
        label: 'unavailable',
        score: null,
        source: null,
        provider: null,
    });
    const [scamSignals, setScamSignals] = useState<string[]>([]);

    const phoneRef = useRef('');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const callIdRef = useRef<string | null>(null);
    const scoreRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const bufferRef = useRef('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const isEndingRef = useRef(false);

    const processBuffer = useCallback(async (audioBlob?: Blob | null) => {
        const text = bufferRef.current.trim();
        if ((!text && !audioBlob) || !callIdRef.current) return;
        bufferRef.current = '';

        const result = await mockAnalyzeCall(text, phoneRef.current, callIdRef.current, scoreRef.current, audioBlob);
        scoreRef.current = result.risk_score;

        setRiskScore(result.risk_score);
        setEmotion(result.emotion);
        setKeywords(previous => Array.from(new Set([...previous, ...result.keywords])));
        setScamSignals(previous => Array.from(new Set([...(result.scam_signals ?? []), ...previous])));
        setVoiceAuthenticity(result.voice_authenticity ?? {
            label: 'unavailable',
            score: null,
            source: null,
            provider: null,
        });

        if (text) {
            setTranscripts(previous => [
                ...previous,
                { text, timestamp: new Date().toISOString(), emotion: result.emotion },
            ]);
        }

        try {
            if (!isSupabaseConfigured || !text || !callIdRef.current || callIdRef.current.startsWith('local-')) return;
            await supabase.from('call_transcripts').insert({
                call_id: callIdRef.current,
                text,
                timestamp: new Date().toISOString(),
                emotion: result.emotion,
            });
        } catch {
            // non-blocking
        }

        try {
            if (!isSupabaseConfigured || !callIdRef.current || callIdRef.current.startsWith('local-')) return;
            await supabase.from('calls').update({
                risk_score: result.risk_score,
                status: result.status,
            }).eq('id', callIdRef.current);
        } catch {
            // non-blocking
        }
    }, []);

    const flushMediaChunk = useCallback(async () => {
        const blobParts = mediaChunksRef.current;
        if (blobParts.length === 0) {
            await processBuffer(null);
            return;
        }

        const audioBlob = new Blob(blobParts, {
            type: mediaRecorderRef.current?.mimeType || 'audio/webm',
        });
        mediaChunksRef.current = [];
        await processBuffer(audioBlob);
    }, [processBuffer]);

    const stopMedia = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (mediaRecorderRef.current) {
            if (mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.requestData();
                mediaRecorderRef.current.stop();
            }
            mediaRecorderRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const startCall = useCallback(async (phoneNumber: string) => {
        if (callStatus === 'active' || callStatus === 'connecting') return;

        isEndingRef.current = false;
        setCallStatus('connecting');
        phoneRef.current = phoneNumber;
        scoreRef.current = 0;
        setRiskScore(0);
        setEmotion('neutral');
        setKeywords([]);
        setTranscripts([]);
        setScamSignals([]);
        setVoiceAuthenticity({
            label: 'unavailable',
            score: null,
            source: null,
            provider: null,
        });
        bufferRef.current = '';
        mediaChunksRef.current = [];

        let newCallId = `local-${Date.now()}`;
        try {
            if (!isSupabaseConfigured) throw new Error('Supabase not configured');
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
        } catch {
            // use local id
        }

        callIdRef.current = newCallId;
        setCurrentCallId(newCallId);

        await new Promise(resolve => setTimeout(resolve, 1200));

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            if (typeof MediaRecorder !== 'undefined') {
                const recorder = new MediaRecorder(stream);
                recorder.ondataavailable = (event: BlobEvent) => {
                    if (event.data.size > 0) {
                        mediaChunksRef.current.push(event.data);
                    }
                };
                mediaRecorderRef.current = recorder;
                recorder.start();
            }
        } catch {
            stopMedia();
            setIsRecording(false);
            setCallStatus('ended');
            return;
        }

        const SpeechRecognition = getSpeechRecognition();
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            recognition.onresult = (event: SpeechRecognitionEvent) => {
                const latest = event.results[event.results.length - 1];
                if (latest?.isFinal) {
                    bufferRef.current += ` ${latest[0].transcript}`;
                }
            };
            recognition.onerror = () => {
                // ignore recognition errors in demo mode
            };
            recognition.onend = () => {
                if (!isEndingRef.current) {
                    try {
                        recognition.start();
                    } catch {
                        // ignore restart errors
                    }
                }
            };
            try {
                recognition.start();
                recognitionRef.current = recognition;
            } catch {
                // continue without speech recognition
            }
        }

        setCallStatus('active');
        setIsRecording(true);

        intervalRef.current = setInterval(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.requestData();
            }
            void flushMediaChunk();
        }, 7000);
    }, [callStatus, flushMediaChunk, stopMedia]);

    const endCall = useCallback(async () => {
        if (callStatus === 'idle' || callStatus === 'ended') return;

        isEndingRef.current = true;
        setCallStatus('ended');
        setIsRecording(false);
        stopMedia();

        await flushMediaChunk();

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
    }, [callStatus, flushMediaChunk, stopMedia]);

    useEffect(() => {
        return () => {
            isEndingRef.current = true;
            stopMedia();
        };
    }, [stopMedia]);

    return {
        callStatus,
        riskScore,
        emotion,
        keywords,
        transcripts,
        isRecording,
        currentCallId,
        voiceAuthenticity,
        scamSignals,
        startCall,
        endCall,
    };
}
