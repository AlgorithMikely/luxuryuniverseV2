import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const Navbar = () => {
  const { user, logout } = useAuthStore();
  // Safely check for admin role, ensuring user and user.roles exist.
  const isAdmin = user?.roles?.includes("admin");
  const isReviewer = user?.reviewer_profile;

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
          {isReviewer && (
            <Link
              to={`/dashboard/${user?.reviewer_profile?.id}`}
              className="text-gray-300 hover:text-white"
            >
              Reviewer Dashboard
            </Link>
          )}
          <Link to="/dashboard" className="text-gray-300 hover:text-white">
            Dashboard
          </Link>
          <Link to="/hub" className="text-gray-300 hover:text-white">
            Hub
          </Link>
          <button onClick={logout} className="btn bg-purple-600 p-2 rounded">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
