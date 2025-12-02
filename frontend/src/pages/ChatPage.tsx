import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, User } from 'lucide-react';

interface ChatMessage {
    id: string;
    username: string;
    nickname: string;
    avatar_url: string;
    comment: string;
    timestamp: number;
    user_level: number;
    is_member: boolean;
    is_moderator: boolean;
    is_follower: boolean;
    top_gifter_rank: number;
}

const ChatPage: React.FC = () => {
    const { reviewerId } = useParams<{ reviewerId: string }>();
    const { socket } = useSocket();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isAutoScroll, setIsAutoScroll] = useState(true);

    useEffect(() => {
        if (!socket || !reviewerId) return;

        // Join the reviewer's room to receive chat messages
        socket.emit('join_reviewer_room', reviewerId);
        console.log(`Joined reviewer room: ${reviewerId}`);

        const handleChatMessage = (message: ChatMessage) => {
            console.log('Received chat message:', message);
            setMessages((prev) => {
                const newMessages = [...prev, message];
                if (newMessages.length > 200) { // Increased buffer
                    return newMessages.slice(newMessages.length - 200);
                }
                return newMessages;
            });
        };

        socket.on('chat_message', handleChatMessage);

        return () => {
            socket.off('chat_message', handleChatMessage);
        };
    }, [socket, reviewerId]);

    useEffect(() => {
        if (isAutoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isAutoScroll]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // Check if user is near the bottom (within 20px)
        const isBottom = scrollHeight - scrollTop - clientHeight < 20;
        setIsAutoScroll(isBottom);
    };

    const getUsernameColor = (msg: ChatMessage) => {
        if (msg.is_moderator) return 'text-green-400';
        if (msg.is_member) return 'text-purple-400';
        if (msg.top_gifter_rank > 0 && msg.top_gifter_rank <= 3) return 'text-yellow-400'; // Top gifter
        if (msg.is_follower) return 'text-blue-400';
        return 'text-pink-500'; // Default
    };

    const getRoleBadge = (msg: ChatMessage) => {
        if (msg.is_moderator) return '🛡️';
        if (msg.is_member) return '⭐';
        if (msg.top_gifter_rank > 0) return '💎';
        return '';
    };

    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-white/10 shadow-md z-10">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-pink-500" />
                    <span className="font-bold text-lg">Live Chat</span>
                </div>
                <div className="text-xs text-white/40">
                    {messages.length} messages
                </div>
            </div>

            {/* Messages Area */}
            <div
                className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-gray-950 font-sans text-sm"
                onScroll={handleScroll}
            >
                <AnimatePresence initial={false}>
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-white/30 space-y-2">
                            <div className="animate-pulse">
                                <MessageSquare className="w-8 h-8 opacity-50" />
                            </div>
                            <div className="text-sm italic">
                                {socket?.connected ? 'Waiting for messages...' : 'Connecting to chat...'}
                            </div>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="break-words leading-snug text-white/90 hover:bg-white/5 px-2 py-1 rounded transition-colors"
                        >
                            <span className={`font-bold mr-2 select-none ${getUsernameColor(msg)}`}>
                                {getRoleBadge(msg)} {msg.nickname || msg.username}:
                            </span>
                            <span className="text-gray-200">
                                {msg.comment}
                            </span>
                        </motion.div>
                    ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};

export default ChatPage;
