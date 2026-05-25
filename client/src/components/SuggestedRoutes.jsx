import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { formatMiles, getSuggestedRoutes } from "../utils";

const LABEL_KEYS = {
  "Best first ride": "suggested.labelBest",
  "Minneapolis classic": "suggested.labelClassic",
  "Longer training pull": "suggested.labelLong",
  "Quick spin": "suggested.labelQuick",
  "Crew favorite": "suggested.labelFavorite",
  "Club favorite": "suggested.labelFavorite"
};

const NOTE_KEYS = {
  "Best first ride": "suggested.noteBest",
  "Minneapolis classic": "suggested.noteClassic",
  "Longer training pull": "suggested.noteLong"
};

export default function SuggestedRoutes({
  routes = [],
  member,
  title,
  description,
  currentRouteId = null,
  actionLabel = "",
  onAction = null,
  showRideLink = true,
  className = ""
}) {
  const { t } = useTranslation();
  const suggestions = getSuggestedRoutes(routes, currentRouteId);

  if (!suggestions.length) {
    return null;
  }

  const headingTitle = title || t("suggested.title");
  const headingDescription = description || t("suggested.description");

  return (
    <section className={`suggested-routes ${className}`.trim()}>
      <div className="suggested-routes__header">
        <div>
          <p className="section-kicker">{t("home.routeBoardKicker")}</p>
          <h3>{headingTitle}</h3>
        </div>
        <p>{headingDescription}</p>
      </div>

      <div className="suggested-routes__grid">
        {suggestions.map((route) => {
          const labelKey = LABEL_KEYS[route.suggestionLabel];
          const noteKey = NOTE_KEYS[route.suggestionLabel];
          const isQuick = route.distanceMiles <= 12;
          const fallbackNote = isQuick ? "suggested.noteQuick" : "suggested.noteFavorite";
          const terrainLabel = t(`terrain.${route.terrain}`) || route.terrain;

          return (
            <article className="suggested-route-card" key={route.id}>
              <p className="suggested-route-card__eyebrow">
                {labelKey ? t(labelKey) : route.suggestionLabel}
              </p>
              <h4>{route.title}</h4>
              <p className="suggested-route-card__summary">
                {noteKey ? t(noteKey) : t(fallbackNote)}
              </p>

              <div className="suggested-route-card__meta">
                <span>{formatMiles(route.distanceMiles)}</span>
                <span>{route.start}</span>
                <span>{terrainLabel}</span>
              </div>

              <div className="suggested-route-card__actions">
                {onAction ? (
                  <button
                    className="button button--primary button--sm"
                    onClick={() => onAction(route)}
                    type="button"
                  >
                    {actionLabel || t("suggested.action")}
                  </button>
                ) : null}

                {showRideLink ? (
                  member ? (
                    <Link className="button button--outline button--sm" to={`/routes/${route.id}/ride`}>
                      {t("routeCard.viewRoute")}
                    </Link>
                  ) : (
                    <Link className="button button--outline button--sm" to="/login">
                      {t("common.logIn")}
                    </Link>
                  )
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
