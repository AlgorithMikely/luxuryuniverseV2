import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { DollarSign, TrendingUp, History } from 'lucide-react';
import PayoutModal from '../PayoutModal';

interface WalletPanelProps {
    reviewerId: string;
}

interface WalletData {
    balance_usd: number;
    total_earnings_usd: number;
}

interface LedgerEntry {
    id: number;
    action: string;
    credits_spent: number;
    usd_earned: number;
    timestamp: string;
    user?: {
        username: string;
        avatar?: string;
        discord_id?: string;
    };
    meta_data?: any;
}

const getAvatarUrl = (user: NonNullable<LedgerEntry['user']>) => {
    if (!user.avatar) return null;
    if (user.avatar.startsWith('http')) return user.avatar;
    if (user.discord_id) {
        const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.${ext}`;
    }
    return null;
};

const WalletPanel: React.FC<WalletPanelProps> = ({ reviewerId }) => {
    const [wallet, setWallet] = useState<WalletData | null>(null);
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [walletRes, ledgerRes] = await Promise.all([
                api.get<WalletData>(`/economy/reviewer/${reviewerId}/wallet`),
                api.get<LedgerEntry[]>(`/economy/reviewer/${reviewerId}/ledger`)
            ]);
            setWallet(walletRes.data);
            setLedger(ledgerRes.data);
        } catch (error) {
            console.error("Failed to fetch wallet data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (reviewerId) {
            fetchData();
        }
    }, [reviewerId]);

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading wallet...</div>;

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-900/50 rounded-lg text-green-400">
                            <DollarSign size={20} />
                        </div>
                        <span className="text-gray-400 text-sm font-medium">Available Balance</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-2xl font-bold text-white">${wallet?.balance_usd.toFixed(2)}</span>
                        <button
                            onClick={() => setIsPayoutModalOpen(true)}
                            disabled={(wallet?.balance_usd || 0) < 20}
                            className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Withdraw
                        </button>
                    </div>
                    {(wallet?.balance_usd || 0) < 20 && (
                        <p className="text-xs text-gray-500 mt-2">Min. withdrawal $20.00</p>
                    )}
                </div>

                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-900/50 rounded-lg text-purple-400">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-gray-400 text-sm font-medium">Total Earnings</span>
                    </div>
                    <span className="text-2xl font-bold text-white">${wallet?.total_earnings_usd.toFixed(2)}</span>
                </div>
            </div>

            {/* Transaction History */}
            <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-700 flex items-center gap-2">
                    <History size={16} className="text-gray-400" />
                    <h3 className="font-bold text-white">Transaction History</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900/50 text-gray-400 sticky top-0">
                            <tr>
                                <th className="p-3 font-medium">Date</th>
                                <th className="p-3 font-medium">User</th>
                                <th className="p-3 font-medium">Action</th>
                                <th className="p-3 font-medium text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {ledger.map((entry) => (
                                <tr key={entry.id} className="hover:bg-gray-700/30 transition-colors">
                                    <td className="p-3 text-gray-400 whitespace-nowrap">
                                        {new Date(entry.timestamp).toLocaleDateString()}
                                    </td>
                                    <td className="p-3">
                                        {entry.user ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-600 overflow-hidden">
                                                    {getAvatarUrl(entry.user) ? (
                                                        <img src={getAvatarUrl(entry.user)!} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                                                            {entry.user.username[0]}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-white truncate max-w-[100px]">{entry.user.username}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 italic">System</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-gray-300 capitalize">
                                        {entry.action.replace('_', ' ')}
                                    </td>
                                    <td className={`p-3 text-right font-medium ${entry.usd_earned >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {entry.usd_earned >= 0 ? '+' : ''}${Math.abs(entry.usd_earned).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            {ledger.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-500">
                                        No transactions yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <PayoutModal
                isOpen={isPayoutModalOpen}
                onClose={() => setIsPayoutModalOpen(false)}
                balance={wallet?.balance_usd || 0}
                onSuccess={fetchData}
            />
        </div>
    );
};

export default WalletPanel;
