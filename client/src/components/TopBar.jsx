import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function TopBar() {
  const { member, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <p className="topbar-kicker">Minneapolis ride community</p>
        <a className="brandmark" href="#top">
          North Star Ridebook
        </a>
      </div>

      <nav className="topbar-nav" aria-label="Primary">
        <a href="#join">Roster</a>
        <a href="#routes">Routes</a>
        <a href="#photos">Photos</a>
        <a href="#journal">Journal</a>
      </nav>

      <div className="topbar-auth">
        {member ? (
          <>
            <span className="topbar-rider">{member.name}</span>
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
