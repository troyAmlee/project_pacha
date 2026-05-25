import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../i18n";

export default function FavoriteButton({ routeId }) {
  const { member, updateMember } = useAuth();
  const { t } = useTranslation();
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
      {busy ? t("favorite.busy") : isFavorite ? t("favorite.remove") : t("favorite.add")}
    </button>
  );
}
