import React from 'react';
import { X, Ban } from 'lucide-react';

interface BlockedNumberModalProps {
    reportCount: number;
    onDismiss: () => void;
    onContinue: () => void;
}

const BlockedNumberModal: React.FC<BlockedNumberModalProps> = ({
    reportCount,
    onDismiss,
    onContinue,
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div
                className="relative w-full max-w-md glass-strong rounded-3xl p-8 border border-red-500/50 shadow-2xl shadow-red-500/20 animate-slide-up"
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
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-rose-900 flex items-center justify-center shadow-lg shadow-red-500/50">
                            <Ban className="w-10 h-10 text-white" />
                        </div>
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-center text-red-500 mb-2 drop-shadow-md">
                    ALERT
                </h2>
                <p className="text-center text-gray-300 text-sm mb-8 leading-relaxed">
                    This number is already in our database as a known scam operation. 
                    <br/>
                    Simulation has been prevented to protect your device.
                </p>

                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-8 flex flex-col items-center justify-center">
                    <p className="text-sm text-red-200/70 uppercase tracking-widest font-semibold mb-2">Total Scam Reports</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-extrabold text-red-400 drop-shadow-md">{reportCount}</span>
                        <span className="text-lg text-red-400/50 font-bold">users</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onDismiss}
                        className="flex-1 flex items-center justify-center py-4 px-4 rounded-xl
                  bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold tracking-wide
                  hover:from-red-400 hover:to-rose-500 transition-all shadow-lg"
                    >
                        Decline Call
                    </button>
                    <button
                        onClick={onContinue}
                        className="flex-1 flex items-center justify-center py-4 px-4 rounded-xl
                  bg-white/5 border border-white/10 text-gray-300 font-semibold tracking-wide
                  hover:bg-white/10 hover:text-white transition-all shadow-lg"
                    >
                        Continue Anyway
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BlockedNumberModal;
