import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { formatDate, formatMiles } from "../utils";
import FavoriteButton from "./FavoriteButton";
import FormFeedback from "./FormFeedback";
import RiderLink from "./RiderLink";

export default function RouteCard({ route }) {
  const { member } = useAuth();
  const { loadBootstrap } = useClubData();
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isOwner = member?.id === route.createdById;

  async function handleDeleteRoute() {
    const confirmed = window.confirm(
      `Delete "${route.title}"? This removes it from the route board and any group pins.`
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
        <span>{route.terrain}</span>
      </div>
      <h3>{route.title}</h3>
      <p>{route.notes}</p>
      <footer className="story-footer">
        <div className="story-footer__meta">
          <RiderLink riderId={route.createdById} name={route.createdBy} />
          <span>{formatDate(route.createdAt)}</span>
        </div>
        <div className="story-actions">
          <Link className="button button--outline button--sm" to={`/routes/${route.id}/ride`}>
            Ride screen
          </Link>
          {isOwner ? (
            <>
              <Link className="button button--outline button--sm" to={`/routes/${route.id}/edit`}>
                Edit route
              </Link>
              <button
                className="button button--outline button--sm"
                disabled={deleting}
                onClick={() => void handleDeleteRoute()}
                type="button"
              >
                {deleting ? "Deleting..." : "Delete"}
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
