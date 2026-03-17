import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SCAM_KEYWORDS = [
    "bank", "account", "blocked", "arrest", "police", "irs", "tax",
    "refund", "verify", "social security", "otp", "password", "urgent",
    "immediately", "credit card", "wire transfer", "gift card", "bitcoin",
    "suspended", "lawsuit", "warrant", "fraud", "penalty", "overdue",
    "aadhaar", "pan card", "kyc", "debit", "loan", "court",
];

const TELUGU_TO_ENGLISH_KEYWORDS: Record<string, string> = {
    "బ్యాంక్": "bank",
    "ఖాతా": "account",
    "అరెస్ట్": "arrest",
    "పోలీసులు": "police",
    "పాస్వర్డ్": "password",
    "ఓటీపీ": "otp",
    "అత్యవసరం": "urgent",
    "మోసం": "fraud",
    "కోర్టు": "court",
    "రుణం": "loan",
};

type Emotion = "neutral" | "urgency" | "fear" | "pressure" | "aggression";
type Status = "safe" | "suspicious" | "scam";
type DetectedLanguage = "english" | "telugu" | "unknown";

const EMOTION_MAP: Record<string, Emotion> = {
    immediately: "urgency", urgent: "urgency", now: "urgency", today: "urgency",
    deadline: "urgency", overdue: "urgency", quickly: "urgency",
    arrest: "fear", police: "fear", court: "fear", lawsuit: "fear",
    warrant: "fear", penalty: "fear", jail: "fear",
    must: "pressure", "have to": "pressure", required: "pressure",
    mandatory: "pressure", "no choice": "pressure",
    demand: "aggression", pay: "aggression", fine: "aggression",
    forfeit: "aggression", seized: "aggression",
};

function detectEmotion(text: string): Emotion {
    const lower = text.toLowerCase();
    for (const [trigger, emotion] of Object.entries(EMOTION_MAP)) {
        if (lower.includes(trigger)) return emotion;
    }
    return "neutral";
}

function detectKeywords(text: string): string[] {
    const lower = text.toLowerCase();
    return SCAM_KEYWORDS.filter(kw => lower.includes(kw));
}

function detectLanguage(text: string): DetectedLanguage {
    if (/[\u0C00-\u0C7F]/.test(text)) return "telugu";
    if (/[a-z]/i.test(text)) return "english";
    return "unknown";
}

function fallbackTranslateTelugu(text: string): string {
    return Object.entries(TELUGU_TO_ENGLISH_KEYWORDS).reduce(
        (translated, [source, target]) => translated.replaceAll(source, target),
        text,
    );
}

async function callHuggingFaceModel(
    model: string,
    token: string,
    body: Uint8Array | { inputs: string },
    contentType: string,
): Promise<unknown> {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": contentType,
        },
        body: body instanceof Uint8Array ? body : JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Hugging Face request failed (${response.status})`);
    }

    return await response.json();
}

async function transcribeAudio(bytes: Uint8Array, mimeType: string) {
    const token = Deno.env.get("HF_API_TOKEN");
    const multilingualModel = Deno.env.get("HF_ASR_MODEL") ?? "openai/whisper-large-v3";
    const teluguModel = Deno.env.get("HF_TELUGU_ASR_MODEL") ?? "viswamaicoe/swecha-gonthuka-asr";

    if (!token) {
        return { transcript: "", detectedLanguage: "unknown" as DetectedLanguage };
    }

    const initial = await callHuggingFaceModel(multilingualModel, token, bytes, mimeType) as { text?: string };
    const initialTranscript = initial.text?.trim() ?? "";
    const detectedLanguage = detectLanguage(initialTranscript);

    if (detectedLanguage !== "telugu" || teluguModel === multilingualModel) {
        return { transcript: initialTranscript, detectedLanguage };
    }

    try {
        const refined = await callHuggingFaceModel(teluguModel, token, bytes, mimeType) as { text?: string };
        const refinedTranscript = refined.text?.trim() ?? initialTranscript;
        return {
            transcript: refinedTranscript,
            detectedLanguage: detectLanguage(refinedTranscript),
        };
    } catch {
        return { transcript: initialTranscript, detectedLanguage };
    }
}

async function translateToEnglish(text: string, language: DetectedLanguage): Promise<string | null> {
    if (language !== "telugu" || !text.trim()) return null;

    const token = Deno.env.get("HF_API_TOKEN");
    const translationModel = Deno.env.get("HF_TRANSLATION_MODEL");

    if (!token || !translationModel) {
        return fallbackTranslateTelugu(text);
    }

    try {
        const response = await callHuggingFaceModel(
            translationModel,
            token,
            { inputs: text },
            "application/json",
        ) as Array<{ translation_text?: string }> | { translation_text?: string };

        if (Array.isArray(response)) {
            return response[0]?.translation_text?.trim() ?? fallbackTranslateTelugu(text);
        }

        return response.translation_text?.trim() ?? fallbackTranslateTelugu(text);
    } catch {
        return fallbackTranslateTelugu(text);
    }
}

serve(async (req) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const audioBlob = body.audio_blob as string | undefined;
        const audioMimeType = body.audio_mime_type as string | undefined;

        if (!audioBlob || !audioMimeType) {
            throw new Error("audio_blob and audio_mime_type are required");
        }

        const bytes = Uint8Array.from(atob(audioBlob), (char) => char.charCodeAt(0));
        const { transcript, detectedLanguage } = await transcribeAudio(bytes, audioMimeType);
        const translatedText = await translateToEnglish(transcript, detectedLanguage);
        const analysisText = (translatedText ?? transcript).trim();

        const keywords = detectKeywords(analysisText);
        const emotion = detectEmotion(analysisText);

        let risk = 0;
        risk += keywords.length * 10;
        if (emotion === "urgency") risk += 15;
        if (emotion === "fear") risk += 20;
        if (emotion === "pressure") risk += 12;
        if (emotion === "aggression") risk += 18;
        const risk_score = Math.min(100, Math.max(0, risk));

        const status: Status = risk_score >= 70 ? "scam" : risk_score >= 40 ? "suspicious" : "safe";

        return new Response(
            JSON.stringify({
                transcript,
                translated_text: translatedText,
                detected_language: detectedLanguage,
                emotion,
                keywords,
                risk_score,
                status,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
