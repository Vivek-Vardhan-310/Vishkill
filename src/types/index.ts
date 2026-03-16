// Core types for VishKill

export type CallStatus = 'idle' | 'connecting' | 'active' | 'ended';
export type RiskLevel = 'safe' | 'suspicious' | 'scam';
export type Emotion = 'neutral' | 'urgency' | 'fear' | 'pressure' | 'aggression';
export type VoiceAuthenticityLabel = 'human' | 'suspected_ai' | 'unavailable';

export interface VoiceAuthenticity {
    label: VoiceAuthenticityLabel;
    score: number | null;
    source: string | null;
    provider: string | null;
}

export interface AnalysisResult {
    transcript: string;
    emotion: Emotion;
    keywords: string[];
    risk_score: number;
    status: RiskLevel;
    scam_score?: number;
    scam_signals?: string[];
    emotion_scores?: Partial<Record<Emotion, number>>;
    voice_authenticity?: VoiceAuthenticity;
    providers?: {
        transcription: string;
        scam_detection: string;
        emotion_detection: string;
        voice_detection: string;
    };
}

export interface CallRecord {
    id: string;
    phone_number: string;
    user_id: string | null;
    start_time: string;
    end_time: string | null;
    risk_score: number;
    status: RiskLevel;
}

export interface CallTranscript {
    id: string;
    call_id: string;
    text: string;
    timestamp: string;
    emotion: Emotion;
}

export interface ScamReport {
    id: string;
    phone_number: string;
    report_count: number;
    last_reported: string;
}

export interface TrustedContact {
    id: string;
    user_id: string;
    phone_number: string;
    name: string;
}
