package com.vishkill.app.monitor;

import android.content.Context;
import android.util.Log;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import ai.onnxruntime.OrtSession.Result;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public final class OnnxSpamClassifier implements AutoCloseable {
    private static final String TAG = "OnnxSpamClassifier";

    private final OrtEnvironment environment;
    private final OrtSession session;
    private final BertWordPieceTokenizer tokenizer;
    private final String outputName;

    public OnnxSpamClassifier(Context context) throws Exception {
        tokenizer = new BertWordPieceTokenizer(context, "spam-classifier/vocab.txt");
        File modelFile = copyModelIfNeeded(context);
        environment = OrtEnvironment.getEnvironment();
        session = environment.createSession(modelFile.getAbsolutePath(), new OrtSession.SessionOptions());
        outputName = session.getOutputNames().iterator().next();
        Log.i(TAG, "ONNX spam classifier loaded with output=" + outputName);
    }

    public float scoreSpam(String text) throws OrtException {
        if (text == null || text.isBlank()) {
            return 0f;
        }

        BertWordPieceTokenizer.TokenizedInput tokenized = tokenizer.tokenize(text);
        Map<String, OnnxTensor> inputs = new HashMap<>();
        inputs.put("input_ids", OnnxTensor.createTensor(environment, new long[][]{tokenized.inputIds}));
        inputs.put("attention_mask", OnnxTensor.createTensor(environment, new long[][]{tokenized.attentionMask}));
        if (session.getInputNames().contains("token_type_ids")) {
            inputs.put("token_type_ids", OnnxTensor.createTensor(environment, new long[][]{tokenized.tokenTypeIds}));
        }

        try (Result result = session.run(inputs)) {
            Object value = result.get(outputName).get().getValue();
            float[] logits = flattenLogits(value);
            if (logits.length < 2) {
                return 0f;
            }
            return softmax(logits)[1];
        } finally {
            for (OnnxTensor tensor : inputs.values()) {
                tensor.close();
            }
        }
    }

    private float[] flattenLogits(Object value) {
        if (value instanceof float[][]) {
            return ((float[][]) value)[0];
        }
        if (value instanceof float[]) {
            return (float[]) value;
        }
        if (value instanceof long[][]) {
            long[] raw = ((long[][]) value)[0];
            float[] converted = new float[raw.length];
            for (int index = 0; index < raw.length; index += 1) {
                converted[index] = raw[index];
            }
            return converted;
        }
        if (value instanceof long[]) {
            long[] raw = (long[]) value;
            float[] converted = new float[raw.length];
            for (int index = 0; index < raw.length; index += 1) {
                converted[index] = raw[index];
            }
            return converted;
        }
        return new float[0];
    }

    private float[] softmax(float[] logits) {
        float max = Float.NEGATIVE_INFINITY;
        for (float logit : logits) {
            if (logit > max) {
                max = logit;
            }
        }

        double sum = 0d;
        float[] result = new float[logits.length];
        for (int index = 0; index < logits.length; index += 1) {
            result[index] = (float) Math.exp(logits[index] - max);
            sum += result[index];
        }
        for (int index = 0; index < result.length; index += 1) {
            result[index] = (float) (result[index] / sum);
        }
        return result;
    }

    private File copyModelIfNeeded(Context context) throws IOException {
        File root = new File(context.getFilesDir(), "spam-classifier");
        if (!root.exists() && !root.mkdirs()) {
            throw new IOException("Failed to create " + root.getAbsolutePath());
        }

        File modelFile = new File(root, "model.onnx");
        if (modelFile.exists()) {
            return modelFile;
        }

        try (InputStream inputStream = context.getAssets().open("spam-classifier/onnx/model.onnx");
             FileOutputStream outputStream = new FileOutputStream(modelFile, false)) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, count);
            }
        }
        return modelFile;
    }

    @Override
    public void close() throws Exception {
        session.close();
        environment.close();
    }
}
