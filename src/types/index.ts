// Core types for VishKill

export type CallStatus = 'idle' | 'connecting' | 'active' | 'ended';
export type RiskLevel = 'safe' | 'suspicious' | 'scam';
export type Emotion = 'neutral' | 'urgency' | 'fear' | 'pressure' | 'aggression';
export type DetectedLanguage = 'english' | 'telugu' | 'unknown';

export interface AnalysisResult {
    transcript: string;
    translated_text: string | null;
    detected_language: DetectedLanguage;
    emotion: Emotion;
    keywords: string[];
    risk_score: number;
    status: RiskLevel;
    spam_probability?: number;
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
    translated_text: string | null;
    detected_language: DetectedLanguage;
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
