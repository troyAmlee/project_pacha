import { Link, useLocation } from "react-router-dom";
import GroupHighlights from "../components/GroupHighlights";
import Journal from "../components/Journal";
import MemberRoster from "../components/MemberRoster";
import PhotoWall from "../components/PhotoWall";
import RouteBoard from "../components/RouteBoard";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { formatMiles } from "../utils";

export default function HomePage() {
  const location = useLocation();
  const { member } = useAuth();
  const { data, loading, error, loadBootstrap } = useClubData();

  if (loading) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">North Star Ridebook</p>
        <h1>Loading the Minneapolis ride board...</h1>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="loading-state loading-state--error">
        <p className="loading-kicker">North Star Ridebook</p>
        <h1>Club data is unavailable.</h1>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <button className="button button--primary" onClick={() => void loadBootstrap()}>
          Retry
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
          <p className="eyebrow">Bike club workspace</p>
          <h1>Routes, ride photos, groups, and a shared journal for Minneapolis riders.</h1>
          <p className="hero-summary">
            The board now runs as an actual club tool: riders join the community, save route lines
            with geometry, organize into groups, and open a live ride screen when it is time to
            follow the route.
          </p>
          <div className="hero-actions">
            {member ? (
              <Link className="button button--primary" to="/routes/new">
                Build a route
              </Link>
            ) : (
              <a className="button button--primary" href="#join">
                Join the club
              </a>
            )}
            <a className="button button--ghost" href="#routes">
              Browse route board
            </a>
          </div>
        </div>

        <div className="route-poster" aria-hidden="true">
          <div className="route-orbit route-orbit--one" />
          <div className="route-orbit route-orbit--two" />
          <div className="route-orbit route-orbit--three" />
          <div className="route-pin route-pin--one">River loop</div>
          <div className="route-pin route-pin--two">Greenway</div>
          <div className="route-pin route-pin--three">Northside</div>
        </div>
      </section>

      <section className="stats-band" aria-label="Club stats">
        <div>
          <span className="stat-label">Members</span>
          <strong>{data.stats.memberCount}</strong>
        </div>
        <div>
          <span className="stat-label">Shared miles</span>
          <strong>{formatMiles(data.stats.milesShared)}</strong>
        </div>
        <div>
          <span className="stat-label">Ride groups</span>
          <strong>{data.stats.groupCount}</strong>
        </div>
        <div>
          <span className="stat-label">Logged rides</span>
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
