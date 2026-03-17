package com.vishkill.app.monitor;

import org.json.JSONArray;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public final class OfflineScamAnalyzer {
    private static final String[] SCAM_KEYWORDS = new String[] {
            "bank", "account", "blocked", "arrest", "police", "irs", "tax",
            "refund", "verify", "social security", "otp", "password", "urgent",
            "immediately", "credit card", "wire transfer", "gift card", "bitcoin",
            "suspended", "lawsuit", "warrant", "fraud", "penalty", "overdue",
            "aadhaar", "pan card", "kyc", "debit", "loan", "court"
    };

    private static final Map<String, String> TELUGU_TO_ENGLISH_KEYWORDS = new LinkedHashMap<>();

    static {
        TELUGU_TO_ENGLISH_KEYWORDS.put("బ్యాంక్", "bank");
        TELUGU_TO_ENGLISH_KEYWORDS.put("ఖాతా", "account");
        TELUGU_TO_ENGLISH_KEYWORDS.put("అరెస్ట్", "arrest");
        TELUGU_TO_ENGLISH_KEYWORDS.put("పోలీసులు", "police");
        TELUGU_TO_ENGLISH_KEYWORDS.put("పాస్వర్డ్", "password");
        TELUGU_TO_ENGLISH_KEYWORDS.put("ఓటీపీ", "otp");
        TELUGU_TO_ENGLISH_KEYWORDS.put("అత్యవసరం", "urgent");
        TELUGU_TO_ENGLISH_KEYWORDS.put("మోసం", "fraud");
        TELUGU_TO_ENGLISH_KEYWORDS.put("కోర్టు", "court");
        TELUGU_TO_ENGLISH_KEYWORDS.put("రుణం", "loan");
    }

    private OfflineScamAnalyzer() {
    }

    public static OfflineAnalysisResult analyze(String transcript, int baseRiskScore) {
        String safeTranscript = transcript == null ? "" : transcript.trim();
        String detectedLanguage = detectLanguage(safeTranscript);
        String translatedText = translateTeluguKeywords(safeTranscript, detectedLanguage);
        String analysisText = translatedText == null || translatedText.isBlank() ? safeTranscript : translatedText;
        String emotion = detectEmotion(analysisText);
        JSONArray keywords = detectKeywords(analysisText);
        int riskScore = calculateRiskScore(keywords.length(), emotion, baseRiskScore);

        return new OfflineAnalysisResult(
                safeTranscript,
                translatedText,
                detectedLanguage,
                emotion,
                keywords,
                riskScore);
    }

    private static String detectLanguage(String transcript) {
        if (transcript == null || transcript.isBlank()) {
            return "unknown";
        }

        for (int index = 0; index < transcript.length(); index += 1) {
            char character = transcript.charAt(index);
            if (character >= '\u0C00' && character <= '\u0C7F') {
                return "telugu";
            }
        }

        for (int index = 0; index < transcript.length(); index += 1) {
            if (Character.isLetter(transcript.charAt(index))) {
                return "english";
            }
        }

        return "unknown";
    }

    private static String translateTeluguKeywords(String transcript, String detectedLanguage) {
        if (!"telugu".equals(detectedLanguage)) {
            return null;
        }

        String translated = transcript;
        for (Map.Entry<String, String> entry : TELUGU_TO_ENGLISH_KEYWORDS.entrySet()) {
            translated = translated.replace(entry.getKey(), entry.getValue());
        }
        return translated;
    }

    private static String detectEmotion(String transcript) {
        String lower = transcript == null ? "" : transcript.toLowerCase(Locale.US);
        if (containsAny(lower, "arrest", "police", "court", "lawsuit", "warrant", "penalty", "jail")) {
            return "fear";
        }
        if (containsAny(lower, "immediately", "urgent", "now", "today", "deadline", "overdue", "quickly")) {
            return "urgency";
        }
        if (containsAny(lower, "must", "have to", "required", "mandatory", "no choice", "otherwise")) {
            return "pressure";
        }
        if (containsAny(lower, "demand", "pay", "fine", "forfeit", "seized", "confiscate")) {
            return "aggression";
        }
        return "neutral";
    }

    private static JSONArray detectKeywords(String transcript) {
        JSONArray keywords = new JSONArray();
        String lower = transcript == null ? "" : transcript.toLowerCase(Locale.US);
        for (String keyword : SCAM_KEYWORDS) {
            if (lower.contains(keyword)) {
                keywords.put(keyword);
            }
        }
        return keywords;
    }

    private static int calculateRiskScore(int keywordCount, String emotion, int baseRiskScore) {
        int score = baseRiskScore + (keywordCount * 10);
        if ("urgency".equals(emotion)) {
            score += 15;
        } else if ("fear".equals(emotion)) {
            score += 20;
        } else if ("pressure".equals(emotion)) {
            score += 12;
        } else if ("aggression".equals(emotion)) {
            score += 18;
        }

        return Math.max(0, Math.min(100, score));
    }

    private static boolean containsAny(String text, String... phrases) {
        for (String phrase : phrases) {
            if (text.contains(phrase)) {
                return true;
            }
        }
        return false;
    }
}
