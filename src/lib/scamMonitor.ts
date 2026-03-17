import { Capacitor, registerPlugin } from '@capacitor/core';

export interface ScamMonitorPayload {
  phoneNumber?: string;
  callId?: string;
  backendUrl?: string;
  alertThreshold?: number;
}

export interface ScamMonitorEvent {
  riskScore?: number;
  spamProbability?: number;
  emotion?: string;
  transcript?: string;
  translatedText?: string | null;
  detectedLanguage?: string;
  keywords?: string[];
  phoneNumber?: string;
  callId?: string;
  timestamp?: string;
}

export interface ScamMonitorPlugin {
  startMonitoring(options: ScamMonitorPayload): Promise<void>;
  stopMonitoring(): Promise<void>;
  requestPermissions(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ granted: boolean }>;
}

export const ScamMonitor = registerPlugin<ScamMonitorPlugin>('ScamMonitor');

export function isNativeScamMonitorAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('ScamMonitor');
}

export function addNativeScamMonitorListener(
  eventName: 'CALL_STARTED' | 'CALL_ENDED' | 'TRANSCRIPT_UPDATE' | 'SCAM_ALERT',
  listener: (event: ScamMonitorEvent) => void,
): () => void {
  const normalizePayload = (detail: unknown): ScamMonitorEvent => {
    if (!detail) return {};
    if (typeof detail === 'string') {
      try {
        return JSON.parse(detail) as ScamMonitorEvent;
      } catch {
        return {};
      }
    }
    if (typeof detail === 'object') {
      return detail as ScamMonitorEvent;
    }
    return {};
  };

  const wrapped = (event: Event) => {
    const customEvent = event as CustomEvent<ScamMonitorEvent | string>;
    listener(normalizePayload(customEvent.detail));
  };

  window.addEventListener(eventName, wrapped as EventListener);
  return () => window.removeEventListener(eventName, wrapped as EventListener);
}
