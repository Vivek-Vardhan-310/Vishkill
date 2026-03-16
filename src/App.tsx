import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import CallSimulatorPage from './pages/CallSimulatorPage';
import CallHistoryPage from './pages/CallHistoryPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/call" element={<CallSimulatorPage />} />
          <Route path="/history" element={<CallHistoryPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
