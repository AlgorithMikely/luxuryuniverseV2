import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, User } from 'lucide-react';

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
}

interface ChatWindowProps {
    onClose: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ onClose }) => {
    const { socket } = useSocket();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isAutoScroll, setIsAutoScroll] = useState(true);

    useEffect(() => {
        if (!socket) return;

        const handleChatMessage = (message: ChatMessage) => {
            setMessages((prev) => {
                const newMessages = [...prev, message];
                if (newMessages.length > 50) {
                    return newMessages.slice(newMessages.length - 50);
                }
                return newMessages;
            });
        };

        socket.on('chat_message', handleChatMessage);

        return () => {
            socket.off('chat_message', handleChatMessage);
        };
    }, [socket]);

    useEffect(() => {
        if (isAutoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isAutoScroll]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isBottom = scrollHeight - scrollTop === clientHeight;
        setIsAutoScroll(isBottom);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-4 right-4 w-80 h-96 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-pink-500" />
                    <span className="text-sm font-semibold text-white/90">Live Chat</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Messages Area */}
            <div
                className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                onScroll={handleScroll}
            >
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex gap-3 items-start group"
                        >
                            {/* Avatar */}
                            <div className="flex-shrink-0 mt-0.5">
                                {msg.avatar_url ? (
                                    <img
                                        src={msg.avatar_url}
                                        alt={msg.nickname}
                                        className="w-8 h-8 rounded-full border border-white/10 object-cover"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                        <User className="w-4 h-4 text-white/40" />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-bold text-white/80 truncate">
                                        {msg.nickname}
                                    </span>
                                    <span className="text-[10px] text-white/40">
                                        @{msg.username}
                                    </span>
                                </div>
                                <p className="text-sm text-white/90 break-words leading-relaxed">
                                    {msg.comment}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Footer / Status */}
            <div className="px-4 py-2 bg-white/5 border-t border-white/5 text-[10px] text-white/30 flex justify-between items-center">
                <span>TikTok Live</span>
                <span>{messages.length} messages</span>
            </div>
        </motion.div>
    );
};

export default ChatWindow;
