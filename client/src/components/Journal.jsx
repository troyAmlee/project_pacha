import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useForm } from "../hooks/useForm";
import { useTranslation } from "../i18n";
import { formatDate } from "../utils";
import FormFeedback from "./FormFeedback";
import LockedNote from "./LockedNote";
import RiderLink from "./RiderLink";

const emptyPostForm = {
  title: "",
  body: ""
};

export default function Journal() {
  const { member } = useAuth();
  const { data, addItem } = useClubData();
  const { t, lang } = useTranslation();
  const { values, handleChange, reset } = useForm(emptyPostForm);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const payload = await api.postJson("/api/posts", values);
      addItem("posts", payload.post, payload.stats);
      reset();
      setFeedback({
        type: "success",
        message: t("home.journalSuccess", { title: payload.post.title })
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-section content-section--split" id="journal">
      <div className="section-heading">
        <p className="section-kicker">{t("home.journalKicker")}</p>
        <h2>{t("home.journalTitle")}</h2>
        <p>{t("home.journalLead")}</p>
      </div>

      <div className="section-body section-body--split">
        {member ? (
          <form className="editor editor--paper" onSubmit={handleSubmit}>
            <label>
              {t("home.journalFormTitle")}
              <input
                name="title"
                value={values.title}
                onChange={handleChange}
                placeholder={t("home.journalFormTitlePlaceholder")}
                required
              />
            </label>
            <label>
              {t("home.journalFormBody")}
              <textarea
                name="body"
                rows="7"
                value={values.body}
                onChange={handleChange}
                placeholder={t("home.journalFormBodyPlaceholder")}
                required
              />
            </label>
            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? t("home.journalFormBusy") : t("home.journalFormSubmit")}
            </button>
            <FormFeedback feedback={feedback} />
          </form>
        ) : (
          <LockedNote action="locked.actionWriteJournal" />
        )}

        <div className="stack-list stack-list--journal">
          {data.posts.map((post) => (
            <article className="journal-entry" key={post.id}>
              <p className="journal-entry__meta">
                <RiderLink riderId={post.createdById} name={post.createdBy} />
                {" · "}
                {formatDate(post.createdAt, lang)}
              </p>
              <h3>{post.title}</h3>
              <p>{post.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
