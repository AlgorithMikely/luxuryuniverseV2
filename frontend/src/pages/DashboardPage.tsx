import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const DashboardRedirect = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      // If the user is a reviewer, redirect to their own dashboard.
      if (user.reviewer_profile) {
        navigate(`/dashboard/${user.reviewer_profile.id}`);
      }
      // If the user is an admin and moderates reviewers, redirect to the first one.
      else if (user.roles?.includes('admin') && user.moderated_reviewers && user.moderated_reviewers.length > 0) {
        navigate(`/dashboard/${user.moderated_reviewers[0].id}`);
      }
      // Otherwise, redirect to a general user hub.
      else {
        navigate('/hub');
      }
    }
  }, [user, navigate]);

  // Render a loading state while redirecting
  return <div>Loading dashboard...</div>;
};

export default DashboardRedirect;
