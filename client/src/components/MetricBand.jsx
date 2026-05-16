import { formatMiles } from "../utils";

// Ride metrics for a rider, derived server-side from the rides log.
export default function MetricBand({ metrics }) {
  const safe = metrics ?? {
    milesBiked: 0,
    ridesTaken: 0,
    routesTaken: 0,
    longestRideMiles: 0
  };

  return (
    <section className="stats-band" aria-label="Rider metrics">
      <div>
        <span className="stat-label">Miles biked</span>
        <strong>{formatMiles(safe.milesBiked)}</strong>
      </div>
      <div>
        <span className="stat-label">Rides taken</span>
        <strong>{safe.ridesTaken}</strong>
      </div>
      <div>
        <span className="stat-label">Routes taken</span>
        <strong>{safe.routesTaken}</strong>
      </div>
      <div>
        <span className="stat-label">Longest ride</span>
        <strong>{formatMiles(safe.longestRideMiles)}</strong>
      </div>
    </section>
  );
}
