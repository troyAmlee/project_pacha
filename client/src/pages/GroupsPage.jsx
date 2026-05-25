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
import { useTranslation } from "../i18n";
import { formatMiles } from "../utils";

const emptyForm = {
  name: "",
  description: ""
};

export default function GroupsPage() {
  const navigate = useNavigate();
  const { member, updateMember } = useAuth();
  const { data, loading, loadBootstrap } = useClubData();
  const { t } = useTranslation();
  const { values, handleChange, reset } = useForm(emptyForm);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [joiningGroupId, setJoiningGroupId] = useState("");

  if (loading || !data) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">Xxica</p>
        <h1>{t("groups.loading")}</h1>
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
      setFeedback({ type: "success", message: t("groups.joinedSuccess") });
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
          <p className="section-kicker">{t("groups.kicker")}</p>
          <h1>{t("groups.pageTitle")}</h1>
          <p className="groups-page__lead">{t("groups.pageLead")}</p>
        </div>

        <div className="section-body section-body--split">
          {member ? (
            <form className="editor editor--warm" onSubmit={handleCreateGroup}>
              <label>
                {t("groups.createGroupName")}
                <input
                  name="name"
                  onChange={handleChange}
                  placeholder={t("groups.createGroupNamePlaceholder")}
                  required
                  value={values.name}
                />
              </label>
              <label>
                {t("groups.createDescription")}
                <textarea
                  name="description"
                  onChange={handleChange}
                  placeholder={t("groups.createDescriptionPlaceholder")}
                  rows="5"
                  value={values.description}
                />
              </label>
              <button className="button button--primary" disabled={busy} type="submit">
                {busy ? t("groups.createBusy") : t("groups.createSubmit")}
              </button>
              <FormFeedback feedback={feedback} />
            </form>
          ) : (
            <LockedNote action="locked.actionCreateGroup" />
          )}

          <div className="group-grid">
            {data.groups.map((group) => {
              const isMember = member ? group.memberIds.includes(member.id) : false;
              const groupMiles = group.memberIds.reduce((total, memberId) => {
                return total + Number(data.metricsByRider?.[memberId]?.milesBiked || 0);
              }, 0);

              return (
                <article className="group-card" key={group.id}>
                  <p className="group-card__eyebrow">{t("groups.countRiders", { count: group.memberIds.length })}</p>
                  <h3>{group.name}</h3>
                  <p className="group-card__summary">{group.description}</p>
                  <div className="group-card__meta">
                    <span>{t("groups.pinnedRoutes", { count: group.pinnedRouteIds.length })}</span>
                    <span>{t("groups.milesLogged", { miles: formatMiles(groupMiles) })}</span>
                  </div>
                  <p className="group-card__creator">
                    {t("groups.startedBy")}{" "}
                    <RiderLink name={group.createdBy} riderId={group.createdById} />
                  </p>
                  <div className="group-card__actions">
                    <Link className="button button--outline button--sm" to={`/groups/${group.id}`}>
                      {t("groups.viewGroup")}
                    </Link>
                    {member && !isMember ? (
                      <button
                        className="button button--primary button--sm"
                        disabled={joiningGroupId === group.id}
                        onClick={() => void handleJoinGroup(group.id)}
                        type="button"
                      >
                        {joiningGroupId === group.id ? t("groups.joining") : t("groups.join")}
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
