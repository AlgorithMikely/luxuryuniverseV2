import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QueueStatCard from './QueueStatCard';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface ManagedQueueCardProps {
    reviewer: {
        id: number;
        tiktok_handle: string | null;
        username?: string;
    };
}

const ManagedQueueCard: React.FC<ManagedQueueCardProps> = ({ reviewer }) => {
    const [stats, setStats] = useState({ length: 0, avg_wait_time: 0, status: 'closed' });
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const response = await api.get(`/reviewer/${reviewer.id}/stats`);
            setStats(response.data);
        } catch (error) {
            console.error("Failed to fetch queue stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        // Poll every 30 seconds for updates
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [reviewer.id]);

    const handleToggleStatus = async () => {
        const newStatus = stats.status === 'open' ? 'closed' : 'open';
        try {
            // Use the new explicit endpoint
            const response = await api.post(`/reviewer/${reviewer.id}/queue/status`, { status: newStatus });
            setStats(response.data);
            toast.success(`Queue ${newStatus === 'open' ? 'opened' : 'closed'}!`);
        } catch (error) {
            console.error("Failed to toggle status:", error);
            toast.error("Failed to update status");
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-lg font-bold text-gray-300">
                    {reviewer.tiktok_handle || reviewer.username || `Reviewer #${reviewer.id}`}
                </h3>
                <Link
                    to={`/reviewer/${reviewer.id}`}
                    className="text-xs text-purple-400 hover:text-purple-300"
                >
                    Visit Dashboard &rarr;
                </Link>
            </div>
            <QueueStatCard
                queueLength={stats.length}
                avgWaitTime={stats.avg_wait_time}
                status={stats.status as 'open'|'closed'}
                onToggleStatus={handleToggleStatus}
                isReviewer={true}
            />
        </div>
    );
};

export default ManagedQueueCard;
