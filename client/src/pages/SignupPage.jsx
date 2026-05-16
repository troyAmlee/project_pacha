import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormFeedback from "../components/FormFeedback";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useForm } from "../hooks/useForm";

const emptySignupForm = {
  name: "",
  email: "",
  password: "",
  neighborhood: "",
  pace: "steady",
  bio: ""
};

export default function SignupPage() {
  const { signup } = useAuth();
  const { loadBootstrap } = useClubData();
  const navigate = useNavigate();
  const { values, handleChange } = useForm(emptySignupForm);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      await signup(values);
      // Refresh club data so the new rider appears on the roster immediately.
      await loadBootstrap();
      navigate("/", { replace: true });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link className="brandmark" to="/">
          North Star Ridebook
        </Link>
        <p className="section-kicker">Join the club</p>
        <h1 className="auth-title">Create your rider profile.</h1>

        <form className="editor editor--warm" onSubmit={handleSubmit}>
          <label>
            Rider name
            <input
              name="name"
              value={values.name}
              onChange={handleChange}
              placeholder="Asha Patel"
              autoComplete="name"
              required
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              placeholder="rider@northstar.club"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              value={values.password}
              onChange={handleChange}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Neighborhood
            <input
              name="neighborhood"
              value={values.neighborhood}
              onChange={handleChange}
              placeholder="Longfellow"
              required
            />
          </label>
          <label>
            Ride pace
            <select name="pace" value={values.pace} onChange={handleChange}>
              <option value="easy">Easy cruise</option>
              <option value="steady">Steady spin</option>
              <option value="fast">Fast group</option>
            </select>
          </label>
          <label>
            What do you ride for?
            <textarea
              name="bio"
              rows="4"
              value={values.bio}
              onChange={handleChange}
              placeholder="Bridge laps before work, coffee rides on weekends, and fall trail days."
            />
          </label>
          <button className="button button--primary" type="submit" disabled={busy}>
            {busy ? "Creating account..." : "Create account"}
          </button>
          <FormFeedback feedback={feedback} />
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
