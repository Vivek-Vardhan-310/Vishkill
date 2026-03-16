import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SCAM_KEYWORDS = [
    "bank", "account", "blocked", "arrest", "police", "irs", "tax",
    "refund", "verify", "social security", "otp", "password", "urgent",
    "immediately", "credit card", "wire transfer", "gift card", "bitcoin",
    "suspended", "lawsuit", "warrant", "fraud", "penalty", "overdue",
    "aadhaar", "pan card", "kyc", "debit", "loan", "court",
];

type Emotion = "neutral" | "urgency" | "fear" | "pressure" | "aggression";
type Status = "safe" | "suspicious" | "scam";

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
        const transcript: string = body.transcript || body.audio_blob || "";

        const keywords = detectKeywords(transcript);
        const emotion = detectEmotion(transcript);

        // Calculate risk
        let risk = 0;
        risk += keywords.length * 10;
        if (emotion === "urgency") risk += 15;
        if (emotion === "fear") risk += 20;
        if (emotion === "pressure") risk += 12;
        if (emotion === "aggression") risk += 18;
        const risk_score = Math.min(100, Math.max(0, risk));

        const status: Status = risk_score >= 70 ? "scam" : risk_score >= 40 ? "suspicious" : "safe";

        return new Response(
            JSON.stringify({ transcript, emotion, keywords, risk_score, status }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
