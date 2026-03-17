package com.vishkill.app.plugin;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PermissionCallback;
import com.vishkill.app.bridge.ScamBridge;
import com.vishkill.app.monitor.MonitorConfigStore;
import com.vishkill.app.monitor.VoiceMonitorService;

@CapacitorPlugin(
        name = "ScamMonitor",
        permissions = {
                @Permission(alias = "audio", strings = {Manifest.permission.RECORD_AUDIO}),
                @Permission(alias = "phone", strings = {Manifest.permission.READ_PHONE_STATE})
        }
)
public class ScamMonitorPlugin extends Plugin {
    private static final String TAG = "ScamMonitorPlugin";

    @Override
    public void load() {
        ScamBridge.setBridge(getBridge());
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        Log.d(TAG, "Requesting audio and phone permissions.");
        requestAllPermissions(call, "permissionsCallback");
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        boolean granted = Settings.canDrawOverlays(getContext());
        if (!granted) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void startMonitoring(PluginCall call) {
        if (getPermissionState("audio") != PermissionState.GRANTED) {
            call.reject("Microphone permission is required before monitoring can start.");
            return;
        }

        String backendUrl = call.getString("backendUrl", "");
        String phoneNumber = call.getString("phoneNumber", "unknown");
        String callId = call.getString("callId", "native-" + System.currentTimeMillis());
        int alertThreshold = call.getInt("alertThreshold", 70);

        Log.i(TAG, "Starting monitoring for callId=" + callId + ", phoneNumber=" + phoneNumber);
        MonitorConfigStore.save(getContext(), backendUrl, phoneNumber, callId, alertThreshold);
        Intent intent = new Intent(getContext(), VoiceMonitorService.class);
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void stopMonitoring(PluginCall call) {
        Log.i(TAG, "Stopping monitoring service.");
        getContext().stopService(new Intent(getContext(), VoiceMonitorService.class));
        call.resolve();
    }

    @PermissionCallback
    public void permissionsCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("audio") == PermissionState.GRANTED
                && getPermissionState("phone") == PermissionState.GRANTED);
        Log.d(TAG, "Permissions callback granted=" + result.getBool("granted"));
        call.resolve(result);
    }
}

