import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const Navbar = () => {
  const { user, logout, spotify_connected } = useAuthStore();
  const isAdmin = user?.roles?.includes("admin");

  const handleSpotifyLogin = () => {
    // Redirect to the backend endpoint that initiates the Spotify OAuth flow
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/spotify/login`;
  };

  return (
    <nav className="bg-gray-800 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/hub" className="text-white text-lg font-bold">
          Universe Bot
        </Link>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link to="/admin" className="text-gray-300 hover:text-white">
              Admin
            </Link>
          )}
          <Link to="/hub" className="text-gray-300 hover:text-white">
            Hub
          </Link>
          {user && !spotify_connected && (
            <button onClick={handleSpotifyLogin} className="btn bg-green-500 p-2 rounded">
              Login with Spotify
            </button>
          )}
          <button onClick={logout} className="btn bg-purple-600 p-2 rounded">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
