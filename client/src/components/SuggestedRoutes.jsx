import { Link } from "react-router-dom";
import { formatMiles, getSuggestedRoutes } from "../utils";

export default function SuggestedRoutes({
  routes = [],
  member,
  title = "Suggested routes",
  description = "A short list to keep people from starting from a blank map.",
  currentRouteId = null,
  actionLabel = "",
  onAction = null,
  showRideLink = true,
  className = ""
}) {
  const suggestions = getSuggestedRoutes(routes, currentRouteId);

  if (!suggestions.length) {
    return null;
  }

  return (
    <section className={`suggested-routes ${className}`.trim()}>
      <div className="suggested-routes__header">
        <div>
          <p className="section-kicker">Suggested routes</p>
          <h3>{title}</h3>
        </div>
        <p>{description}</p>
      </div>

      <div className="suggested-routes__grid">
        {suggestions.map((route) => (
          <article className="suggested-route-card" key={route.id}>
            <p className="suggested-route-card__eyebrow">{route.suggestionLabel}</p>
            <h4>{route.title}</h4>
            <p className="suggested-route-card__summary">{route.suggestionNote}</p>

            <div className="suggested-route-card__meta">
              <span>{formatMiles(route.distanceMiles)}</span>
              <span>{route.start}</span>
              <span>{route.terrain}</span>
            </div>

            <div className="suggested-route-card__actions">
              {onAction ? (
                <button
                  className="button button--primary button--sm"
                  onClick={() => onAction(route)}
                  type="button"
                >
                  {actionLabel}
                </button>
              ) : null}

              {showRideLink ? (
                member ? (
                  <Link className="button button--outline button--sm" to={`/routes/${route.id}/ride`}>
                    Open ride screen
                  </Link>
                ) : (
                  <Link className="button button--outline button--sm" to="/login">
                    Log in to ride
                  </Link>
                )
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
