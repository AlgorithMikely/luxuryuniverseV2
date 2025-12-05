import React from 'react';
import { X, Wallet } from 'lucide-react';
import WalletPanel from './Dashboard/WalletPanel';

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    reviewerId: string;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, reviewerId }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <div className="p-1.5 bg-green-500/20 rounded-lg">
                            <Wallet className="w-5 h-5 text-green-400" />
                        </div>
                        Streamer Wallet
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden p-6">
                    <WalletPanel reviewerId={reviewerId} />
                </div>
            </div>
        </div>
    );
};

export default WalletModal;
