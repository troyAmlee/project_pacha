import { useTranslation } from "../i18n";
import { formatNavigationDistance } from "../utils";

export default function DirectionsPanel({
  directionSections,
  navigationState,
  onClose,
  routingProviderLabel,
  routingStatus,
  totalDirectionSteps
}) {
  const { t } = useTranslation();
  return (
    <aside
      aria-labelledby="directions-panel-title"
      className="directions-panel"
      id="directions-panel"
    >
      <div className="directions-panel__header">
        <div>
          <p className="group-card__eyebrow">{t("directions.kicker")}</p>
          <h2 id="directions-panel-title">{t("directions.title")}</h2>
          <p>
            {navigationState?.cue?.primary ??
              (routingStatus === "loading" ? t("directions.loading") : t("directions.idle"))}
          </p>
        </div>
        <button
          aria-label={t("directions.hide")}
          className="directions-panel__close"
          onClick={onClose}
          type="button"
        >
          {t("directions.hide")}
        </button>
      </div>

      <div className="directions-panel__summary">
        <span>{t("directions.steps", { count: totalDirectionSteps })}</span>
        <span>
          {routingProviderLabel
            ? t("rideScreen.cueRoutingWith", { provider: routingProviderLabel })
            : routingStatus === "loading"
              ? t("rideScreen.cueRoutingLoading")
              : t("rideScreen.cueRoutingFallback")}
        </span>
        {navigationState ? (
          <span>{t("rideScreen.cueRemaining", { miles: formatNavigationDistance(navigationState.remainingMiles) })}</span>
        ) : null}
      </div>

      <div className="directions-panel__body">
        {directionSections.map((section) => (
          <section className="directions-panel__section" key={section.key}>
            <div className="directions-panel__section-heading">
              <h3>{section.title}</h3>
              {section.summary ? <span>{section.summary}</span> : null}
            </div>
            <ol className="directions-panel__steps">
              {section.steps.map((step) => {
                const active =
                  navigationState?.activeLeg === section.leg &&
                  navigationState?.cue?.stepIndex === step.originalIndex;

                return (
                  <li
                    className={`directions-panel__step${active ? " is-active" : ""}`}
                    key={step.key}
                  >
                    <span
                      aria-hidden="true"
                      className={`directions-panel__step-icon directions-panel__step-icon--${step.kind}`}
                    />
                    <div className="directions-panel__step-copy">
                      <strong>{step.instruction}</strong>
                      <span>{step.detail}</span>
                    </div>
                    <div className="directions-panel__step-meta">
                      <span>{step.distanceLabel}</span>
                      {active ? <b>{t("directions.current")}</b> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </aside>
  );
}
