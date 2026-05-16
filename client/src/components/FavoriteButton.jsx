import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

// Toggles a route in the signed-in rider's favorites. Hidden for guests.
export default function FavoriteButton({ routeId }) {
  const { member, updateMember } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!member) {
    return null;
  }

  const isFavorite = (member.favoriteRouteIds ?? []).includes(routeId);

  async function toggle() {
    setBusy(true);

    try {
      const payload = await api.postJson("/api/riders/me/favorites", { routeId });
      updateMember(payload.member);
    } catch {
      // A failed toggle leaves the previous state intact; nothing to undo.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`favorite-button${isFavorite ? " is-favorite" : ""}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={isFavorite}
    >
      {isFavorite ? "★ Favorited" : "☆ Favorite"}
    </button>
  );
}
