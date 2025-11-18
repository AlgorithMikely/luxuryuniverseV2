import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const DashboardRedirect = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    // Wait for the user loading to be complete before attempting a redirect.
    if (isLoading) {
      return;
    }

    if (user) {
      if (user.roles?.includes('admin') && user.moderated_reviewers && user.moderated_reviewers.length > 0) {
        navigate(`/reviewer/${user.moderated_reviewers[0].id}`);
      } else if (user.reviewer_profile) {
        navigate(`/reviewer/${user.reviewer_profile.id}`);
      } else {
        navigate('/hub');
      }
    } else {
      // If there's no user and we're not loading, they need to log in.
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // Render a loading state while the user data is being fetched.
  return <div>Loading dashboard...</div>;
};

export default DashboardRedirect;
