import { useTranslation } from "../i18n";
import { formatMiles } from "../utils";

// Ride metrics for a rider, derived server-side from the rides log.
export default function MetricBand({ metrics }) {
  const { t } = useTranslation();
  const safe = metrics ?? {
    milesBiked: 0,
    ridesTaken: 0,
    routesTaken: 0,
    longestRideMiles: 0
  };

  return (
    <section className="stats-band" aria-label="Rider metrics">
      <div>
        <span className="stat-label">{t("metrics.milesBiked")}</span>
        <strong>{formatMiles(safe.milesBiked)}</strong>
      </div>
      <div>
        <span className="stat-label">{t("metrics.ridesTaken")}</span>
        <strong>{safe.ridesTaken}</strong>
      </div>
      <div>
        <span className="stat-label">{t("metrics.routesTaken")}</span>
        <strong>{safe.routesTaken}</strong>
      </div>
      <div>
        <span className="stat-label">{t("metrics.longestRide")}</span>
        <strong>{formatMiles(safe.longestRideMiles)}</strong>
      </div>
    </section>
  );
}
