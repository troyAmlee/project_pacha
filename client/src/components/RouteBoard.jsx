import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import LockedNote from "./LockedNote";
import RouteCard from "./RouteCard";
import SuggestedRoutes from "./SuggestedRoutes";

export default function RouteBoard() {
  const { member } = useAuth();
  const { data } = useClubData();

  return (
    <section className="content-section content-section--split" id="routes">
      <div className="section-heading">
        <p className="section-kicker">Route board</p>
        <h2>Share the loops people actually ride, not just the ones on a brochure map.</h2>
        <p>
          Routes now carry geometry, so riders can save a line, open it later in the ride screen,
          and follow it with live GPS.
        </p>
      </div>

      <div className="section-body section-body--split">
        <div className="route-workbench">
          {member ? (
            <div className="editor editor--cool">
              <h3>Build routes with geometry.</h3>
              <p>
                Draw a route point by point or capture one live with GPS. Every saved route can
                open in the ride screen later with the line and Greenway guide intact.
              </p>
              <div className="locked-note__actions">
                <Link className="button button--primary" to="/routes/new">
                  Open route builder
                </Link>
                <Link className="button button--outline" to="/groups">
                  See groups
                </Link>
              </div>
            </div>
          ) : (
            <LockedNote action="share a route with map geometry" />
          )}

          <SuggestedRoutes
            description="These are the best routes to load first if you are new to the board or just want a dependable ride."
            member={member}
            routes={data.routes}
            title="Club picks"
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
