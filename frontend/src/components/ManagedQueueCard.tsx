import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QueueStatCard from './QueueStatCard';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { ReviewerProfile } from '../types';

interface ManagedQueueCardProps {
    reviewer: ReviewerProfile;
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



    const reviewerName = reviewer.tiktok_handle || reviewer.user?.username || `Reviewer #${reviewer.id}`;
    const dashboardLink = `/reviewer/${reviewer.id}`;

    return (
        <QueueStatCard
            queueLength={stats.length}
            avgWaitTime={stats.avg_wait_time}
            status={stats.status as 'open' | 'closed'}

            isReviewer={true}
            title={reviewerName}
            dashboardLink={dashboardLink}
        />
    );
};

export default ManagedQueueCard;
