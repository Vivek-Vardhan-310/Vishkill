package com.vishkill.app.monitor;

import org.json.JSONArray;

public final class OfflineAnalysisResult {
    public final String transcript;
    public final String translatedText;
    public final String detectedLanguage;
    public final String emotion;
    public final JSONArray keywords;
    public final int riskScore;

    public OfflineAnalysisResult(
            String transcript,
            String translatedText,
            String detectedLanguage,
            String emotion,
            JSONArray keywords,
            int riskScore) {
        this.transcript = transcript;
        this.translatedText = translatedText;
        this.detectedLanguage = detectedLanguage;
        this.emotion = emotion;
        this.keywords = keywords;
        this.riskScore = riskScore;
    }
}
