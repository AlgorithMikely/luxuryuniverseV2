import React, { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface PayoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    balance: number;
    onSuccess: () => void;
}

const PayoutModal: React.FC<PayoutModalProps> = ({ isOpen, onClose, balance, onSuccess }) => {
    const [email, setEmail] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePayout = async () => {
        if (!email) {
            toast.error("Please enter your PayPal email.");
            return;
        }
        setIsProcessing(true);
        try {
            await api.post('/paypal/payout', { email });
            toast.success("Payout initiated successfully!");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Payout failed", error);
            toast.error(error.response?.data?.detail || "Payout failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <DollarSign className="w-5 h-5 mr-2 text-green-400" />
                        Withdraw Funds
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-gray-800 p-4 rounded-lg text-center">
                        <p className="text-gray-400 text-sm mb-1">Available Balance</p>
                        <p className="text-3xl font-bold text-white">${balance.toFixed(2)}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">PayPal Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                            placeholder="your-email@example.com"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Funds will be sent to this PayPal account immediately.
                        </p>
                    </div>
                    <button
                        onClick={handlePayout}
                        disabled={isProcessing || !email}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        {isProcessing ? 'Processing...' : `Withdraw $${balance.toFixed(2)}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PayoutModal;
