import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// `minimal` hides the in-page section nav for routes other than the home page.
export default function TopBar({ minimal = false }) {
  const { member, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <p className="topbar-kicker">Minneapolis ride community</p>
        <Link className="brandmark" to="/">
          North Star Ridebook
        </Link>
      </div>

      {minimal ? null : (
        <nav className="topbar-nav" aria-label="Primary">
          <a href="#join">Roster</a>
          <a href="#routes">Routes</a>
          <a href="#photos">Photos</a>
          <a href="#journal">Journal</a>
        </nav>
      )}

      <div className="topbar-auth">
        {member ? (
          <>
            <Link className="topbar-rider" to={`/riders/${member.id}`}>
              {member.name}
            </Link>
            <button
              className="button button--outline button--sm"
              type="button"
              onClick={() => void logout()}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link className="button button--outline button--sm" to="/login">
              Log in
            </Link>
            <Link className="button button--primary button--sm" to="/signup">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
