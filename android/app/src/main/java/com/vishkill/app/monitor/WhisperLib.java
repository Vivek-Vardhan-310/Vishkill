package com.vishkill.app.monitor;

import android.content.res.AssetManager;
import android.os.Build;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.InputStream;

final class WhisperLib {
    private static final String TAG = "WhisperLib";

    static {
        Log.d(TAG, "Primary ABI: " + Build.SUPPORTED_ABIS[0]);

        boolean loadVfpv4 = false;
        boolean loadV8fp16 = false;
        String cpuInfo = cpuInfo();

        if (isArmEabiV7a() && cpuInfo != null && cpuInfo.contains("vfpv4")) {
            loadVfpv4 = true;
        } else if (isArmEabiV8a() && cpuInfo != null && cpuInfo.contains("fphp")) {
            loadV8fp16 = true;
        }

        if (loadVfpv4) {
            System.loadLibrary("whisper_vfpv4");
        } else if (loadV8fp16) {
            System.loadLibrary("whisper_v8fp16_va");
        } else {
            System.loadLibrary("whisper");
        }
    }

    private WhisperLib() {
    }

    static native long initContextFromInputStream(InputStream inputStream);

    static native long initContextFromAsset(AssetManager assetManager, String assetPath);

    static native long initContext(String modelPath);

    static native void freeContext(long contextPtr);

    static native void fullTranscribe(long contextPtr, int numThreads, float[] audioData);

    static native int getTextSegmentCount(long contextPtr);

    static native String getTextSegment(long contextPtr, int index);

    static native long getTextSegmentT0(long contextPtr, int index);

    static native long getTextSegmentT1(long contextPtr, int index);

    private static boolean isArmEabiV7a() {
        return "armeabi-v7a".equals(Build.SUPPORTED_ABIS[0]);
    }

    private static boolean isArmEabiV8a() {
        return "arm64-v8a".equals(Build.SUPPORTED_ABIS[0]);
    }

    private static String cpuInfo() {
        try (BufferedReader reader = new BufferedReader(new FileReader(new File("/proc/cpuinfo")))) {
            StringBuilder builder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line).append('\n');
            }
            return builder.toString();
        } catch (Exception exception) {
            Log.w(TAG, "Couldn't read /proc/cpuinfo", exception);
            return null;
        }
    }
}
