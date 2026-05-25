import { Link, useLocation } from "react-router-dom";
import GroupHighlights from "../components/GroupHighlights";
import Journal from "../components/Journal";
import MemberRoster from "../components/MemberRoster";
import PhotoWall from "../components/PhotoWall";
import RouteBoard from "../components/RouteBoard";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useTranslation } from "../i18n";
import { formatMiles } from "../utils";

export default function HomePage() {
  const location = useLocation();
  const { member } = useAuth();
  const { data, loading, error, loadBootstrap } = useClubData();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">Xxica</p>
        <h1>{t("home.loadingBoard")}</h1>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="loading-state loading-state--error">
        <p className="loading-kicker">Xxica</p>
        <h1>{t("home.dataUnavailable")}</h1>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <button className="button button--primary" onClick={() => void loadBootstrap()}>
          {t("common.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopBar />

      {location.state?.success ? (
        <div className="feedback-strip">
          <p className="feedback feedback--success">{location.state.success}</p>
        </div>
      ) : null}

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">{t("home.heroEyebrow")}</p>
          <h1>{t("home.heroTitle")}</h1>
          <p className="hero-summary">{t("home.heroSummary")}</p>
          <div className="hero-actions">
            {member ? (
              <Link className="button button--primary" to="/routes/new">
                {t("home.heroCtaBuildRoute")}
              </Link>
            ) : (
              <a className="button button--primary" href="#join">
                {t("home.heroCtaJoin")}
              </a>
            )}
            <a className="button button--ghost" href="#routes">
              {t("home.heroCtaBrowse")}
            </a>
          </div>
        </div>

        <div className="route-poster" aria-hidden="true">
          <div className="route-orbit route-orbit--one" />
          <div className="route-orbit route-orbit--two" />
          <div className="route-orbit route-orbit--three" />
          <div className="route-pin route-pin--one">{t("home.heroPinRiver")}</div>
          <div className="route-pin route-pin--two">{t("home.heroPinGreenway")}</div>
          <div className="route-pin route-pin--three">{t("home.heroPinNorthside")}</div>
        </div>
      </section>

      <section className="stats-band" aria-label="Club stats">
        <div>
          <span className="stat-label">{t("home.statMembers")}</span>
          <strong>{data.stats.memberCount}</strong>
        </div>
        <div>
          <span className="stat-label">{t("home.statSharedMiles")}</span>
          <strong>{formatMiles(data.stats.milesShared)}</strong>
        </div>
        <div>
          <span className="stat-label">{t("home.statGroups")}</span>
          <strong>{data.stats.groupCount}</strong>
        </div>
        <div>
          <span className="stat-label">{t("home.statRides")}</span>
          <strong>{data.stats.rideCount}</strong>
        </div>
      </section>

      <main className="workspace">
        <MemberRoster />
        <RouteBoard />
        <GroupHighlights />
        <PhotoWall />
        <Journal />
      </main>
    </div>
  );
}
