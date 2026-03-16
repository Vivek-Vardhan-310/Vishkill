import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, History, Phone } from 'lucide-react';

const Navbar: React.FC = () => {
    const { pathname } = useLocation();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:shadow-green-500/50 transition-shadow">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xl font-bold gradient-text">VishKill</span>
                    </Link>

                    {/* Nav Links */}
                    <div className="flex items-center gap-1">
                        <Link
                            to="/call"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === '/call'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Phone className="w-4 h-4" />
                            Simulator
                        </Link>
                        <Link
                            to="/history"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === '/history'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <History className="w-4 h-4" />
                            History
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
