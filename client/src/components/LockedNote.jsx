import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";

export default function LockedNote({ action }) {
  const { t } = useTranslation();
  const actionText = action.startsWith("locked.") ? t(action) : action;

  return (
    <div className="locked-note">
      <p className="locked-note__lead">{t("locked.lead", { action: actionText })}</p>
      <p>{t("locked.body")}</p>
      <div className="locked-note__actions">
        <Link className="button button--primary" to="/login">
          {t("common.logIn")}
        </Link>
        <Link className="button button--outline" to="/signup">
          {t("common.createAccount")}
        </Link>
      </div>
    </div>
  );
}
