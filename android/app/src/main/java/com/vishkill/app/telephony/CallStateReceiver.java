package com.vishkill.app.telephony;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.TelephonyManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.vishkill.app.bridge.ScamBridge;
import com.vishkill.app.monitor.VoiceMonitorService;
import com.vishkill.app.overlay.ScamOverlayManager;

public class CallStateReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String state = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
        if (TelephonyManager.EXTRA_STATE_OFFHOOK.equals(state)) {
            ContextCompat.startForegroundService(context, new Intent(context, VoiceMonitorService.class));
            ScamBridge.emit("CALL_STARTED", new JSObject());
        } else if (TelephonyManager.EXTRA_STATE_IDLE.equals(state)) {
            context.stopService(new Intent(context, VoiceMonitorService.class));
            ScamOverlayManager.dismiss(context);
            ScamBridge.emit("CALL_ENDED", new JSObject());
        }
    }
}
