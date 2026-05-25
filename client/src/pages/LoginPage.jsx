import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import FormFeedback from "../components/FormFeedback";
import LanguageToggle from "../components/LanguageToggle";
import { useAuth } from "../context/AuthContext";
import { useForm } from "../hooks/useForm";
import { useTranslation } from "../i18n";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
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
        <div className="auth-card__top">
          <Link className="brandmark" to="/">
            Xxica
          </Link>
          <LanguageToggle />
        </div>
        <p className="section-kicker">{t("auth.loginKicker")}</p>
        <h1 className="auth-title">{t("auth.loginTitle")}</h1>

        <form className="editor editor--warm" onSubmit={handleSubmit}>
          <label>
            {t("auth.fieldEmail")}
            <input
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              placeholder={t("auth.fieldEmailPlaceholder")}
              autoComplete="email"
              required
            />
          </label>
          <label>
            {t("auth.fieldPassword")}
            <input
              name="password"
              type="password"
              value={values.password}
              onChange={handleChange}
              placeholder={t("auth.fieldPasswordPlaceholderLogin")}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button button--primary" type="submit" disabled={busy}>
            {busy ? t("auth.loginBusy") : t("auth.loginCta")}
          </button>
          <FormFeedback feedback={feedback} />
        </form>

        <p className="auth-switch">
          {t("auth.loginSwitchPrompt")} <Link to="/signup">{t("auth.loginSwitchAction")}</Link>
        </p>
      </div>
    </div>
  );
}
