import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../i18n";
import LanguageToggle from "./LanguageToggle";
import PapelPicado from "./PapelPicado";

export default function TopBar({ minimal = false }) {
  const { member, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <>
      <header className="topbar">
        <div className="topbar-brand">
          <p className="topbar-kicker">{t("topbar.kicker")}</p>
          <Link className="brandmark" to="/">
            Xxica
          </Link>
        </div>

        {minimal ? null : (
          <nav className="topbar-nav" aria-label="Primary">
            <a href="#join">{t("topbar.navRoster")}</a>
            <a href="#routes">{t("topbar.navRoutes")}</a>
            <Link to="/groups">{t("topbar.navGroups")}</Link>
            <a href="#photos">{t("topbar.navPhotos")}</a>
            <a href="#journal">{t("topbar.navJournal")}</a>
          </nav>
        )}

        <div className="topbar-auth">
          <LanguageToggle />
          {member ? (
            <>
              <Link className="button button--outline button--sm" to="/routes/new">
                {t("common.newRoute")}
              </Link>
              <Link className="topbar-rider" to={`/riders/${member.id}`}>
                {member.name}
              </Link>
              <button
                className="button button--outline button--sm"
                type="button"
                onClick={() => void logout()}
              >
                {t("common.logOut")}
              </button>
            </>
          ) : (
            <>
              <Link className="button button--outline button--sm" to="/login">
                {t("common.logIn")}
              </Link>
              <Link className="button button--primary button--sm" to="/signup">
                {t("common.signUp")}
              </Link>
            </>
          )}
        </div>
      </header>
      <PapelPicado />
    </>
  );
}
