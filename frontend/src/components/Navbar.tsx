import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const Navbar = () => {
  const { user, logout } = useAuthStore();

  const handleSpotifyLogin = () => {
    // Redirect to backend endpoint that starts the Spotify OAuth flow
    window.location.href = '/api/spotify/login';
  };
  // Safely check for admin role, ensuring user and user.roles exist.
  const isAdmin = user?.roles?.includes("admin");

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
              <button onClick={handleSpotifyLogin} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                Login with Spotify
              </button>
          <button onClick={logout} className="btn bg-purple-600 p-2 rounded">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
