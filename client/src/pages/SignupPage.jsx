import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormFeedback from "../components/FormFeedback";
import LanguageToggle from "../components/LanguageToggle";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useForm } from "../hooks/useForm";
import { useTranslation } from "../i18n";

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
  const { t } = useTranslation();
  const { values, handleChange } = useForm(emptySignupForm);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      await signup(values);
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
        <div className="auth-card__top">
          <Link className="brandmark" to="/">
            Xxica
          </Link>
          <LanguageToggle />
        </div>
        <p className="section-kicker">{t("auth.signupKicker")}</p>
        <h1 className="auth-title">{t("auth.signupTitle")}</h1>

        <form className="editor editor--warm" onSubmit={handleSubmit}>
          <label>
            {t("auth.fieldName")}
            <input
              name="name"
              value={values.name}
              onChange={handleChange}
              placeholder={t("auth.fieldNamePlaceholder")}
              autoComplete="name"
              required
            />
          </label>
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
              placeholder={t("auth.fieldPasswordPlaceholderSignup")}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            {t("auth.fieldNeighborhood")}
            <input
              name="neighborhood"
              value={values.neighborhood}
              onChange={handleChange}
              placeholder={t("auth.fieldNeighborhoodPlaceholder")}
              required
            />
          </label>
          <label>
            {t("auth.fieldPace")}
            <select name="pace" value={values.pace} onChange={handleChange}>
              <option value="easy">{t("pace.easy")}</option>
              <option value="steady">{t("pace.steady")}</option>
              <option value="fast">{t("pace.fast")}</option>
            </select>
          </label>
          <label>
            {t("auth.fieldBio")}
            <textarea
              name="bio"
              rows="4"
              value={values.bio}
              onChange={handleChange}
              placeholder={t("auth.fieldBioPlaceholder")}
            />
          </label>
          <button className="button button--primary" type="submit" disabled={busy}>
            {busy ? t("auth.signupBusy") : t("auth.signupCta")}
          </button>
          <FormFeedback feedback={feedback} />
        </form>

        <p className="auth-switch">
          {t("auth.signupSwitchPrompt")} <Link to="/login">{t("auth.signupSwitchAction")}</Link>
        </p>
      </div>
    </div>
  );
}
