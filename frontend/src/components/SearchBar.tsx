import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User, Music, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { User as UserType, ReviewerProfile, Submission } from '../types';

interface SearchResults {
    users: UserType[];
    reviewers: ReviewerProfile[];
    tracks: Submission[];
}

const SearchBar = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults>({ users: [], reviewers: [], tracks: [] });
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.length >= 2) {
                setIsLoading(true);
                try {
                    const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
                    setResults(res.data);
                    setIsOpen(true);
                } catch (error) {
                    console.error("Search failed", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setResults({ users: [], reviewers: [], tracks: [] });
                setIsOpen(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleNavigate = (path: string) => {
        navigate(path);
        setIsOpen(false);
        setQuery('');
    };

    return (
        <div className="relative w-full max-w-md mx-4" ref={searchRef}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search Users, Reviewers, Tracks..."
                    className="w-full bg-gray-800 text-white pl-10 pr-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                />
                {query && (
                    <button
                        onClick={() => { setQuery(''); setIsOpen(false); }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 text-center text-gray-500">Searching...</div>
                    ) : (
                        <>
                            {results.reviewers.length > 0 && (
                                <div className="p-2">
                                    <h3 className="text-xs uppercase text-gray-500 font-bold px-2 py-1">Reviewers</h3>
                                    {results.reviewers.map(reviewer => (
                                        <div
                                            key={reviewer.id}
                                            onClick={() => handleNavigate(`/reviewer/${reviewer.id}`)}
                                            className="flex items-center p-2 hover:bg-gray-800 rounded-lg cursor-pointer"
                                        >
                                            <Radio className="w-4 h-4 text-red-500 mr-3" />
                                            <div>
                                                <div className="text-sm font-medium">{reviewer.tiktok_handle}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {results.users.length > 0 && (
                                <div className="p-2 border-t border-gray-800">
                                    <h3 className="text-xs uppercase text-gray-500 font-bold px-2 py-1">Users</h3>
                                    {results.users.map(user => (
                                        <div
                                            key={user.id}
                                            onClick={() => handleNavigate('/hub')} // Ideal: /user/{id} but hub is generic
                                            className="flex items-center p-2 hover:bg-gray-800 rounded-lg cursor-pointer"
                                        >
                                            <User className="w-4 h-4 text-blue-500 mr-3" />
                                            <div className="text-sm font-medium">{user.username}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {results.tracks.length > 0 && (
                                <div className="p-2 border-t border-gray-800">
                                    <h3 className="text-xs uppercase text-gray-500 font-bold px-2 py-1">Tracks</h3>
                                    {results.tracks.map(track => (
                                        <div
                                            key={track.id}
                                            onClick={() => handleNavigate(`/submit/${track.reviewer_id}`)} // Navigate to where it was submitted? Or spotlight?
                                            className="flex items-center p-2 hover:bg-gray-800 rounded-lg cursor-pointer"
                                        >
                                            <Music className="w-4 h-4 text-purple-500 mr-3" />
                                            <div className="truncate">
                                                <div className="text-sm font-medium truncate">{track.track_title || 'Untitled'}</div>
                                                <div className="text-xs text-gray-400">{track.artist || 'Unknown Artist'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {results.users.length === 0 && results.reviewers.length === 0 && results.tracks.length === 0 && (
                                <div className="p-4 text-center text-gray-500">No results found.</div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchBar;
