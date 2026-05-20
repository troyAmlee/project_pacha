import { getInitials } from "../utils";

export default function RiderAvatar({ rider, className }) {
  return (
    <div className={className}>
      {rider.avatarUrl ? (
        <img alt={`${rider.name} avatar`} src={rider.avatarUrl} />
      ) : (
        getInitials(rider.name)
      )}
    </div>
  );
}
