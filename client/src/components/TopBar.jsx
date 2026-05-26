import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddressSearch from "./AddressSearch";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../i18n";
import LanguageToggle from "./LanguageToggle";
import PapelPicado from "./PapelPicado";

export default function TopBar({ minimal = false }) {
  const { member, logout } = useAuth();
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Close both sheets on route change-ish events (keyboard escape, browser back).
  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function handleAddressSelect(result) {
    if (!result?.point) return;
    setSearchOpen(false);
    setMenuOpen(false);
    const [lat, lng] = result.point;
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      label: result.primary ?? ""
    });
    navigate(`/ride/to?${params.toString()}`);
  }

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
          <>
            {/* Desktop inline search */}
            <div className="topbar-search topbar-search--inline">
              <AddressSearch
                language={lang}
                onSelectResult={handleAddressSelect}
                placeholder={t("topbar.searchPlaceholder")}
                showModeToggle={false}
              />
            </div>

            <nav className="topbar-nav" aria-label="Primary">
              <a href="#join">{t("topbar.navRoster")}</a>
              <a href="#routes">{t("topbar.navRoutes")}</a>
              <Link to="/groups">{t("topbar.navGroups")}</Link>
              <a href="#photos">{t("topbar.navPhotos")}</a>
              <a href="#journal">{t("topbar.navJournal")}</a>
            </nav>
          </>
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

        {minimal ? null : (
          <>
            <button
              type="button"
              className="topbar-icon-button topbar-icon-button--search"
              aria-label={t("topbar.searchOpen")}
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((current) => !current);
                setMenuOpen(false);
              }}
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              className="topbar-icon-button topbar-icon-button--menu"
              aria-label={menuOpen ? t("topbar.menuClose") : t("topbar.menuOpen")}
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((current) => !current);
                setSearchOpen(false);
              }}
            >
              {menuOpen ? <CloseIcon /> : <BurgerIcon />}
            </button>
          </>
        )}
      </header>

      {!minimal && searchOpen ? (
        <div className="topbar-search-sheet">
          <AddressSearch
            language={lang}
            onSelectResult={handleAddressSelect}
            placeholder={t("topbar.searchPlaceholder")}
            showModeToggle={false}
            autoFocus
          />
          <button
            type="button"
            className="button button--ghost button--sm topbar-search-sheet__close"
            onClick={() => setSearchOpen(false)}
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : null}

      {!minimal && menuOpen ? (
        <div className="topbar-menu-sheet" role="dialog" aria-label={t("topbar.menuLabel")}>
          <nav className="topbar-menu-sheet__nav" aria-label="Primary">
            <a href="#join" onClick={() => setMenuOpen(false)}>{t("topbar.navRoster")}</a>
            <a href="#routes" onClick={() => setMenuOpen(false)}>{t("topbar.navRoutes")}</a>
            <Link to="/groups" onClick={() => setMenuOpen(false)}>{t("topbar.navGroups")}</Link>
            <a href="#photos" onClick={() => setMenuOpen(false)}>{t("topbar.navPhotos")}</a>
            <a href="#journal" onClick={() => setMenuOpen(false)}>{t("topbar.navJournal")}</a>
          </nav>
          <div className="topbar-menu-sheet__auth">
            {member ? (
              <>
                <Link
                  className="button button--outline button--sm"
                  to="/routes/new"
                  onClick={() => setMenuOpen(false)}
                >
                  {t("common.newRoute")}
                </Link>
                <Link
                  className="button button--ghost button--sm"
                  to={`/riders/${member.id}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {member.name}
                </Link>
                <button
                  className="button button--outline button--sm"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                >
                  {t("common.logOut")}
                </button>
              </>
            ) : (
              <>
                <Link
                  className="button button--outline button--sm"
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                >
                  {t("common.logIn")}
                </Link>
                <Link
                  className="button button--primary button--sm"
                  to="/signup"
                  onClick={() => setMenuOpen(false)}
                >
                  {t("common.signUp")}
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}

      <PapelPicado />
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="16" x2="20.5" y2="20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BurgerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
