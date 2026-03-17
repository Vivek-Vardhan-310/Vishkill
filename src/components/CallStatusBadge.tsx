import React from 'react';
import { PhoneCall, PhoneOff, PhoneMissed, Wifi, ShieldCheck, Ban } from 'lucide-react';
import type { CallStatus } from '../types';

interface CallStatusBadgeProps {
    status: CallStatus;
}

const CONFIG = {
    idle: {
        icon: PhoneCall,
        label: 'Ready to Simulate',
        color: 'text-gray-400',
        bg: 'bg-gray-500/10 border-gray-500/20',
        dot: 'bg-gray-500',
    },
    connecting: {
        icon: Wifi,
        label: 'Connecting...',
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10 border-yellow-500/20',
        dot: 'bg-yellow-400 animate-pulse',
    },
    active: {
        icon: PhoneCall,
        label: 'Call Active',
        color: 'text-green-400',
        bg: 'bg-green-500/10 border-green-500/20',
        dot: 'bg-green-400',
    },
    ended: {
        icon: PhoneOff,
        label: 'Call Ended',
        color: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/20',
        dot: 'bg-red-400',
    },
    trusted: {
        icon: ShieldCheck,
        label: 'Trusted Contact',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        dot: 'bg-emerald-400',
    },
    blocked: {
        icon: Ban,
        label: 'Scam Blocked',
        color: 'text-red-500',
        bg: 'bg-red-500/20 border-red-500/30',
        dot: 'bg-red-500 animate-pulse',
    },
} as const;

const CallStatusBadge: React.FC<CallStatusBadgeProps> = ({ status }) => {
    const cfg = CONFIG[status];
    const Icon = cfg.icon;

    return (
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${cfg.bg} ${cfg.color}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <Icon className="w-4 h-4" />
            <span>{cfg.label}</span>
            {status === 'active' && <PhoneMissed className="w-3 h-3 opacity-60 ml-1" />}
        </div>
    );
};

export default CallStatusBadge;
