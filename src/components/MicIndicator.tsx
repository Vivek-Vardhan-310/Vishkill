import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface MicIndicatorProps {
    isRecording: boolean;
    chunkCount: number;
}

const WAVE_BARS = [
    { height: '12px', duration: '0.65s' },
    { height: '22px', duration: '0.9s' },
    { height: '16px', duration: '0.7s' },
    { height: '28px', duration: '1.05s' },
    { height: '20px', duration: '0.82s' },
    { height: '30px', duration: '0.95s' },
    { height: '18px', duration: '0.75s' },
    { height: '24px', duration: '0.88s' },
    { height: '14px', duration: '0.68s' },
];

const MicIndicator: React.FC<MicIndicatorProps> = ({ isRecording, chunkCount }) => {
    return (
        <div className="glass rounded-2xl p-6 flex flex-col items-center gap-4 animate-fade-in">
            <div className="relative flex items-center justify-center">
                {isRecording && (
                    <>
                        <div className="absolute w-24 h-24 rounded-full bg-green-500/10 animate-ping-slow" />
                        <div className="absolute w-20 h-20 rounded-full bg-green-500/15 animate-ping" style={{ animationDelay: '0.3s' }} />
                    </>
                )}

                <div
                    className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording
                            ? 'bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/50 pulse-ring'
                            : 'bg-white/5 border border-white/10'
                        }`}
                >
                    {isRecording
                        ? <Mic className="w-7 h-7 text-white" />
                        : <MicOff className="w-7 h-7 text-gray-500" />
                    }
                </div>
            </div>

            {isRecording && (
                <div className="flex items-end gap-1 h-8">
                    {WAVE_BARS.map((bar, i) => (
                        <span
                            key={i}
                            className="waveform-bar"
                            style={{
                                height: bar.height,
                                animationDelay: `${i * 0.1}s`,
                                animationDuration: bar.duration,
                            }}
                        />
                    ))}
                </div>
            )}

            <div className="text-center">
                <p className={`text-sm font-medium ${isRecording ? 'text-green-400' : 'text-gray-500'}`}>
                    {isRecording ? 'Listening...' : 'Microphone Off'}
                </p>
                {chunkCount > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{chunkCount} chunks analyzed</p>
                )}
            </div>
        </div>
    );
};

export default MicIndicator;
