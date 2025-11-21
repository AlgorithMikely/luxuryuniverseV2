import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import api from '../services/api';

interface Transaction {
    id: number;
    amount: number;
    reason: string;
    timestamp: string;
}

const WalletHistoryPage = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const response = await api.get<Transaction[]>('/user/me/transactions');
                setTransactions(response.data);
            } catch (error) {
                console.error('Failed to fetch transactions:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, []);

    return (
        <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link to="/hub" className="mr-4 p-2 hover:bg-gray-800 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-2xl font-bold">Wallet History</h1>
                </div>

                <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-500">Loading history...</div>
                    ) : transactions.length > 0 ? (
                        <div className="divide-y divide-gray-700">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="p-4 flex justify-between items-center hover:bg-gray-800/80 transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className={`p-2 rounded-full ${tx.amount > 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                            {tx.amount > 0 ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{tx.reason}</p>
                                            <p className="text-sm text-gray-400">
                                                {new Intl.DateTimeFormat('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: 'numeric',
                                                }).format(new Date(tx.timestamp))}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-white'}`}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount} Coins
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-500">
                            <p>No transactions found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WalletHistoryPage;
