import React, { useState } from 'react';
import PhoneInput from '../components/PhoneInput';
import CallStatusBadge from '../components/CallStatusBadge';
import MicIndicator from '../components/MicIndicator';
import RiskAnalysisPanel from '../components/RiskAnalysisPanel';
import ScamAlertModal from '../components/ScamAlertModal';
import { useCallRecorder } from '../hooks/useCallRecorder';

const SCAM_THRESHOLD = 70;

const CallSimulatorPage: React.FC = () => {
    const {
        callStatus, riskScore, emotion, keywords, transcripts,
        isRecording, startCall, endCall,
    } = useCallRecorder();

    const [phoneNumber, setPhoneNumber] = useState('');
    const [alertDismissed, setAlertDismissed] = useState(false);
    const showAlert = riskScore >= SCAM_THRESHOLD && !alertDismissed;

    const handleStartCall = async (phone: string) => {
        setPhoneNumber(phone);
        setAlertDismissed(false);
        await startCall(phone);
    };

    const handleEndCall = async () => {
        await endCall();
    };

    return (
        <div className="min-h-screen pt-20 pb-12 px-4 relative">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                    className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-3xl transition-colors duration-1000"
                    style={{
                        backgroundColor:
                            riskScore >= 70 ? 'rgba(239,68,68,0.06)' :
                                riskScore >= 40 ? 'rgba(245,158,11,0.06)' :
                                    'rgba(34,197,94,0.04)',
                    }}
                />
            </div>

            <div className="relative max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Call Simulator</h1>
                    <p className="text-gray-500 text-sm">Enter a number, start the simulation, and speak naturally</p>
                    <div className="mt-4 flex justify-center">
                        <CallStatusBadge status={callStatus} />
                    </div>
                </div>

                <div className="grid lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <PhoneInput
                            callStatus={callStatus}
                            onStartCall={handleStartCall}
                            onEndCall={handleEndCall}
                        />
                        <MicIndicator
                            isRecording={isRecording}
                            chunkCount={transcripts.length}
                        />

                        <div className="glass rounded-2xl p-5 border border-yellow-500/10">
                            <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-3">Demo Tips</p>
                            <ul className="text-xs text-gray-400 space-y-2">
                                <li className="flex gap-2"><span className="text-yellow-500 mt-0.5">*</span> Say scam phrases like <em className="text-gray-300">&quot;your bank account is blocked&quot;</em></li>
                                <li className="flex gap-2"><span className="text-yellow-500 mt-0.5">*</span> Try <em className="text-gray-300">&quot;urgent warrant arrest police&quot;</em> for max risk</li>
                                <li className="flex gap-2"><span className="text-yellow-500 mt-0.5">*</span> Analysis runs every 7 seconds automatically</li>
                                <li className="flex gap-2"><span className="text-yellow-500 mt-0.5">*</span> Risk score above 70 triggers the scam alert</li>
                            </ul>
                        </div>
                    </div>

                    <div className="lg:col-span-3">
                        <RiskAnalysisPanel
                            riskScore={riskScore}
                            emotion={emotion}
                            keywords={keywords}
                            transcripts={transcripts}
                        />
                    </div>
                </div>
            </div>

            {showAlert && (
                <ScamAlertModal
                    riskScore={riskScore}
                    phoneNumber={phoneNumber}
                    keywords={keywords}
                    emotion={emotion}
                    onEndCall={handleEndCall}
                    onDismiss={() => { setAlertDismissed(true); }}
                />
            )}
        </div>
    );
};

export default CallSimulatorPage;
