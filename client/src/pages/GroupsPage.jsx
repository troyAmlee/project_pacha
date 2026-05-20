import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import FormFeedback from "../components/FormFeedback";
import LockedNote from "../components/LockedNote";
import RiderLink from "../components/RiderLink";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useForm } from "../hooks/useForm";
import { formatMiles } from "../utils";

const emptyForm = {
  name: "",
  description: ""
};

export default function GroupsPage() {
  const navigate = useNavigate();
  const { member, updateMember } = useAuth();
  const { data, loading, loadBootstrap } = useClubData();
  const { values, handleChange, reset } = useForm(emptyForm);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [joiningGroupId, setJoiningGroupId] = useState("");

  if (loading || !data) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">North Star Ridebook</p>
        <h1>Loading ride groups...</h1>
      </div>
    );
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const payload = await api.postJson("/api/groups", values);
      updateMember(payload.member);
      reset();
      await loadBootstrap();
      navigate(`/groups/${payload.group.id}`);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinGroup(groupId) {
    setJoiningGroupId(groupId);
    setFeedback(null);

    try {
      const payload = await api.postJson(`/api/groups/${groupId}/join`, {});
      updateMember(payload.member);
      await loadBootstrap();
      setFeedback({ type: "success", message: "You joined the group." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setJoiningGroupId("");
    }
  }

  return (
    <div className="app-shell">
      <TopBar minimal />

      <section className="content-section">
        <div className="section-heading">
          <p className="section-kicker">Bike club groups</p>
          <h1>Organize recurring crews, pin trusted routes, and launch ride screens from one place.</h1>
          <p className="groups-page__lead">
            Groups give the club a structure beyond the shared feed: each one has its own roster,
            saved routes, and a simple join flow.
          </p>
        </div>

        <div className="section-body section-body--split">
          {member ? (
            <form className="editor editor--warm" onSubmit={handleCreateGroup}>
              <label>
                Group name
                <input
                  name="name"
                  onChange={handleChange}
                  placeholder="River Dawns"
                  required
                  value={values.name}
                />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  onChange={handleChange}
                  placeholder="Who the group is for, what pace it likes, and what kind of routes it pins."
                  rows="5"
                  value={values.description}
                />
              </label>
              <button className="button button--primary" disabled={busy} type="submit">
                {busy ? "Creating group..." : "Create group"}
              </button>
              <FormFeedback feedback={feedback} />
            </form>
          ) : (
            <LockedNote action="create or join a ride group" />
          )}

          <div className="group-grid">
            {data.groups.map((group) => {
              const isMember = member ? group.memberIds.includes(member.id) : false;
              const groupMiles = group.memberIds.reduce((total, memberId) => {
                return total + Number(data.metricsByRider?.[memberId]?.milesBiked || 0);
              }, 0);

              return (
                <article className="group-card" key={group.id}>
                  <p className="group-card__eyebrow">{group.memberIds.length} riders</p>
                  <h3>{group.name}</h3>
                  <p className="group-card__summary">{group.description}</p>
                  <div className="group-card__meta">
                    <span>{group.pinnedRouteIds.length} pinned routes</span>
                    <span>{formatMiles(groupMiles)} logged</span>
                  </div>
                  <p className="group-card__creator">
                    Started by <RiderLink name={group.createdBy} riderId={group.createdById} />
                  </p>
                  <div className="group-card__actions">
                    <Link className="button button--outline button--sm" to={`/groups/${group.id}`}>
                      View group
                    </Link>
                    {member && !isMember ? (
                      <button
                        className="button button--primary button--sm"
                        disabled={joiningGroupId === group.id}
                        onClick={() => void handleJoinGroup(group.id)}
                        type="button"
                      >
                        {joiningGroupId === group.id ? "Joining..." : "Join"}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
