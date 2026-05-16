import { Link } from "react-router-dom";

// Shown in place of an editor form when a visitor is not signed in.
export default function LockedNote({ action }) {
  return (
    <div className="locked-note">
      <p className="locked-note__lead">Log in to {action}.</p>
      <p>
        North Star Ridebook credits every route, photo, and journal post to the rider who
        shared it, so contributing needs a club account.
      </p>
      <div className="locked-note__actions">
        <Link className="button button--primary" to="/login">
          Log in
        </Link>
        <Link className="button button--outline" to="/signup">
          Create account
        </Link>
      </div>
    </div>
  );
}
