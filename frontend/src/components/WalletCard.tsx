import React from 'react';
import { Coins, Zap, History } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Link } from 'react-router-dom';
import TopUpModal from './TopUpModal';
import { useState } from 'react';

interface WalletCardProps {
  balance: number;
  xp: number;
  level: number;
  reviewerId?: number;
}

const WalletCard: React.FC<WalletCardProps> = ({ balance, xp, level, reviewerId }) => {
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const { checkAuth } = useAuthStore();

  const handleTopUpSuccess = () => {
    checkAuth(); // Refresh balance
  };

  return (
    <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-xl p-6 shadow-lg text-white relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>

      <div className="flex justify-between items-start relative z-10">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-purple-200 font-semibold text-sm uppercase tracking-wider">Credits Balance</span>
          </div>
          <div className="flex items-center space-x-3">
            <Coins className="w-8 h-8 text-yellow-400" />
            <span className="text-4xl font-bold">{balance}</span>
          </div>
          <div className="mt-2 text-xs text-purple-300 flex items-center">
            <Link to="/wallet/history" className="flex items-center hover:text-white transition-colors">
              <History className="w-3 h-3 mr-1" /> View History
            </Link>
          </div>
        </div>

        <div className="text-right">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-blue-200 mb-1">Level {level}</span>
            <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
              {/* Simplified progress bar: assumes next level is roughly level * 100 XP or similar, for visual only */}
              <div
                className="h-full bg-blue-400 rounded-full"
                style={{ width: `${(xp % 100)}%` }} // Simplified visualization
              ></div>
            </div>
            <span className="text-xs text-gray-400 mt-1">{xp} XP</span>
          </div>

          <button
            onClick={() => setIsTopUpModalOpen(true)}
            className="mt-4 bg-white text-purple-900 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors flex items-center"
          >
            <Zap className="w-3 h-3 mr-1" /> Top Up
          </button>
        </div>
      </div>

      <TopUpModal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        onSuccess={handleTopUpSuccess}
        reviewerId={reviewerId}
      />
    </div >
  );
};

export default WalletCard;
