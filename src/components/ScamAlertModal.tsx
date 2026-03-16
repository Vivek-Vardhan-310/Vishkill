import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, PhoneOff, Flag, X } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface ScamAlertModalProps {
    riskScore: number;
    phoneNumber: string;
    keywords: string[];
    emotion: string;
    onEndCall: () => void;
    onDismiss: () => void;
}

const ScamAlertModal: React.FC<ScamAlertModalProps> = ({
    riskScore, phoneNumber, keywords, emotion, onEndCall, onDismiss,
}) => {
    const [reported, setReported] = useState(false);
    const [reporting, setReporting] = useState(false);

    const handleReport = async () => {
        setReporting(true);
        try {
            if (!isSupabaseConfigured) throw new Error('Demo mode');

            const { data: existing } = await supabase
                .from('scam_reports')
                .select('id, report_count')
                .eq('phone_number', phoneNumber)
                .single();

            if (existing) {
                await supabase.from('scam_reports').update({
                    report_count: existing.report_count + 1,
                    last_reported: new Date().toISOString(),
                }).eq('id', existing.id);
            } else {
                await supabase.from('scam_reports').insert({
                    phone_number: phoneNumber,
                    report_count: 1,
                    last_reported: new Date().toISOString(),
                });
            }
            setReported(true);
        } catch {
            setReported(true);
        } finally {
            setReporting(false);
        }
    };

    const handleEndCall = () => {
        onEndCall();
        onDismiss();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div
                className="relative w-full max-w-md glass-strong rounded-3xl p-8 border border-red-500/30 shadow-2xl shadow-red-500/20 animate-slide-up"
                id="scam-alert-modal"
            >
                <button
                    onClick={onDismiss}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                    aria-label="Dismiss warning"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center justify-center mb-6">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center shadow-lg shadow-red-500/50">
                            <ShieldAlert className="w-10 h-10 text-white" />
                        </div>
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-center gradient-text-danger mb-1">
                    SCAM DETECTED
                </h2>
                <p className="text-center text-gray-400 text-sm mb-6">
                    High-risk activity detected on this call
                </p>

                <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 mb-4 text-center">
                    <p className="text-sm text-gray-400 mb-1">Risk Score</p>
                    <p className="text-5xl font-bold text-red-400">{riskScore}</p>
                    <p className="text-xs text-red-400/70 mt-1 font-semibold tracking-widest">/ 100</p>
                </div>

                <div className="space-y-3 mb-6">
                    {keywords.length > 0 && (
                        <div className="flex items-start gap-3 text-sm">
                            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                            <div>
                                <span className="text-gray-400">Scam signals: </span>
                                <span className="text-red-300 font-medium">{keywords.join(', ')}</span>
                            </div>
                        </div>
                    )}
                    {emotion !== 'neutral' && (
                        <div className="flex items-start gap-3 text-sm">
                            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                            <div>
                                <span className="text-gray-400">Emotional manipulation: </span>
                                <span className="text-yellow-300 font-medium capitalize">{emotion}</span>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-3 text-sm">
                        <Flag className="w-4 h-4 text-orange-400 shrink-0" />
                        <div>
                            <span className="text-gray-400">Number: </span>
                            <span className="text-orange-300 font-mono font-medium">{phoneNumber}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        id="end-call-modal-btn"
                        onClick={handleEndCall}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl
              bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold
              hover:from-red-400 hover:to-rose-500 transition-all
              shadow-lg shadow-red-500/30"
                    >
                        <PhoneOff className="w-4 h-4" />
                        End Call
                    </button>

                    <button
                        id="report-btn"
                        onClick={handleReport}
                        disabled={reported || reporting}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all border ${reported
                                ? 'bg-green-500/10 border-green-500/30 text-green-400 cursor-default'
                                : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                            }`}
                    >
                        <Flag className="w-4 h-4" />
                        {reported ? 'Reported!' : reporting ? 'Reporting...' : 'Report Number'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScamAlertModal;
