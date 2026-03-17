package com.vishkill.app.bridge;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;

import org.json.JSONObject;

public final class ScamBridge {
    private static Bridge bridge;

    private ScamBridge() {
    }

    public static void setBridge(Bridge bridgeInstance) {
        bridge = bridgeInstance;
    }

    public static void emit(String eventName, JSObject payload) {
        if (bridge == null) {
            return;
        }
        String serializedPayload = payload == null ? "{}" : payload.toString();
        bridge.executeOnMainThread(() -> {
            String quotedEventName = JSONObject.quote(eventName);
            String quotedNamespacedEventName = JSONObject.quote("vishkill:" + eventName);
            String dispatchScript =
                    "(function() {" +
                            "const payload = JSON.parse(" + JSONObject.quote(serializedPayload) + ");" +
                            "window.dispatchEvent(new CustomEvent(" + quotedEventName + ", { detail: payload }));" +
                            "window.dispatchEvent(new CustomEvent(" + quotedNamespacedEventName + ", { detail: payload }));" +
                    "})();";

            bridge.getWebView().evaluateJavascript(dispatchScript, null);
        });
    }
}
