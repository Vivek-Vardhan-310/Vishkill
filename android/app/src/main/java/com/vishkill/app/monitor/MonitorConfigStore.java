package com.vishkill.app.monitor;

import android.content.Context;
import android.content.SharedPreferences;

public final class MonitorConfigStore {
    private static final String PREFS = "vishkill_monitor";

    private MonitorConfigStore() {
    }

    public static void save(Context context, String backendUrl, String phoneNumber, String callId, int alertThreshold) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
                .putString("backendUrl", backendUrl)
                .putString("phoneNumber", phoneNumber)
                .putString("callId", callId)
                .putInt("alertThreshold", alertThreshold)
                .apply();
    }

    public static String backendUrl(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("backendUrl", "");
    }

    public static String phoneNumber(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("phoneNumber", "unknown");
    }

    public static String callId(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("callId",
                "native-" + System.currentTimeMillis());
    }

    public static int alertThreshold(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("alertThreshold", 55);
    }
}
