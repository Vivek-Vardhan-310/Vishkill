package com.vishkill.app.monitor;

import android.content.Context;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class BertWordPieceTokenizer {
    private static final int MAX_INPUT_TOKENS = 64;

    private final Map<String, Integer> vocabulary;
    private final int padId;
    private final int clsId;
    private final int sepId;
    private final int unkId;

    public BertWordPieceTokenizer(Context context, String assetPath) throws IOException {
        vocabulary = loadVocabulary(context, assetPath);
        padId = getRequiredId("[PAD]");
        clsId = getRequiredId("[CLS]");
        sepId = getRequiredId("[SEP]");
        unkId = getRequiredId("[UNK]");
    }

    public TokenizedInput tokenize(String text) {
        List<String> basicTokens = basicTokenize(text);
        List<Integer> tokenIds = new ArrayList<>();
        tokenIds.add(clsId);

        for (String token : basicTokens) {
            for (String piece : wordPieceTokenize(token)) {
                tokenIds.add(vocabulary.getOrDefault(piece, unkId));
                if (tokenIds.size() >= MAX_INPUT_TOKENS - 1) {
                    break;
                }
            }
            if (tokenIds.size() >= MAX_INPUT_TOKENS - 1) {
                break;
            }
        }

        tokenIds.add(sepId);

        long[] inputIds = new long[MAX_INPUT_TOKENS];
        long[] attentionMask = new long[MAX_INPUT_TOKENS];
        long[] tokenTypeIds = new long[MAX_INPUT_TOKENS];

        for (int index = 0; index < MAX_INPUT_TOKENS; index += 1) {
            if (index < tokenIds.size()) {
                inputIds[index] = tokenIds.get(index);
                attentionMask[index] = 1L;
            } else {
                inputIds[index] = padId;
                attentionMask[index] = 0L;
            }
            tokenTypeIds[index] = 0L;
        }

        return new TokenizedInput(inputIds, attentionMask, tokenTypeIds);
    }

    private List<String> basicTokenize(String text) {
        String normalized = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.US);

        List<String> tokens = new ArrayList<>();
        StringBuilder current = new StringBuilder();

        for (int index = 0; index < normalized.length(); index += 1) {
            char character = normalized.charAt(index);
            if (Character.isLetterOrDigit(character)) {
                current.append(character);
                continue;
            }

            if (current.length() > 0) {
                tokens.add(current.toString());
                current.setLength(0);
            }

            if (!Character.isWhitespace(character)) {
                tokens.add(String.valueOf(character));
            }
        }

        if (current.length() > 0) {
            tokens.add(current.toString());
        }

        return tokens;
    }

    private List<String> wordPieceTokenize(String token) {
        List<String> pieces = new ArrayList<>();
        if (token == null || token.isBlank()) {
            return pieces;
        }

        if (vocabulary.containsKey(token)) {
            pieces.add(token);
            return pieces;
        }

        int start = 0;
        boolean badToken = false;
        while (start < token.length()) {
            int end = token.length();
            String currentSubToken = null;
            while (start < end) {
                String candidate = token.substring(start, end);
                if (start > 0) {
                    candidate = "##" + candidate;
                }
                if (vocabulary.containsKey(candidate)) {
                    currentSubToken = candidate;
                    break;
                }
                end -= 1;
            }

            if (currentSubToken == null) {
                badToken = true;
                break;
            }

            pieces.add(currentSubToken);
            start = end;
        }

        if (badToken) {
            pieces.clear();
            pieces.add("[UNK]");
        }
        return pieces;
    }

    private Map<String, Integer> loadVocabulary(Context context, String assetPath) throws IOException {
        Map<String, Integer> result = new HashMap<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                context.getAssets().open(assetPath), StandardCharsets.UTF_8))) {
            String line;
            int index = 0;
            while ((line = reader.readLine()) != null) {
                result.put(line.trim(), index);
                index += 1;
            }
        }
        return result;
    }

    private int getRequiredId(String token) {
        Integer id = vocabulary.get(token);
        if (id == null) {
            throw new IllegalStateException("Missing token in vocabulary: " + token);
        }
        return id;
    }

    public static final class TokenizedInput {
        public final long[] inputIds;
        public final long[] attentionMask;
        public final long[] tokenTypeIds;

        public TokenizedInput(long[] inputIds, long[] attentionMask, long[] tokenTypeIds) {
            this.inputIds = inputIds;
            this.attentionMask = attentionMask;
            this.tokenTypeIds = tokenTypeIds;
        }
    }
}
