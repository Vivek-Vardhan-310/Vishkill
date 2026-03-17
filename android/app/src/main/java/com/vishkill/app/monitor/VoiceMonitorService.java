package com.vishkill.app.monitor;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.vishkill.app.R;
import com.vishkill.app.bridge.ScamBridge;
import com.vishkill.app.overlay.ScamOverlayManager;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class VoiceMonitorService extends Service {
    private static final String CHANNEL_ID = "vishkill-monitor";
    private static final int NOTIFICATION_ID = 1001;
    private static final int SAMPLE_RATE = 16000;
    private static final int CHUNK_MILLISECONDS = 4000; // 4 seconds for better Whisper detection
    private static final int MIN_CHUNK_BYTES = (SAMPLE_RATE * 2 * CHUNK_MILLISECONDS) / 1000;
    private static final String TAG = "VoiceMonitorService";
    private static final int PRIMARY_AUDIO_SOURCE = MediaRecorder.AudioSource.VOICE_RECOGNITION;
    private static final int FALLBACK_AUDIO_SOURCE = MediaRecorder.AudioSource.MIC;

    private AudioRecord audioRecord;
    private Thread workerThread;
    private volatile boolean running;
    private volatile boolean loggedFirstRead;
    private int cumulativeRiskScore;

    private WhisperEngine whisperEngine;

    private ExecutorService transcriptionExecutor;
    private AtomicBoolean isTranscribing;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        Log.i(TAG, "Foreground monitor service started.");
        if (!hasRecordAudioPermission()) {
            Log.w(TAG, "Microphone permission missing; stopping monitor service.");
            stopSelf();
            return START_NOT_STICKY;
        }
        startRecognitionLoop();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (audioRecord != null) {
            try {
                audioRecord.stop();
            } catch (IllegalStateException ignored) {
            }
            audioRecord.release();
            audioRecord = null;
        }
        if (workerThread != null) {
            workerThread.interrupt();
            workerThread = null;
        }
        if (transcriptionExecutor != null) {
            transcriptionExecutor.shutdownNow();
            transcriptionExecutor = null;
        }
        closeModels();
        ScamOverlayManager.dismiss(getApplicationContext());
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void startRecognitionLoop() {
        if (running) {
            Log.d(TAG, "Recognition loop already active.");
            return;
        }

        running = true;
        cumulativeRiskScore = 0;
        loggedFirstRead = false;

        if (transcriptionExecutor == null) {
            transcriptionExecutor = Executors.newFixedThreadPool(2);
        }
        isTranscribing = new AtomicBoolean(false);

        workerThread = new Thread(this::runRecognitionLoop, "VishKillVoiceMonitor");
        workerThread.start();
    }

    private void runRecognitionLoop() {
        try {
            loadModels();
            int minBuffer = AudioRecord.getMinBufferSize(
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT);
            if (minBuffer <= 0) {
                Log.e(TAG, "Unable to determine a valid microphone buffer size: " + minBuffer);
                stopSelf();
                return;
            }

            audioRecord = buildAudioRecord(PRIMARY_AUDIO_SOURCE, minBuffer);
            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.w(TAG, "VOICE_RECOGNITION source failed; falling back to MIC.");
                audioRecord.release();
                audioRecord = buildAudioRecord(FALLBACK_AUDIO_SOURCE, minBuffer);
            }

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord failed to initialize.");
                stopSelf();
                return;
            }

            audioRecord.startRecording();
            if (audioRecord.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                Log.e(TAG, "Microphone did not enter recording state.");
                stopSelf();
                return;
            }
            Log.i(TAG, "Microphone recording started successfully.");

            byte[] readBuffer = new byte[minBuffer];
            ByteArrayOutputStream chunkBuffer = new ByteArrayOutputStream();
            int chunkBytes = (SAMPLE_RATE * 2 * CHUNK_MILLISECONDS) / 1000;

            while (running && !Thread.currentThread().isInterrupted()) {
                int read = audioRecord.read(readBuffer, 0, readBuffer.length);
                if (read == AudioRecord.ERROR_INVALID_OPERATION || read == AudioRecord.ERROR_BAD_VALUE) {
                    Log.e(TAG, "Microphone read failed with code " + read + "; stopping monitor.");
                    running = false;
                    stopSelf();
                    break;
                }

                if (read <= 0) {
                    continue;
                }

                if (!loggedFirstRead) {
                    loggedFirstRead = true;
                    Log.i(TAG, "Received first microphone audio buffer: " + read + " bytes.");
                }

                chunkBuffer.write(readBuffer, 0, read);
                if (chunkBuffer.size() < chunkBytes) {
                    continue;
                }

                byte[] pcm = chunkBuffer.toByteArray();
                chunkBuffer.reset();
                if (pcm.length < MIN_CHUNK_BYTES) {
                    Log.d(TAG, "Skipping undersized audio chunk: " + pcm.length + " bytes.");
                    continue;
                }
                try {
                    Log.d(TAG, "Processing audio chunk of " + pcm.length + " bytes.");
                    transcriptionExecutor.submit(() -> {
                        try {
                            OfflineAnalysisResult result = transcribeAndAnalyze(pcm);
                            if (result != null && !result.transcript.isBlank()) {
                                emitAnalysis(result);
                            }
                        } catch (Exception exception) {
                            Log.e(TAG, "Local Whisper transcription failed.", exception);
                        }
                    });
                } catch (Exception exception) {
                    Log.e(TAG, "Failed to submit transcription task.", exception);
                }
            }
        } catch (Exception exception) {
            Log.e(TAG, "Offline monitor failed to start.", exception);
            stopSelf();
        }
    }

    private void loadModels() throws Exception {
        if (whisperEngine != null) {
            return;
        }

        whisperEngine = new WhisperEngine(this);
        Log.i(TAG, "Whisper model loaded successfully.");
    }

    private OfflineAnalysisResult transcribeAndAnalyze(byte[] pcm) throws Exception {
        String selectedTranscript = whisperEngine == null ? "" : whisperEngine.transcribePcm16(pcm);
        Log.d(TAG, "Chunk transcript. whisper=\"" + selectedTranscript + "\"");

        if (selectedTranscript.isBlank()) {
            Log.d(TAG, "No transcript detected for this audio chunk.");
            return null;
        }

        OfflineAnalysisResult result = OfflineScamAnalyzer.analyze(selectedTranscript, cumulativeRiskScore);
        cumulativeRiskScore = result.riskScore;
        Log.i(TAG, "Offline transcript analyzed. language=" + result.detectedLanguage
                + ", riskScore=" + result.riskScore
                + ", transcript=" + result.transcript);
        return result;
    }

    private AudioRecord buildAudioRecord(int audioSource, int minBuffer) {
        return new AudioRecord(
                audioSource,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                minBuffer * 2);
    }

    private void emitAnalysis(OfflineAnalysisResult result) {
        JSObject event = new JSObject();
        event.put("transcript", result.transcript);
        if (result.translatedText == null || result.translatedText.isBlank()) {
            event.put("translatedText", JSONObject.NULL);
        } else {
            event.put("translatedText", result.translatedText);
        }
        event.put("detectedLanguage", result.detectedLanguage);
        event.put("emotion", result.emotion);
        event.put("riskScore", result.riskScore);
        event.put("keywords", result.keywords);
        event.put("timestamp", String.valueOf(System.currentTimeMillis()));

        ScamBridge.emit("TRANSCRIPT_UPDATE", event);

        if (result.riskScore >= MonitorConfigStore.alertThreshold(this)) {
            ScamBridge.emit("SCAM_ALERT", event);
            ScamOverlayManager.show(getApplicationContext(), buildAlertPayload(result));
        }
    }

    private JSONObject buildAlertPayload(OfflineAnalysisResult result) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("transcript", result.transcript);
            if (result.translatedText == null || result.translatedText.isBlank()) {
                payload.put("translated_text", JSONObject.NULL);
            } else {
                payload.put("translated_text", result.translatedText);
            }
            payload.put("detected_language", result.detectedLanguage);
            payload.put("emotion", result.emotion);
            payload.put("keywords", result.keywords);
            payload.put("risk_score", result.riskScore);
        } catch (Exception ignored) {
        }
        return payload;
    }

    private void closeModels() {
        if (whisperEngine != null) {
            whisperEngine.close();
            whisperEngine = null;
        }
    }

    private boolean hasRecordAudioPermission() {
        return ContextCompat.checkSelfPermission(this,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("VishKill offline monitoring active")
                .setContentText("Listening and analyzing speech with bundled local models")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "VishKill Monitor",
                NotificationManager.IMPORTANCE_LOW);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.createNotificationChannel(channel);
    }
}
