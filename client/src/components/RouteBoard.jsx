import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useTranslation } from "../i18n";
import LockedNote from "./LockedNote";
import RouteCard from "./RouteCard";
import SuggestedRoutes from "./SuggestedRoutes";

export default function RouteBoard() {
  const { member } = useAuth();
  const { data } = useClubData();
  const { t } = useTranslation();

  return (
    <section className="content-section content-section--split" id="routes">
      <div className="section-heading">
        <p className="section-kicker">{t("home.routeBoardKicker")}</p>
        <h2>{t("home.routeBoardTitle")}</h2>
        <p>{t("home.routeBoardLead")}</p>
      </div>

      <div className="section-body section-body--split">
        <div className="route-workbench">
          {member ? (
            <div className="editor editor--cool">
              <h3>{t("home.routeBuildHeading")}</h3>
              <p>{t("home.routeBuildBody")}</p>
              <div className="locked-note__actions">
                <Link className="button button--primary" to="/routes/new">
                  {t("home.routeBuildCta")}
                </Link>
                <Link className="button button--outline" to="/groups">
                  {t("home.routeBuildSeeGroups")}
                </Link>
              </div>
            </div>
          ) : (
            <LockedNote action="locked.actionShareRoute" />
          )}

          <SuggestedRoutes
            description={t("home.suggestedClubDescription")}
            member={member}
            routes={data.routes}
            title={t("home.suggestedClubTitle")}
          />
        </div>

        <div className="stack-list">
          {data.routes.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      </div>
    </section>
  );
}
