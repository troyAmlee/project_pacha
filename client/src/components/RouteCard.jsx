import { formatDate, formatMiles } from "../utils";
import FavoriteButton from "./FavoriteButton";
import RiderLink from "./RiderLink";

// Shared route card used on the route board and on rider profiles.
export default function RouteCard({ route }) {
  return (
    <article className="story-row">
      <div className="story-meta">
        <span>{formatMiles(route.distanceMiles)}</span>
        <span>{route.start}</span>
        <span>{route.terrain}</span>
      </div>
      <h3>{route.title}</h3>
      <p>{route.notes}</p>
      <footer>
        <RiderLink riderId={route.createdById} name={route.createdBy} />
        <span>{formatDate(route.createdAt)}</span>
        <FavoriteButton routeId={route.id} />
      </footer>
    </article>
  );
}
