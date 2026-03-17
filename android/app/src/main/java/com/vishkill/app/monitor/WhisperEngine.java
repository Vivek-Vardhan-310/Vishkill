package com.vishkill.app.monitor;

import android.content.Context;

import java.util.Locale;

final class WhisperEngine {
    // Try tiny.en first (fast), fallback to base.en if that fails
    private static final String MODEL_ASSET_PATH_PRIMARY = "whisper-models/ggml-tiny.en.bin";
    private static final String MODEL_ASSET_PATH_FALLBACK = "whisper-models/ggml-base.en.bin";

    private long contextPtr;

    WhisperEngine(Context context) {
        // Try tiny.en first
        contextPtr = WhisperLib.initContextFromAsset(context.getAssets(), MODEL_ASSET_PATH_PRIMARY);
        if (contextPtr == 0L) {
            android.util.Log.w("WhisperEngine", "Failed to load tiny.en model, falling back to base.en");
            // Fallback to base.en
            contextPtr = WhisperLib.initContextFromAsset(context.getAssets(), MODEL_ASSET_PATH_FALLBACK);
            if (contextPtr == 0L) {
                throw new IllegalStateException(
                        "Couldn't create Whisper context from either tiny.en or base.en models");
            }
        }
    }

    synchronized String transcribePcm16(byte[] pcmBytes) {
        if (contextPtr == 0L || pcmBytes == null || pcmBytes.length < 2) {
            return "";
        }

        float[] samples = pcm16ToFloatArray(pcmBytes);
        WhisperLib.fullTranscribe(contextPtr, WhisperCpuConfig.preferredThreadCount(), samples);

        int textCount = WhisperLib.getTextSegmentCount(contextPtr);
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < textCount; index += 1) {
            String segment = WhisperLib.getTextSegment(contextPtr, index);
            if (segment == null || segment.isBlank()) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append(' ');
            }
            builder.append(segment.trim());
        }

        return normalizeTranscript(builder.toString());
    }

    synchronized void close() {
        if (contextPtr != 0L) {
            WhisperLib.freeContext(contextPtr);
            contextPtr = 0L;
        }
    }

    private float[] pcm16ToFloatArray(byte[] pcmBytes) {
        int sampleCount = pcmBytes.length / 2;
        float[] samples = new float[sampleCount];
        for (int index = 0; index < sampleCount; index += 1) {
            int low = pcmBytes[index * 2] & 0xff;
            int high = pcmBytes[index * 2 + 1];
            short sample = (short) ((high << 8) | low);
            samples[index] = sample / 32768.0f;
        }
        return samples;
    }

    private String normalizeTranscript(String transcript) {
        if (transcript == null) {
            return "";
        }

        String normalized = transcript.trim();
        if (normalized.isEmpty()) {
            return normalized;
        }

        normalized = normalized.replaceAll("(?i)\\bo\\s*t\\s*p\\b", "OTP");
        normalized = normalized.replaceAll("(?i)\\bk\\s*y\\s*c\\b", "KYC");
        normalized = normalized.replaceAll("(?i)\\ba\\s*t\\s*m\\b", "ATM");
        normalized = normalized.replaceAll("(?i)\\bi\\s*f\\s*s\\s*c\\b", "IFSC");
        normalized = normalized.replaceAll("(?i)\\bu\\s*p\\s*i\\b", "UPI");
        normalized = normalized.replaceAll("(?i)one time password", "OTP");
        return normalized.trim().replaceAll("\\s+", " ");
    }
}
