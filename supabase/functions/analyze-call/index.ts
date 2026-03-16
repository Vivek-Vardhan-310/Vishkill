import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Emotion = "neutral" | "urgency" | "fear" | "pressure" | "aggression";
type Status = "safe" | "suspicious" | "scam";
type VoiceAuthenticityLabel = "human" | "suspected_ai" | "unavailable";

interface VoiceAuthenticity {
  label: VoiceAuthenticityLabel;
  score: number | null;
  source: string | null;
  provider: string | null;
}

interface ProviderError {
  provider: string;
  stage: string;
  status?: number;
  details: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCAM_KEYWORDS = [
  "bank", "account", "blocked", "arrest", "police", "irs", "tax",
  "refund", "verify", "social security", "otp", "password", "urgent",
  "immediately", "credit card", "wire transfer", "gift card", "bitcoin",
  "suspended", "lawsuit", "warrant", "fraud", "penalty", "overdue",
  "aadhaar", "pan card", "kyc", "debit", "loan", "court",
];

const EMOTION_TRIGGERS: Record<Emotion, string[]> = {
  urgency: ["immediately", "urgent", "now", "today", "deadline", "overdue", "quickly"],
  fear: ["arrest", "police", "court", "lawsuit", "warrant", "penalty", "jail"],
  pressure: ["must", "have to", "required", "mandatory", "no choice", "otherwise"],
  aggression: ["demand", "pay", "fine", "forfeit", "seized", "confiscate"],
  neutral: [],
};

const SCAM_LABELS = [
  "phone scam",
  "banking fraud",
  "government impersonation",
  "identity theft",
  "urgent financial pressure",
  "safe conversation",
];

function detectKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return SCAM_KEYWORDS.filter((keyword) => lower.includes(keyword));
}

function detectEmotionFallback(text: string): Emotion {
  const lower = text.toLowerCase();
  for (const [emotion, triggers] of Object.entries(EMOTION_TRIGGERS) as [Emotion, string[]][]) {
    if (emotion === "neutral") continue;
    if (triggers.some((trigger) => lower.includes(trigger))) return emotion;
  }
  return "neutral";
}

function normalizeEmotion(label: string): Emotion {
  const lower = label.toLowerCase();
  if (lower.includes("fear") || lower.includes("nerv")) return "fear";
  if (lower.includes("anger") || lower.includes("aggress")) return "aggression";
  if (lower.includes("surprise") || lower.includes("urgency")) return "urgency";
  if (lower.includes("disgust") || lower.includes("pressure")) return "pressure";
  if (lower.includes("neutral") || lower.includes("calm")) return "neutral";
  if (lower.includes("sad")) return "pressure";
  if (lower.includes("joy")) return "neutral";
  return "neutral";
}

function scoreEmotionWeight(emotion: Emotion): number {
  if (emotion === "urgency") return 12;
  if (emotion === "fear") return 18;
  if (emotion === "pressure") return 10;
  if (emotion === "aggression") return 15;
  return 0;
}

function decodeBase64Audio(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function inferMimeType(audioBlob: string | undefined): string {
  if (!audioBlob) return "audio/webm";
  if (audioBlob.startsWith("UklGR")) return "audio/wav";
  if (audioBlob.startsWith("SUQz")) return "audio/mpeg";
  if (audioBlob.startsWith("T2dn")) return "audio/ogg";
  return "audio/webm";
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function parseZeroShotScores(payload: unknown): Record<string, number> {
  const result = payload as {
    labels?: string[];
    scores?: number[];
  };

  if (Array.isArray(result?.labels) && Array.isArray(result?.scores)) {
    return Object.fromEntries(result.labels.map((label, index) => [label, result.scores?.[index] ?? 0]));
  }

  return {};
}

function parseEmotionScores(payload: unknown): Partial<Record<Emotion, number>> {
  const raw = Array.isArray(payload) ? payload[0] ?? payload : payload;
  if (!Array.isArray(raw)) return {};

  const scores: Partial<Record<Emotion, number>> = {};
  for (const item of raw as Array<{ label?: string; score?: number }>) {
    if (!item?.label || typeof item.score !== "number") continue;
    const emotion = normalizeEmotion(item.label);
    scores[emotion] = Math.max(scores[emotion] ?? 0, item.score);
  }
  return scores;
}

function getTopEmotion(scores: Partial<Record<Emotion, number>>, transcript: string): Emotion {
  const top = Object.entries(scores).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  if (top?.[0]) return top[0] as Emotion;
  return detectEmotionFallback(transcript);
}

async function queryHuggingFace(model: string, token: string, payload: unknown): Promise<unknown> {
  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(JSON.stringify({
      provider: "huggingface",
      stage: model,
      status: response.status,
      details: errorText,
    }));
  }

  return await response.json();
}

async function classifyScam(text: string, token: string | undefined, errors: ProviderError[]): Promise<{ score: number; signals: string[]; provider: string }> {
  if (!token || !text.trim()) {
    const keywords = detectKeywords(text);
    return {
      score: Math.min(1, keywords.length * 0.18),
      signals: keywords,
      provider: "keyword-fallback",
    };
  }

  try {
    const payload = await queryHuggingFace("facebook/bart-large-mnli", token, {
      inputs: text,
      parameters: {
        candidate_labels: SCAM_LABELS,
        multi_label: true,
      },
    });

    const scores = parseZeroShotScores(payload);
    const safeScore = scores["safe conversation"] ?? 0;
    const suspiciousLabels = Object.entries(scores)
      .filter(([label, score]) => label !== "safe conversation" && score >= 0.35)
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => label);

    const scamScore = Math.max(
      0,
      ...Object.entries(scores)
        .filter(([label]) => label !== "safe conversation")
        .map(([, score]) => score - safeScore * 0.4),
    );

    return {
      score: Math.min(1, scamScore),
      signals: suspiciousLabels,
      provider: "huggingface/facebook-bart-large-mnli",
    };
  } catch (error) {
    errors.push(parseProviderError(error, "huggingface", "scam_detection"));
    const keywords = detectKeywords(text);
    return {
      score: Math.min(1, keywords.length * 0.18),
      signals: keywords,
      provider: "keyword-fallback",
    };
  }
}

async function detectEmotion(text: string, token: string | undefined, errors: ProviderError[]): Promise<{
  emotion: Emotion;
  scores: Partial<Record<Emotion, number>>;
  provider: string;
}> {
  if (!token || !text.trim()) {
    const fallback = detectEmotionFallback(text);
    return {
      emotion: fallback,
      scores: { [fallback]: 1 },
      provider: "trigger-fallback",
    };
  }

  try {
    const payload = await queryHuggingFace("j-hartmann/emotion-english-distilroberta-base", token, {
      inputs: text,
    });
    const scores = parseEmotionScores(payload);
    const emotion = getTopEmotion(scores, text);
    return {
      emotion,
      scores,
      provider: "huggingface/j-hartmann-emotion",
    };
  } catch (error) {
    errors.push(parseProviderError(error, "huggingface", "emotion_detection"));
    const fallback = detectEmotionFallback(text);
    return {
      emotion: fallback,
      scores: { [fallback]: 1 },
      provider: "trigger-fallback",
    };
  }
}

async function uploadAudioForVoiceCheck(
  audioBytes: Uint8Array,
  mimeType: string,
  callId: string | undefined,
  errors: ProviderError[],
): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    errors.push({
      provider: "supabase-storage",
      stage: "voice_upload",
      details: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing",
    });
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const path = `${callId ?? crypto.randomUUID()}/${crypto.randomUUID()}.${extensionFromMimeType(mimeType)}`;

  const { error } = await supabase.storage
    .from("call-audio")
    .upload(path, audioBytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    errors.push({
      provider: "supabase-storage",
      stage: "voice_upload",
      details: error.message,
    });
    return null;
  }

  const { data } = supabase.storage.from("call-audio").getPublicUrl(path);
  return data.publicUrl;
}

async function pollResembleResult(jobId: string, apiKey: string): Promise<unknown> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(`https://app.resemble.ai/api/v2/detect/${jobId}`, {
      headers: {
        "Authorization": `Token ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(JSON.stringify({
        provider: "resemble",
        stage: "poll_result",
        status: response.status,
        details: errorText,
      }));
    }

    const payload = await response.json();
    const status = (payload as { status?: string }).status?.toLowerCase();
    if (status === "completed" || status === "finished" || status === "done") {
      return payload;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return null;
}

function parseResembleVoiceResult(payload: unknown): VoiceAuthenticity {
  const data = payload as {
    result?: {
      score?: number;
      confidence?: number;
      label?: string;
      predicted_label?: string;
      source?: string;
    };
    score?: number;
    confidence?: number;
    label?: string;
    predicted_label?: string;
    source?: string;
  };

  const score = typeof data?.result?.score === "number"
    ? data.result.score
    : typeof data?.score === "number"
      ? data.score
      : typeof data?.result?.confidence === "number"
        ? data.result.confidence
        : typeof data?.confidence === "number"
          ? data.confidence
          : null;

  const normalizedScore = score === null ? null : Math.round((score <= 1 ? score * 100 : score) * 100) / 100;
  const label = (data?.result?.predicted_label ?? data?.result?.label ?? data?.predicted_label ?? data?.label ?? "").toLowerCase();
  const source = data?.result?.source ?? data?.source ?? null;

  if (!label && normalizedScore === null) {
    return { label: "unavailable", score: null, source: null, provider: "resemble" };
  }

  const suspicious = label.includes("fake") || label.includes("synthetic") || label.includes("ai");
  return {
    label: suspicious ? "suspected_ai" : "human",
    score: normalizedScore,
    source,
    provider: "resemble",
  };
}

async function detectVoiceAuthenticity(audioUrl: string | null, apiKey: string | undefined, errors: ProviderError[]): Promise<VoiceAuthenticity> {
  if (!audioUrl || !apiKey) {
    return { label: "unavailable", score: null, source: null, provider: null };
  }

  try {
    const createResponse = await fetch("https://app.resemble.ai/api/v2/detect", {
      method: "POST",
      headers: {
        "Authorization": `Token ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        url: audioUrl,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(JSON.stringify({
        provider: "resemble",
        stage: "create_job",
        status: createResponse.status,
        details: errorText,
      }));
    }

    const initialPayload = await createResponse.json();
    const immediateResult = parseResembleVoiceResult(initialPayload);
    if (immediateResult.label !== "unavailable") return immediateResult;

    const jobId = (initialPayload as { id?: string; uuid?: string }).id ?? (initialPayload as { id?: string; uuid?: string }).uuid;
    if (!jobId) return immediateResult;

    const finalPayload = await pollResembleResult(jobId, apiKey);
    return finalPayload ? parseResembleVoiceResult(finalPayload) : immediateResult;
  } catch (error) {
    errors.push(parseProviderError(error, "resemble", "voice_detection"));
    return { label: "unavailable", score: null, source: null, provider: "resemble" };
  }
}

function calculateRiskScore(params: {
  currentRisk: number;
  keywordCount: number;
  scamScore: number;
  emotion: Emotion;
  voiceAuthenticity: VoiceAuthenticity;
}): number {
  const keywordWeight = params.keywordCount * 8;
  const scamWeight = params.scamScore * 52;
  const emotionWeight = scoreEmotionWeight(params.emotion);
  const voiceWeight = params.voiceAuthenticity.label === "suspected_ai"
    ? Math.max(18, (params.voiceAuthenticity.score ?? 65) * 0.25)
    : 0;

  const computed = keywordWeight + scamWeight + emotionWeight + voiceWeight;
  const blended = Math.max(params.currentRisk * 0.55, computed);
  return Math.min(100, Math.round(blended));
}

function parseProviderError(error: unknown, provider: string, stage: string): ProviderError {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as ProviderError;
      return {
        provider: parsed.provider ?? provider,
        stage: parsed.stage ?? stage,
        status: parsed.status,
        details: parsed.details ?? error.message,
      };
    } catch {
      return { provider, stage, details: error.message };
    }
  }

  return { provider, stage, details: String(error) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const errors: ProviderError[] = [];

  try {
    const huggingFaceApiKey = Deno.env.get("HUGGINGFACE_API_KEY");
    const resembleApiKey = Deno.env.get("RESEMBLE_API_KEY");

    const body = await req.json();
    const audioBlob = typeof body.audio_blob === "string" ? body.audio_blob : "";
    const mimeType = inferMimeType(audioBlob);
    const audioBytes = audioBlob ? decodeBase64Audio(audioBlob) : null;

    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    const transcriptionProvider = transcript ? "web-speech-api" : "unavailable";

    const [scam, emotionResult, audioUrl] = await Promise.all([
      classifyScam(transcript, huggingFaceApiKey, errors),
      detectEmotion(transcript, huggingFaceApiKey, errors),
      audioBytes ? uploadAudioForVoiceCheck(audioBytes, mimeType, body.call_id, errors) : Promise.resolve(null),
    ]);

    const voiceAuthenticity = await detectVoiceAuthenticity(audioUrl, resembleApiKey, errors);
    const keywords = detectKeywords(transcript);
    const riskScore = calculateRiskScore({
      currentRisk: Number(body.current_risk_score ?? 0),
      keywordCount: keywords.length,
      scamScore: scam.score,
      emotion: emotionResult.emotion,
      voiceAuthenticity,
    });

    const status: Status = riskScore >= 70 ? "scam" : riskScore >= 40 ? "suspicious" : "safe";
    const scamSignals = Array.from(new Set([...keywords, ...scam.signals]));

    return new Response(
      JSON.stringify({
        transcript,
        emotion: emotionResult.emotion,
        emotion_scores: emotionResult.scores,
        keywords,
        scam_score: Math.round(scam.score * 100) / 100,
        scam_signals: scamSignals,
        voice_authenticity: voiceAuthenticity,
        risk_score: riskScore,
        status,
        providers: {
          transcription: transcriptionProvider,
          scam_detection: scam.provider,
          emotion_detection: emotionResult.provider,
          voice_detection: voiceAuthenticity.provider ?? "unavailable",
        },
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const topLevelError = parseProviderError(error, "edge-function", "request");
    errors.push(topLevelError);

    return new Response(
      JSON.stringify({
        error: topLevelError.details,
        errors,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
