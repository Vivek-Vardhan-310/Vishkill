import React, { useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';
import type { CallStatus } from '../types';

interface PhoneInputProps {
    callStatus: CallStatus;
    onStartCall: (phoneNumber: string) => void;
    onEndCall: () => void;
}

const PhoneInput: React.FC<PhoneInputProps> = ({ callStatus, onStartCall, onEndCall }) => {
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length < 7) {
            setError('Please enter a valid phone number.');
            return;
        }
        setError('');
        onStartCall(phone);
    };

    const isActive = callStatus === 'active' || callStatus === 'connecting';

    return (
        <div className="glass rounded-2xl p-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-green-400" />
                Phone Number
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <input
                        id="phone-input"
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        disabled={isActive}
                        placeholder="+91 98765 43210"
                        className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 
              focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all text-lg font-mono
              ${error ? 'border-red-500/50' : 'border-white/10 focus:border-green-500/50'}
              ${isActive ? 'opacity-50 cursor-not-allowed' : ''}
            `}
                    />
                    {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
                </div>

                {callStatus === 'idle' || callStatus === 'ended' ? (
                    <button
                        id="simulate-call-btn"
                        type="submit"
                        disabled={!phone}
                        className="w-full py-3 px-6 rounded-xl font-semibold text-white 
              bg-gradient-to-r from-green-500 to-emerald-600 
              hover:from-green-400 hover:to-emerald-500 
              shadow-lg shadow-green-500/30 hover:shadow-green-500/50
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        <Phone className="w-5 h-5" />
                        Simulate Call
                    </button>
                ) : callStatus === 'connecting' ? (
                    <button
                        type="button"
                        disabled
                        className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-gray-700 flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Connecting...
                    </button>
                ) : (
                    <button
                        id="end-call-btn"
                        type="button"
                        onClick={onEndCall}
                        className="w-full py-3 px-6 rounded-xl font-semibold text-white 
              bg-gradient-to-r from-red-500 to-rose-600
              hover:from-red-400 hover:to-rose-500
              shadow-lg shadow-red-500/30 hover:shadow-red-500/50
              transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        <Phone className="w-5 h-5 rotate-135" />
                        End Call
                    </button>
                )}
            </form>
        </div>
    );
};

export default PhoneInput;
