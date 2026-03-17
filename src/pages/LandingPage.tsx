import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Brain, TrendingUp, ArrowRight, Phone } from 'lucide-react';

const FEATURES = [
    {
        icon: Shield,
        title: 'Real-Time Protection',
        desc: 'Analyzes every sentence as you speak, not just a summary at the end.',
        color: 'text-green-400',
        bg: 'bg-green-500/10 border-green-500/20',
    },
    {
        icon: Brain,
        title: 'Emotion Detection',
        desc: 'Identifies fear, urgency, and pressure tactics used by scammers.',
        color: 'text-purple-400',
        bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
        icon: TrendingUp,
        title: 'Risk Scoring',
        desc: 'Dynamic risk score (0-100) updating live with each audio chunk.',
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10 border-yellow-500/20',
    },
    {
        icon: Zap,
        title: 'Instant Alerts',
        desc: 'Automated scam alert modal fires the moment risk crosses threshold.',
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
];

const LandingPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-grid relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse-slow" />
                <div className="absolute top-1/2 -right-40 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
                <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '3s' }} />
            </div>

            <section className="relative pt-32 pb-24 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-green-500/20 text-green-400 text-sm font-medium mb-8 animate-fade-in">
                        <Zap className="w-4 h-4" />
                        AI-Powered Scam Detection - Hackathon 2026
                    </div>

                    <h1 className="text-6xl sm:text-8xl font-black mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <span className="gradient-text">Vish</span>
                        <span className="text-white">Kill</span>
                    </h1>

                    <p className="text-2xl sm:text-3xl font-light text-gray-300 mb-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        Real-Time Voice Scam Detection
                    </p>

                    <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-12 leading-relaxed animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        Simulate a phone call, speak naturally, and let our AI analyze your conversation
                        in real time - detecting scam signals, emotional manipulation, and suspicious keywords
                        before it&apos;s too late.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                        <button
                            id="start-call-btn"
                            onClick={() => navigate('/call')}
                            className="group flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg text-white
                bg-gradient-to-r from-green-500 to-emerald-600
                hover:from-green-400 hover:to-emerald-500
                shadow-2xl shadow-green-500/40 hover:shadow-green-500/60
                transition-all duration-300 animate-glow"
                        >
                            <Phone className="w-6 h-6" />
                            Start Call Simulation
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                            onClick={() => navigate('/history')}
                            className="flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-gray-300
                glass border border-white/10 hover:border-white/20 hover:text-white
                transition-all duration-200"
                        >
                            View Call History
                        </button>
                    </div>
                </div>
            </section>

            <section className="relative py-12 px-4">
                <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4">
                    {[
                        { value: '7s', label: 'Analysis Window' },
                        { value: '100', label: 'Max Risk Score' },
                        { value: 'Live', label: 'Real-Time Updates' },
                    ].map(stat => (
                        <div key={stat.label} className="glass rounded-2xl p-6 text-center">
                            <p className="text-3xl font-black gradient-text">{stat.value}</p>
                            <p className="text-gray-500 text-sm mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="relative py-16 px-4">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center mb-12">
                        How VishKill Protects You
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {FEATURES.map(feature => (
                            <div key={feature.title} className={`glass rounded-2xl p-6 border ${feature.bg} hover:scale-[1.02] transition-transform`}>
                                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.bg} border mb-4`}>
                                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                                </div>
                                <h3 className={`text-lg font-bold mb-2 ${feature.color}`}>{feature.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

        </div>
    );
};

export default LandingPage;
