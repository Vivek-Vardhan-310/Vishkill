package com.vishkill.app.overlay;

import android.content.Context;
import android.graphics.PixelFormat;
import android.provider.Settings;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import com.vishkill.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

public final class ScamOverlayManager {
    private static View overlayView;

    private ScamOverlayManager() {
    }

    public static void show(Context context, JSONObject payload) {
        if (!Settings.canDrawOverlays(context) || overlayView != null) {
            return;
        }

        WindowManager windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        overlayView = LayoutInflater.from(context).inflate(R.layout.overlay_scam_alert, null, false);

        TextView riskScore = overlayView.findViewById(R.id.overlayRiskScore);
        TextView emotion = overlayView.findViewById(R.id.overlayEmotion);
        TextView keywords = overlayView.findViewById(R.id.overlayKeywords);

        riskScore.setText(String.valueOf(payload.optInt("risk_score", 0)));
        emotion.setText(payload.optString("emotion", "neutral"));
        JSONArray keywordArray = payload.optJSONArray("keywords");
        keywords.setText(keywordArray == null ? "No keywords" : keywordArray.toString());

        overlayView.findViewById(R.id.overlayDismiss).setOnClickListener(view -> dismiss(context));
        overlayView.findViewById(R.id.overlayReport).setOnClickListener(view -> dismiss(context));
        overlayView.findViewById(R.id.overlayEndCall).setOnClickListener(view -> dismiss(context));

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP;
        windowManager.addView(overlayView, params);
    }

    public static void dismiss(Context context) {
        if (overlayView == null) {
            return;
        }
        WindowManager windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        windowManager.removeView(overlayView);
        overlayView = null;
    }
}
