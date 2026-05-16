import { Link } from "react-router-dom";

// Renders a rider's name as a link to their profile when we know their id.
// Legacy content without a createdById falls back to plain text.
export default function RiderLink({ riderId, name, className }) {
  if (!riderId) {
    return <span className={className}>{name}</span>;
  }

  return (
    <Link className={className} to={`/riders/${riderId}`}>
      {name}
    </Link>
  );
}
