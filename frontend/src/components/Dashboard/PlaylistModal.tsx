import React, { useState, useMemo } from 'react';
import { X, Plus, Search, Tag } from 'lucide-react';

interface PlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (tag: string) => void;
    existingTags: string[];
}

const PlaylistModal: React.FC<PlaylistModalProps> = ({ isOpen, onClose, onSelect, existingTags }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTags = useMemo(() => {
        return existingTags.filter(tag =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort();
    }, [existingTags, searchTerm]);

    const exactMatch = existingTags.some(tag => tag.toLowerCase() === searchTerm.toLowerCase());

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Tag className="w-5 h-5 text-purple-500" />
                        Add to Playlist
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search / Create Input */}
                <div className="p-4 border-b border-gray-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search or create new playlist..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/40 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 placeholder-gray-500"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {/* Create Option */}
                    {searchTerm && !exactMatch && (
                        <button
                            onClick={() => {
                                onSelect(searchTerm);
                                setSearchTerm('');
                                onClose();
                            }}
                            className="w-full text-left px-4 py-3 rounded-xl hover:bg-purple-500/20 hover:text-purple-300 text-purple-400 transition-all flex items-center gap-3 group border border-dashed border-purple-500/30 hover:border-purple-500/50"
                        >
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                <Plus className="w-5 h-5" />
                            </div>
                            <span className="font-medium">Create "{searchTerm}"</span>
                        </button>
                    )}

                    {/* Existing Tags */}
                    {filteredTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => {
                                onSelect(tag);
                                setSearchTerm('');
                                onClose();
                            }}
                            className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-300 hover:text-white transition-all flex items-center gap-3 group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors">
                                <Tag className="w-4 h-4 text-gray-500 group-hover:text-gray-300" />
                            </div>
                            <span className="font-medium">{tag}</span>
                        </button>
                    ))}

                    {filteredTags.length === 0 && !searchTerm && (
                        <div className="text-center py-8 text-gray-500">
                            <p>No playlists found.</p>
                            <p className="text-xs mt-1">Type above to create one.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlaylistModal;
