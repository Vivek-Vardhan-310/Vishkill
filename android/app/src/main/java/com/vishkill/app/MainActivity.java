package com.vishkill.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.vishkill.app.bridge.ScamBridge;
import com.vishkill.app.monitor.VoiceMonitorService;
import com.vishkill.app.plugin.ScamMonitorPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScamMonitorPlugin.class);
        super.onCreate(savedInstanceState);
        ScamBridge.setBridge(bridge);

        // DEBUG: Auto-start monitoring for testing JNI
        new Thread(() -> {
            try {
                Thread.sleep(4000); // Wait for app to fully initialize
                Log.d(TAG, "=== DEBUG: Starting VoiceMonitorService for JNI testing ===");
                Intent intent = new Intent(getApplicationContext(), VoiceMonitorService.class);
                ContextCompat.startForegroundService(getApplicationContext(), intent);
                Log.d(TAG, "=== DEBUG: Service start intent sent ===");
            } catch (Exception e) {
                Log.e(TAG, "Failed to start monitoring for testing", e);
            }
        }).start();
    }
}
