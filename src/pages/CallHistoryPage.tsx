import React, { useEffect, useState } from 'react';
import { History, Phone, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { CallRecord, RiskLevel } from '../types';

const STATUS_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; dot: string }> = {
    safe: { label: 'Safe', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/25', dot: 'bg-green-400' },
    suspicious: { label: 'Suspicious', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25', dot: 'bg-yellow-400' },
    scam: { label: 'Scam', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25', dot: 'bg-red-400' },
};

const MOCK_CALLS: CallRecord[] = [
    {
        id: 'm1',
        phone_number: '+91 98765 43210',
        user_id: null,
        start_time: new Date(Date.now() - 3_600_000).toISOString(),
        end_time: new Date(Date.now() - 3_540_000).toISOString(),
        risk_score: 85,
        status: 'scam',
    },
    {
        id: 'm2',
        phone_number: '+91 70123 45678',
        user_id: null,
        start_time: new Date(Date.now() - 7_200_000).toISOString(),
        end_time: new Date(Date.now() - 7_140_000).toISOString(),
        risk_score: 47,
        status: 'suspicious',
    },
    {
        id: 'm3',
        phone_number: '+91 80056 77890',
        user_id: null,
        start_time: new Date(Date.now() - 86_400_000).toISOString(),
        end_time: new Date(Date.now() - 86_340_000).toISOString(),
        risk_score: 12,
        status: 'safe',
    },
];

function formatDuration(start: string, end: string | null): string {
    if (!end) return 'Ongoing';
    const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const CallHistoryPage: React.FC = () => {
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | RiskLevel>('all');

    const fetchCalls = async () => {
        setLoading(true);
        try {
            if (!isSupabaseConfigured) throw new Error('Demo mode');

            const { data, error } = await supabase
                .from('calls')
                .select('*')
                .order('start_time', { ascending: false })
                .limit(50);

            if (error || !data || data.length === 0) {
                setCalls(MOCK_CALLS);
            } else {
                setCalls(data as CallRecord[]);
            }
        } catch {
            setCalls(MOCK_CALLS);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchCalls();
    }, []);

    useEffect(() => {
        if (!isSupabaseConfigured) return;

        const channel = supabase
            .channel('calls-live-history')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
                void fetchCalls();
            })
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, []);

    const filtered = filter === 'all' ? calls : calls.filter(call => call.status === filter);

    const counts = {
        all: calls.length,
        safe: calls.filter(call => call.status === 'safe').length,
        suspicious: calls.filter(call => call.status === 'suspicious').length,
        scam: calls.filter(call => call.status === 'scam').length,
    };

    return (
        <div className="min-h-screen pt-20 pb-12 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <History className="w-8 h-8 text-green-400" />
                            Call History
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Previous simulated calls and their risk assessments</p>
                        {!isSupabaseConfigured && (
                            <p className="text-xs text-gray-600 mt-2">
                                Running in demo mode. Add Supabase env vars to enable live database history.
                            </p>
                        )}
                    </div>
                    <button
                        id="refresh-history-btn"
                        onClick={() => { void fetchCalls(); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 
              text-gray-400 hover:text-white hover:border-white/20 transition-all text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-8">
                    {(['all', 'safe', 'suspicious', 'scam'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`rounded-xl p-4 text-center border transition-all ${filter === status
                                    ? status === 'all'
                                        ? 'bg-white/10 border-white/20'
                                        : STATUS_CONFIG[status].bg
                                    : 'glass border-white/5 hover:border-white/15'
                                }`}
                        >
                            <p className={`text-2xl font-bold ${status !== 'all' ? STATUS_CONFIG[status].color : 'text-white'}`}>
                                {counts[status]}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 capitalize">
                                {status === 'all' ? 'All Calls' : STATUS_CONFIG[status].label}
                            </p>
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <RefreshCw className="w-8 h-8 text-gray-600 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-24 text-gray-500">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No {filter !== 'all' ? filter : ''} calls found.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(call => {
                            const config = STATUS_CONFIG[call.status];

                            return (
                                <div
                                    key={call.id}
                                    className="glass rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all animate-fade-in"
                                >
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bg} border`}>
                                                <Phone className={`w-5 h-5 ${config.color}`} />
                                            </div>
                                            <div>
                                                <p className="font-mono font-semibold text-white">{call.phone_number}</p>
                                                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatDate(call.start_time)}
                                                    </span>
                                                    <span>{formatDuration(call.start_time, call.end_time)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-center">
                                                <p className={`text-xl font-bold ${config.color}`}>{call.risk_score}</p>
                                                <p className="text-xs text-gray-600 flex items-center gap-1">
                                                    <TrendingUp className="w-3 h-3" />
                                                    Risk Score
                                                </p>
                                            </div>
                                            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${config.bg} ${config.color}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                                                {config.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CallHistoryPage;
