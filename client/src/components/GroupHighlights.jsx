import { Link } from "react-router-dom";
import { useClubData } from "../context/ClubDataContext";
import { useTranslation } from "../i18n";
import { formatMiles } from "../utils";
import RiderLink from "./RiderLink";

export default function GroupHighlights() {
  const { data } = useClubData();
  const { t } = useTranslation();
  const groups = data.groups.slice(0, 3);

  return (
    <section className="content-section" id="groups">
      <div className="section-heading section-heading--row">
        <div>
          <p className="section-kicker">{t("home.groupsKicker")}</p>
          <h2>{t("home.groupsTitle")}</h2>
          <p>{t("home.groupsLead")}</p>
        </div>
        <Link className="button button--outline" to="/groups">
          {t("home.groupsViewAll")}
        </Link>
      </div>

      <div className="group-grid">
        {groups.map((group) => (
          <article className="group-card" key={group.id}>
            <p className="group-card__eyebrow">
              {t("home.groupsCardPinned", { count: group.pinnedRouteIds.length })}
            </p>
            <h3>{group.name}</h3>
            <p className="group-card__summary">{group.description}</p>
            <div className="group-card__meta">
              <span>{t("home.groupsCardRiders", { count: group.memberIds.length })}</span>
              <span>
                {t("home.groupsCardMiles", {
                  miles: formatMiles(sumGroupMiles(data.metricsByRider, group.memberIds))
                })}
              </span>
            </div>
            <p className="group-card__creator">
              {t("home.groupsCardStartedBy")}{" "}
              <RiderLink name={group.createdBy} riderId={group.createdById} />
            </p>
            <Link className="button button--primary button--sm" to={`/groups/${group.id}`}>
              {t("home.groupsCardOpen")}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function sumGroupMiles(metricsByRider, memberIds) {
  return memberIds.reduce((total, memberId) => {
    return total + Number(metricsByRider?.[memberId]?.milesBiked || 0);
  }, 0);
}
