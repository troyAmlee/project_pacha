import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import FormFeedback from "../components/FormFeedback";
import { useAuth } from "../context/AuthContext";
import { useForm } from "../hooks/useForm";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { values, handleChange } = useForm({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const redirectTo = location.state?.from?.pathname || "/";

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      await login(values);
      navigate(redirectTo, { replace: true });
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
        <p className="section-kicker">Member login</p>
        <h1 className="auth-title">Welcome back to the crew.</h1>

        <form className="editor editor--warm" onSubmit={handleSubmit}>
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
              placeholder="Your club password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button button--primary" type="submit" disabled={busy}>
            {busy ? "Logging in..." : "Log in"}
          </button>
          <FormFeedback feedback={feedback} />
        </form>

        <p className="auth-switch">
          New to the club? <Link to="/signup">Create a rider account</Link>
        </p>
      </div>
    </div>
  );
}
