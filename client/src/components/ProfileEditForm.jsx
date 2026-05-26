import { useMemo, useState } from "react";
import { api } from "../api";
import { useForm } from "../hooks/useForm";
import { useTranslation } from "../i18n";
import { getInitials } from "../utils";
import FormFeedback from "./FormFeedback";

const BIO_MAX = 280;

export default function ProfileEditForm({ member, onSaved, onCancel }) {
  const { t } = useTranslation();
  const { values, handleChange } = useForm({
    neighborhood: member.neighborhood ?? "",
    pace: member.pace ?? "steady",
    bike: member.bike ?? "",
    avatarUrl: member.avatarUrl ?? "",
    bio: member.bio ?? ""
  });
  const [home, setHome] = useState(
    Array.isArray(member.home) && member.home.length === 2 ? member.home : null
  );
  const [homeStatus, setHomeStatus] = useState(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [avatarOk, setAvatarOk] = useState(true);

  const bioCount = values.bio.length;
  const bioOver = bioCount > BIO_MAX;
  const previewUrl = useMemo(() => values.avatarUrl.trim(), [values.avatarUrl]);

  function captureCurrentLocation() {
    if (!navigator.geolocation) {
      setHomeStatus({ type: "error", message: t("profileEdit.homeGeoUnsupported") });
      return;
    }

    setLocating(true);
    setHomeStatus(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = [
          Number(position.coords.latitude.toFixed(6)),
          Number(position.coords.longitude.toFixed(6))
        ];
        setHome(next);
        setHomeStatus({ type: "success", message: t("profileEdit.homeCaptured") });
        setLocating(false);
      },
      (error) => {
        setHomeStatus({
          type: "error",
          message:
            error.code === 1
              ? t("profileEdit.homeGeoDenied")
              : t("profileEdit.homeGeoFailed")
        });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function clearHome() {
    setHome(null);
    setHomeStatus({ type: "success", message: t("profileEdit.homeCleared") });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (bioOver) {
      setFeedback({ type: "error", message: t("profileEdit.bioOverLimit", { max: BIO_MAX }) });
      return;
    }
    setBusy(true);
    setFeedback(null);

    try {
      const payload = await api.putJson("/api/riders/me", { ...values, home });
      onSaved(payload.member);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
      setBusy(false);
    }
  }

  return (
    <form className="editor editor--paper profile-edit" onSubmit={handleSubmit}>
      <div className="profile-edit__layout">
        <aside className="profile-edit__preview">
          <p className="section-kicker">{t("profileEdit.previewKicker")}</p>
          <div className="profile-edit__avatar">
            {previewUrl && avatarOk ? (
              <img
                alt="Avatar preview"
                onError={() => setAvatarOk(false)}
                onLoad={() => setAvatarOk(true)}
                src={previewUrl}
              />
            ) : (
              <span>{getInitials(member.name)}</span>
            )}
          </div>
          {previewUrl && !avatarOk ? (
            <p className="profile-edit__hint profile-edit__hint--warn">
              {t("profileEdit.previewHintWarn")}
            </p>
          ) : (
            <p className="profile-edit__hint">{t("profileEdit.previewHint")}</p>
          )}
        </aside>

        <div className="profile-edit__fields">
          <fieldset className="profile-edit__group">
            <legend>{t("profileEdit.legendIdentity")}</legend>
            <label>
              {t("profileEdit.labelNeighborhood")}
              <input
                name="neighborhood"
                value={values.neighborhood}
                onChange={handleChange}
                placeholder="Longfellow"
                required
              />
            </label>
            <label>
              {t("profileEdit.labelAvatar")}
              <input
                name="avatarUrl"
                value={values.avatarUrl}
                onChange={(event) => {
                  setAvatarOk(true);
                  handleChange(event);
                }}
                placeholder={t("profileEdit.labelAvatarPlaceholder")}
                type="url"
              />
            </label>
          </fieldset>

          <fieldset className="profile-edit__group">
            <legend>{t("profileEdit.legendRidingStyle")}</legend>
            <label>
              {t("profileEdit.labelPace")}
              <select name="pace" value={values.pace} onChange={handleChange}>
                <option value="easy">{t("pace.easy")}</option>
                <option value="steady">{t("pace.steady")}</option>
                <option value="fast">{t("pace.fast")}</option>
              </select>
            </label>
            <label>
              {t("profileEdit.labelBike")}
              <input
                name="bike"
                value={values.bike}
                onChange={handleChange}
                placeholder={t("profileEdit.labelBikePlaceholder")}
              />
            </label>
          </fieldset>

          <fieldset className="profile-edit__group">
            <legend>{t("profileEdit.legendHome")}</legend>
            <p className="profile-edit__hint">{t("profileEdit.homeHint")}</p>
            <div className="profile-edit__home">
              <div className="profile-edit__home-readout" aria-live="polite">
                {home
                  ? t("profileEdit.homeCoords", {
                      lat: home[0].toFixed(5),
                      lng: home[1].toFixed(5)
                    })
                  : t("profileEdit.homeNone")}
              </div>
              <div className="profile-edit__home-actions">
                <button
                  type="button"
                  className="button button--outline button--sm"
                  onClick={captureCurrentLocation}
                  disabled={locating || busy}
                >
                  {locating ? t("profileEdit.homeLocating") : t("profileEdit.homeUseCurrent")}
                </button>
                {home ? (
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={clearHome}
                    disabled={busy}
                  >
                    {t("profileEdit.homeClear")}
                  </button>
                ) : null}
              </div>
              {homeStatus ? (
                <p
                  className={`profile-edit__hint${
                    homeStatus.type === "error" ? " profile-edit__hint--warn" : ""
                  }`}
                >
                  {homeStatus.message}
                </p>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="profile-edit__group">
            <legend>{t("profileEdit.legendAbout")}</legend>
            <label>
              <span className="profile-edit__label-row">
                <span>{t("profileEdit.labelBio")}</span>
                <span
                  className={`profile-edit__counter${bioOver ? " profile-edit__counter--over" : ""}`}
                >
                  {t("profileEdit.counter", { count: bioCount, max: BIO_MAX })}
                </span>
              </span>
              <textarea
                name="bio"
                rows="4"
                value={values.bio}
                onChange={handleChange}
                placeholder={t("profileEdit.labelBioPlaceholder")}
              />
            </label>
          </fieldset>
        </div>
      </div>

      <div className="profile-edit__actions">
        <button className="button button--primary" type="submit" disabled={busy || bioOver}>
          {busy ? t("profileEdit.saveBusy") : t("profileEdit.saveButton")}
        </button>
        <button
          className="button button--outline"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          {t("common.cancel")}
        </button>
      </div>
      <FormFeedback feedback={feedback} />
    </form>
  );
}
