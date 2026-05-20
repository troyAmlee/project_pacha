import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import FormFeedback from "../components/FormFeedback";
import LockedNote from "../components/LockedNote";
import RiderAvatar from "../components/RiderAvatar";
import RiderLink from "../components/RiderLink";
import RouteCard from "../components/RouteCard";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { formatMiles, toTitleCase } from "../utils";

export default function GroupDetailPage() {
  const { id } = useParams();
  const { member, updateMember } = useAuth();
  const { data, loading, loadBootstrap } = useClubData();
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [joining, setJoining] = useState(false);
  const [pinning, setPinning] = useState(false);

  const group = data?.groups.find((item) => item.id === id);
  const members = useMemo(() => {
    if (!group || !data) {
      return [];
    }

    return group.memberIds
      .map((memberId) => data.members.find((rider) => rider.id === memberId))
      .filter(Boolean);
  }, [data, group]);
  const pinnedRoutes = useMemo(() => {
    if (!group || !data) {
      return [];
    }

    return group.pinnedRouteIds
      .map((routeId) => data.routes.find((route) => route.id === routeId))
      .filter(Boolean);
  }, [data, group]);
  const availableRoutes = useMemo(() => {
    if (!group || !data) {
      return [];
    }

    return data.routes.filter((route) => !group.pinnedRouteIds.includes(route.id));
  }, [data, group]);

  useEffect(() => {
    if (!selectedRouteId && availableRoutes[0]) {
      setSelectedRouteId(availableRoutes[0].id);
    }
  }, [availableRoutes, selectedRouteId]);

  if (loading || !data) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">North Star Ridebook</p>
        <h1>Loading ride group...</h1>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="app-shell">
        <TopBar minimal />
        <div className="loading-state loading-state--error">
          <p className="loading-kicker">North Star Ridebook</p>
          <h1>That group does not exist.</h1>
          <Link className="button button--primary" to="/groups">
            Back to groups
          </Link>
        </div>
      </div>
    );
  }

  const isMember = member ? group.memberIds.includes(member.id) : false;
  const groupMiles = members.reduce((total, rider) => {
    return total + Number(data.metricsByRider?.[rider.id]?.milesBiked || 0);
  }, 0);

  async function handleJoinGroup() {
    setJoining(true);
    setFeedback(null);

    try {
      const payload = await api.postJson(`/api/groups/${group.id}/join`, {});
      updateMember(payload.member);
      await loadBootstrap();
      setFeedback({ type: "success", message: "You joined the group." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setJoining(false);
    }
  }

  async function handlePinRoute(event) {
    event.preventDefault();
    setPinning(true);
    setFeedback(null);

    try {
      await api.postJson(`/api/groups/${group.id}/routes`, { routeId: selectedRouteId });
      await loadBootstrap();
      setFeedback({ type: "success", message: "Route pinned to the group." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setPinning(false);
    }
  }

  return (
    <div className="app-shell">
      <TopBar minimal />

      <section className="content-section group-detail">
        <div className="section-heading">
          <p className="section-kicker">Group detail</p>
          <h1>{group.name}</h1>
          <p className="groups-page__lead">{group.description}</p>
        </div>

        <div className="ride-screen__stats">
          <div>
            <span className="stat-label">Members</span>
            <strong>{group.memberIds.length}</strong>
          </div>
          <div>
            <span className="stat-label">Pinned routes</span>
            <strong>{group.pinnedRouteIds.length}</strong>
          </div>
          <div>
            <span className="stat-label">Miles logged</span>
            <strong>{formatMiles(groupMiles)}</strong>
          </div>
          <div>
            <span className="stat-label">Founder</span>
            <strong>{group.createdBy}</strong>
          </div>
        </div>

        <div className="group-detail__actions">
          {member ? (
            isMember ? (
              <p className="empty-note">You are already part of this group.</p>
            ) : (
              <button
                className="button button--primary"
                disabled={joining}
                onClick={() => void handleJoinGroup()}
                type="button"
              >
                {joining ? "Joining..." : "Join group"}
              </button>
            )
          ) : (
            <LockedNote action="join this ride group" />
          )}

          {member && isMember && availableRoutes.length ? (
            <form className="editor editor--warm group-detail__pin-form" onSubmit={handlePinRoute}>
              <label>
                Pin a route for the group
                <select onChange={(event) => setSelectedRouteId(event.target.value)} value={selectedRouteId}>
                  {availableRoutes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button--primary button--sm" disabled={pinning} type="submit">
                {pinning ? "Pinning..." : "Pin route"}
              </button>
            </form>
          ) : null}
        </div>

        <FormFeedback feedback={feedback} />
      </section>

      <main className="workspace">
        <section className="content-section">
          <div className="section-heading">
            <p className="section-kicker">Member roster</p>
            <h2>The riders currently in this group.</h2>
          </div>
          <div className="member-rail">
            {members.map((rider) => (
              <article className="member-chip" key={rider.id}>
                <RiderAvatar className="member-avatar" rider={rider} />
                <div>
                  <h3>
                    <RiderLink name={rider.name} riderId={rider.id} />
                  </h3>
                  <p>
                    {rider.neighborhood} - {toTitleCase(rider.pace)} pace
                  </p>
                  <span>{rider.bio}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <p className="section-kicker">Pinned routes</p>
            <h2>Routes this crew keeps ready for ride day.</h2>
          </div>
          {pinnedRoutes.length ? (
            <div className="stack-list">
              {pinnedRoutes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          ) : (
            <p className="empty-note">No routes have been pinned yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
