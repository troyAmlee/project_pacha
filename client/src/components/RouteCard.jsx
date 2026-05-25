import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useTranslation } from "../i18n";
import { formatDate, formatMiles } from "../utils";
import FavoriteButton from "./FavoriteButton";
import FormFeedback from "./FormFeedback";
import RiderLink from "./RiderLink";

export default function RouteCard({ route }) {
  const { member } = useAuth();
  const { loadBootstrap } = useClubData();
  const { t, lang } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isOwner = member?.id === route.createdById;
  const terrainLabel = t(`terrain.${route.terrain}`) || route.terrain;

  async function handleDeleteRoute() {
    const confirmed = window.confirm(
      t("rideScreen.confirmDelete", { title: route.title })
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFeedback(null);

    try {
      await api.delete(`/api/routes/${route.id}`);
      await loadBootstrap();
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="story-row">
      <div className="story-meta">
        <span>{formatMiles(route.distanceMiles)}</span>
        <span>{route.start}</span>
        <span>{terrainLabel}</span>
      </div>
      <h3>{route.title}</h3>
      <p>{route.notes}</p>
      <footer className="story-footer">
        <div className="story-footer__meta">
          <RiderLink riderId={route.createdById} name={route.createdBy} />
          <span>{formatDate(route.createdAt, lang)}</span>
        </div>
        <div className="story-actions">
          <Link className="button button--outline button--sm" to={`/routes/${route.id}/ride`}>
            {t("routeCard.viewRoute")}
          </Link>
          {isOwner ? (
            <>
              <Link className="button button--outline button--sm" to={`/routes/${route.id}/edit`}>
                {t("routeCard.editRoute")}
              </Link>
              <button
                className="button button--outline button--sm"
                disabled={deleting}
                onClick={() => void handleDeleteRoute()}
                type="button"
              >
                {deleting ? t("routeBuilder.deletingRoute") : t("common.delete")}
              </button>
            </>
          ) : null}
          <FavoriteButton routeId={route.id} />
        </div>
      </footer>
      <FormFeedback feedback={feedback} />
    </article>
  );
}
