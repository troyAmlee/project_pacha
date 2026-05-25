import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../i18n";

export default function RequireAuth({ children }) {
  const { member, loading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">Xxica</p>
        <h1>{t("auth.checkingSession")}</h1>
      </div>
    );
  }

  if (!member) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
