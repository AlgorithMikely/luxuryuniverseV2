import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import api from "../services/api";

const Navbar = () => {
  // Fix: Ensure type safety for user properties
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isReviewersOpen, setIsReviewersOpen] = useState(false);
  const [isLinesOpen, setIsLinesOpen] = useState(false);
  const [reviewers, setReviewers] = useState<any[]>([]); // Using any[] temporarily to avoid import issues, but ideally should be ReviewerProfile[]
  const dropdownRef = useRef<HTMLDivElement>(null);
  const reviewersDropdownRef = useRef<HTMLDivElement>(null);
  const linesDropdownRef = useRef<HTMLDivElement>(null);

  // Safely check for admin role, ensuring user and user.roles exist.
  const isAdmin = user?.roles?.includes("admin");

  // Construct Discord Avatar URL
  // Format: https://cdn.discordapp.com/avatars/{user_id}/{user_avatar}.png
  // Since we don't have the hash in the User type yet, we'll use a default or try to fetch it if available in future.
  const avatarUrl = user?.discord_id && user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleProfile = () => setIsProfileOpen(!isProfileOpen);
  const toggleReviewers = () => setIsReviewersOpen(!isReviewersOpen);
  const toggleLines = () => setIsLinesOpen(!isLinesOpen);

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
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="bg-gray-800 p-4 relative z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/hub" className="text-white text-lg font-bold">
          Universe Bot
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/spotlight" className="text-gray-300 hover:text-white font-medium">
            Spotlight
          </Link>

          {/* Lines Dropdown */}
          {user?.is_line_authorized && (
            <div className="relative" ref={linesDropdownRef}>
              <button
                onClick={toggleLines}
                className="text-gray-300 hover:text-white focus:outline-none flex items-center gap-1 font-medium"
              >
                Lines
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isLinesOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isLinesOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
                  {reviewers.length > 0 ? (
                    reviewers.map((reviewer) => (
                      <Link
                        key={reviewer.id}
                        to={`/line/${reviewer.tiktok_handle || reviewer.id}`}
                        className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                        onClick={() => setIsLinesOpen(false)}
                      >
                        {reviewer.tiktok_handle ? `@${reviewer.tiktok_handle}` : reviewer.user?.username || `Reviewer #${reviewer.id}`}
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
            <Link to="/reviewer/bookmarks" className="text-gray-300 hover:text-white font-medium">
              Bookmarks
            </Link>
          )}

          {/* Reviewers Dropdown */}
          <div className="relative" ref={reviewersDropdownRef}>
            <button
              onClick={toggleReviewers}
              className="text-gray-300 hover:text-white focus:outline-none flex items-center gap-1"
            >
              Reviewers
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isReviewersOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isReviewersOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
                {reviewers.length > 0 ? (
                  reviewers.map((reviewer) => (
                    <Link
                      key={reviewer.id}
                      to={`/submit/${reviewer.tiktok_handle || reviewer.id}`}
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                      onClick={() => setIsReviewersOpen(false)}
                    >
                      {reviewer.tiktok_handle ? `@${reviewer.tiktok_handle}` : reviewer.user?.username || `Reviewer #${reviewer.id}`}
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-gray-500">No reviewers found</div>
                )}
              </div>
            )}
          </div>

          <Link to="/hub" className="text-gray-300 hover:text-white">
            Hub
          </Link>

          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={toggleProfile}
              className="flex items-center gap-2 focus:outline-none"
            >
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-8 h-8 rounded-full border border-gray-600"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://cdn.discordapp.com/embed/avatars/0.png";
                }}
              />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                <div className="p-3 border-b border-gray-800">
                  <p className="text-white font-semibold truncate">{user?.username}</p>
                  <p className="text-xs text-gray-500">Logged in</p>
                </div>

                {/* Admin Link */}
                {isAdmin && (
                  <div className="py-1 border-b border-gray-800">
                    <Link
                      to="/admin"
                      className="block px-4 py-2 text-sm text-yellow-400 hover:bg-gray-800 hover:text-yellow-300 font-medium"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      Admin Dashboard
                    </Link>
                  </div>
                )}

                {/* Reviewer Switcher */}
                {user?.moderated_reviewers && user.moderated_reviewers.length > 0 && (
                  <div className="py-2 border-b border-gray-800">
                    <p className="px-3 text-xs text-gray-500 uppercase font-bold mb-1">Switch Dashboard</p>
                    {user.moderated_reviewers.map((reviewer) => (
                      <Link
                        key={reviewer.id}
                        to={`/reviewer/${reviewer.tiktok_handle || reviewer.id}`}
                        className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        {reviewer.tiktok_handle || reviewer.user?.username || `Reviewer #${reviewer.id}`}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Reviewer Settings Link */}
                {user?.reviewer_profile && (
                  <div className="py-1 border-b border-gray-800">
                    <Link
                      to="/settings/reviewer"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      Reviewer Settings
                    </Link>
                  </div>
                )}

                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
