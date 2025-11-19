import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Submission {
    id: number;
    reviewer_id: number;
    user_id: number;
    track_url: string;
    track_title: string;
    status: string;
    submitted_at: string;
    is_priority: boolean;
    user: {
        username: string;
        discord_id: string;
    };
}

export const useQueue = (reviewerId: number) => {
    const { socket } = useSocket();
    const queryClient = useQueryClient();
    const { token } = useAuthStore();

    const fetchQueue = async () => {
        const response = await axios.get(`${API_URL}/api/v1/${reviewerId}/queue`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data as Submission[];
    };

    const fetchHistory = async () => {
        const response = await axios.get(`${API_URL}/api/v1/${reviewerId}/history`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data as Submission[];
    };

    const { data: queue = [], isLoading: isQueueLoading } = useQuery({
        queryKey: ['queue', reviewerId],
        queryFn: fetchQueue,
        enabled: !!reviewerId && !!token,
    });

    const { data: history = [], isLoading: isHistoryLoading } = useQuery({
        queryKey: ['history', reviewerId],
        queryFn: fetchHistory,
        enabled: !!reviewerId && !!token,
    });

    useEffect(() => {
        if (!socket) return;

        socket.on('queue_updated', (newQueue: Submission[]) => {
            queryClient.setQueryData(['queue', reviewerId], newQueue);
        });

        socket.on('history_updated', (newHistory: Submission[]) => {
            queryClient.setQueryData(['history', reviewerId], newHistory);
        });

        return () => {
            socket.off('queue_updated');
            socket.off('history_updated');
        };
    }, [socket, queryClient, reviewerId]);

    const advanceQueueMutation = useMutation({
        mutationFn: async () => {
            const response = await axios.post(`${API_URL}/api/v1/${reviewerId}/next`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        },
        onSuccess: () => {
            // Optimistic update handled by socket event usually, but we can invalidate to be safe
            queryClient.invalidateQueries({ queryKey: ['queue', reviewerId] });
            queryClient.invalidateQueries({ queryKey: ['history', reviewerId] });
        },
    });

    return {
        queue,
        history,
        isQueueLoading,
        isHistoryLoading,
        advanceQueue: advanceQueueMutation.mutate,
    };
};
