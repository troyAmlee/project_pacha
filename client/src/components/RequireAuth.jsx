import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Route guard for pages that need a signed-in rider (rider profiles, the ride
// screen, group management — added in later phases).
export default function RequireAuth({ children }) {
  const { member, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">North Star Ridebook</p>
        <h1>Checking your session...</h1>
      </div>
    );
  }

  if (!member) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
