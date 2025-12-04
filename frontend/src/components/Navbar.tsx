import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";

const Navbar = () => {
  // Fix: Ensure type safety for user properties
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isReviewersOpen, setIsReviewersOpen] = useState(false);
  const [isLinesOpen, setIsLinesOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [reviewers, setReviewers] = useState<any[]>([]); // Using any[] temporarily to avoid import issues, but ideally should be ReviewerProfile[]

  const dropdownRef = useRef<HTMLDivElement>(null);
  const reviewersDropdownRef = useRef<HTMLDivElement>(null);
  const linesDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Safely check for admin role, ensuring user and user.roles exist.
  const isAdmin = user?.roles?.includes("admin");

  // Construct Discord Avatar URL
  // Handle both hash (standard) and full URL (legacy/migrated)
  const avatarUrl = user?.avatar?.startsWith("http")
    ? user.avatar
    : (user?.discord_id && user?.avatar
      ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png");

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMobileMenuOpen(false);
  };

  const toggleProfile = () => setIsProfileOpen(!isProfileOpen);
  const toggleReviewers = () => setIsReviewersOpen(!isReviewersOpen);
  const toggleLines = () => setIsLinesOpen(!isLinesOpen);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Fetch reviewers on mount
  useEffect(() => {
    const fetchReviewers = async () => {
      try {
        const { data } = await api.get("/reviewer/all");
        setReviewers(data);
      } catch (error) {
        console.error("Failed to fetch reviewers", error);
      }
    };
    fetchReviewers();
  }, []);

  // Socket Listeners for Live Status
  useEffect(() => {
    if (!socket) return;

    // Join global room for updates
    socket.emit("join_global_room");

    const handleGlobalUpdate = (data: { reviewer_id: number, is_live: boolean }) => {
      setReviewers(prev => prev.map(r =>
        r.id === data.reviewer_id ? { ...r, is_live: data.is_live } : r
      ));
    };

    socket.on("global_reviewer_update", handleGlobalUpdate);

    return () => {
      socket.off("global_reviewer_update", handleGlobalUpdate);
    };
  }, [socket]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (reviewersDropdownRef.current && !reviewersDropdownRef.current.contains(event.target as Node)) {
        setIsReviewersOpen(false);
      }
      if (linesDropdownRef.current && !linesDropdownRef.current.contains(event.target as Node)) {
        setIsLinesOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('.mobile-menu-button')) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="bg-[#140524] border-b border-[#2a0a4a] relative z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/hub" className="text-white text-xl font-bold tracking-tight flex items-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              Universe Bot
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/spotlight" className="text-gray-300 hover:text-white font-medium transition-colors">
              Spotlight
            </Link>

            {/* Lines Dropdown */}
            {user?.is_line_authorized && (
              <div className="relative" ref={linesDropdownRef}>
                <button
                  onClick={toggleLines}
                  className="text-gray-300 hover:text-white focus:outline-none flex items-center gap-1 font-medium transition-colors"
                >
                  Lines
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isLinesOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isLinesOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#140524] border border-[#3d1266] rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn">
                    {reviewers.length > 0 ? (
                      reviewers.map((reviewer) => (
                        <Link
                          key={reviewer.id}
                          to={`/line/${reviewer.tiktok_handle || reviewer.id}`}
                          className="block px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center justify-between group"
                          onClick={() => setIsLinesOpen(false)}
                        >
                          <span className="truncate">
                            {reviewer.tiktok_handle ? `@${reviewer.tiktok_handle}` : reviewer.user?.username || `Reviewer #${reviewer.id}`}
                          </span>
                          {reviewer.is_live && (
                            <span className="flex items-center gap-1.5 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                              </span>
                              <span className="text-[10px] font-bold text-red-500 leading-none">LIVE</span>
                            </span>
                          )}
                        </Link>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-500">No reviewers found</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {user?.reviewer_profile && (
              <Link to="/reviewer/bookmarks" className="text-gray-300 hover:text-white font-medium transition-colors">
                Bookmarks
              </Link>
            )}

            {/* Reviewers Dropdown */}
            <div className="relative" ref={reviewersDropdownRef}>
              <button
                onClick={toggleReviewers}
                className="text-gray-300 hover:text-white focus:outline-none flex items-center gap-1 font-medium transition-colors"
              >
                Reviewers
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isReviewersOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isReviewersOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#140524] border border-[#3d1266] rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn">
                  {reviewers.length > 0 ? (
                    reviewers.map((reviewer) => (
                      <Link
                        key={reviewer.id}
                        to={`/submit/${reviewer.tiktok_handle || reviewer.id}`}
                        className="block px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center justify-between group"
                        onClick={() => setIsReviewersOpen(false)}
                      >
                        <span className="truncate">
                          {reviewer.tiktok_handle ? `@${reviewer.tiktok_handle}` : reviewer.user?.username || `Reviewer #${reviewer.id}`}
                        </span>
                        {reviewer.is_live && (
                          <span className="flex items-center gap-1.5 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                            </span>
                            <span className="text-[10px] font-bold text-red-500 leading-none">LIVE</span>
                          </span>
                        )}
                      </Link>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-sm text-gray-500">No reviewers found</div>
                  )}
                </div>
              )}
            </div>

            <Link to="/hub" className="text-gray-300 hover:text-white font-medium transition-colors">
              Hub
            </Link>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={toggleProfile}
                className="flex items-center gap-2 focus:outline-none ring-2 ring-transparent hover:ring-gray-700 rounded-full transition-all"
              >
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-9 h-9 rounded-full border border-gray-700 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://cdn.discordapp.com/embed/avatars/0.png";
                  }}
                />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#140524] border border-[#3d1266] rounded-lg shadow-xl overflow-hidden animate-fadeIn">
                  <div className="p-4 border-b border-[#2a0a4a] bg-[#1a0b2e]/50">
                    <p className="text-white font-semibold truncate">{user?.username}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Logged in</p>
                  </div>

                  {/* Admin Link */}
                  {isAdmin && (
                    <div className="py-1 border-b border-[#2a0a4a]">
                      <Link
                        to="/admin"
                        className="block px-4 py-2.5 text-sm text-yellow-400 hover:bg-gray-800 hover:text-yellow-300 font-medium transition-colors"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        Admin Dashboard
                      </Link>
                    </div>
                  )}

                  {/* Reviewer Switcher */}
                  {user?.moderated_reviewers && user.moderated_reviewers.length > 0 && (
                    <div className="py-2 border-b border-[#2a0a4a]">
                      <p className="px-4 text-[10px] text-gray-500 uppercase font-bold mb-1 tracking-wider">Switch Dashboard</p>
                      {user.moderated_reviewers.map((reviewer) => (
                        <Link
                          key={reviewer.id}
                          to={`/reviewer/${reviewer.tiktok_handle || reviewer.id}`}
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          {reviewer.tiktok_handle || reviewer.user?.username || `Reviewer #${reviewer.id}`}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* User Settings Link */}
                  <div className="py-1 border-b border-[#2a0a4a]">
                    <Link
                      to="/settings"
                      className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      User Settings
                    </Link>
                  </div>

                  {/* Reviewer Settings Link */}
                  {user?.reviewer_profile && (
                    <div className="py-1 border-b border-[#2a0a4a]">
                      <Link
                        to="/settings/reviewer"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        Reviewer Settings
                      </Link>
                    </div>
                  )}

                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMobileMenu}
              className="mobile-menu-button text-gray-300 hover:text-white focus:outline-none p-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div ref={mobileMenuRef} className="md:hidden absolute top-16 left-0 w-full bg-[#140524] border-b border-[#2a0a4a] shadow-2xl animate-slideDown max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-2 space-y-1">
            {/* User Info Mobile */}
            <div className="flex items-center gap-3 px-3 py-4 border-b border-[#2a0a4a] mb-2">
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-10 h-10 rounded-full border border-gray-700"
              />
              <div>
                <p className="text-white font-semibold">{user?.username}</p>
                <p className="text-xs text-gray-500">Logged in</p>
              </div>
            </div>

            <Link to="/spotlight" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-800">
              Spotlight
            </Link>

            <Link to="/hub" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-800">
              Hub
            </Link>

            {/* Mobile Lines */}
            {user?.is_line_authorized && (
              <div className="space-y-1">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lines</div>
                {reviewers.map(r => (
                  <Link
                    key={r.id}
                    to={`/line/${r.tiktok_handle || r.id}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 pl-6 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 flex items-center justify-between"
                  >
                    <span>{r.tiktok_handle ? `@${r.tiktok_handle}` : `Reviewer #${r.id}`}</span>
                    {r.is_live && (
                      <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">LIVE</span>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {/* Mobile Reviewers */}
            <div className="space-y-1">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reviewers</div>
              {reviewers.map(r => (
                <Link
                  key={r.id}
                  to={`/submit/${r.tiktok_handle || r.id}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 pl-6 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 flex items-center justify-between"
                >
                  <span>{r.tiktok_handle ? `@${r.tiktok_handle}` : `Reviewer #${r.id}`}</span>
                  {r.is_live && (
                    <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">LIVE</span>
                  )}
                </Link>
              ))}
            </div>

            <div className="border-t border-[#2a0a4a] my-2 pt-2">
              {isAdmin && (
                <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-medium text-yellow-400 hover:bg-gray-800">
                  Admin Dashboard
                </Link>
              )}
              <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-800">
                User Settings
              </Link>
              {user?.reviewer_profile && (
                <Link to="/settings/reviewer" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-800">
                  Reviewer Settings
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-3 rounded-md text-base font-medium text-red-400 hover:bg-gray-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
