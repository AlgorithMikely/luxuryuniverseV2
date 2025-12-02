import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import api from '../services/api';

interface UserPublic {
    id: number;
    username: string;
    avatar?: string;
}

interface Transaction {
    id: number;
    reviewer_id: number;
    user_id: number;
    amount: number;
    reason: string;
    timestamp: string;
    user?: UserPublic;
}

const EconomyLogPage = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const limit = 50;

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const response = await api.get<Transaction[]>(`/economy/transactions?page=${page}&limit=${limit}`);
            setTransactions(response.data);
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [page]);

    return (
        <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link to="/admin" className="mr-4 p-2 hover:bg-gray-800 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-2xl font-bold">Economy Transaction Log</h1>
                </div>

                <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-500">Loading logs...</div>
                    ) : transactions.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                                    <tr>
                                        <th className="p-4">Time</th>
                                        <th className="p-4">User</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4">Reason</th>
                                        <th className="p-4">Type</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {transactions.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-gray-800/80 transition-colors">
                                            <td className="p-4 text-sm text-gray-400 whitespace-nowrap">
                                                {new Intl.DateTimeFormat('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: 'numeric',
                                                }).format(new Date(tx.timestamp))}
                                            </td>
                                            <td className="p-4 font-medium text-white">
                                                {tx.user ? (
                                                    <div className="flex items-center gap-2">
                                                        {tx.user.avatar && (
                                                            <img src={tx.user.avatar} alt="" className="w-6 h-6 rounded-full" />
                                                        )}
                                                        <span>{tx.user.username}</span>
                                                    </div>
                                                ) : (
                                                    `User ID: ${tx.user_id}`
                                                )}
                                            </td>
                                            <td className={`p-4 font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {tx.amount > 0 ? '+' : ''}{tx.amount}
                                            </td>
                                            <td className="p-4 text-gray-300">{tx.reason}</td>
                                            <td className="p-4">
                                                {tx.amount > 0 ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400">
                                                        <ArrowDownLeft className="w-3 h-3 mr-1" /> Credit
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-400">
                                                        <ArrowUpRight className="w-3 h-3 mr-1" /> Debit
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-500">
                            <p>No transactions found.</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-center mt-6 gap-4">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || isLoading}
                        className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 hover:bg-gray-700 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 bg-gray-800 rounded-lg">
                        Page {page}
                    </span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={transactions.length < limit || isLoading}
                        className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 hover:bg-gray-700 transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EconomyLogPage;
