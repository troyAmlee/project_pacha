import { Link } from "react-router-dom";
import { useClubData } from "../context/ClubDataContext";
import { formatMiles } from "../utils";
import RiderLink from "./RiderLink";

export default function GroupHighlights() {
  const { data } = useClubData();
  const groups = data.groups.slice(0, 3);

  return (
    <section className="content-section" id="groups">
      <div className="section-heading section-heading--row">
        <div>
          <p className="section-kicker">Ride groups</p>
          <h2>Small crews can pin routes, gather members, and launch rides together.</h2>
          <p>
            Groups turn the app from a shared board into a real club structure: recurring crews,
            pinned routes, and ride screens that open from the same page.
          </p>
        </div>
        <Link className="button button--outline" to="/groups">
          Browse all groups
        </Link>
      </div>

      <div className="group-grid">
        {groups.map((group) => (
          <article className="group-card" key={group.id}>
            <p className="group-card__eyebrow">Pinned routes {group.pinnedRouteIds.length}</p>
            <h3>{group.name}</h3>
            <p className="group-card__summary">{group.description}</p>
            <div className="group-card__meta">
              <span>{group.memberIds.length} riders</span>
              <span>{formatMiles(sumGroupMiles(data.metricsByRider, group.memberIds))} logged</span>
            </div>
            <p className="group-card__creator">
              Started by <RiderLink name={group.createdBy} riderId={group.createdById} />
            </p>
            <Link className="button button--primary button--sm" to={`/groups/${group.id}`}>
              Open group
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
