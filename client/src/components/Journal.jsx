import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useForm } from "../hooks/useForm";
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
      setFeedback({ type: "success", message: `Journal post published: ${payload.post.title}.` });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-section content-section--split" id="journal">
      <div className="section-heading">
        <p className="section-kicker">Shared journal</p>
        <h2>Give the club a running blog space for ride reports, advocacy notes, and weekend plans.</h2>
        <p>
          This is the editorial layer of the app: longer updates, recurring series, and the
          voice of the group over time.
        </p>
      </div>

      <div className="section-body section-body--split">
        {member ? (
          <form className="editor editor--paper" onSubmit={handleSubmit}>
            <label>
              Post title
              <input
                name="title"
                value={values.title}
                onChange={handleChange}
                placeholder="Sunday social route notes"
                required
              />
            </label>
            <label>
              Story
              <textarea
                name="body"
                rows="7"
                value={values.body}
                onChange={handleChange}
                placeholder="Share route conditions, a ride recap, a volunteer note, or what the club should know before next weekend."
                required
              />
            </label>
            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? "Publishing..." : "Publish entry"}
            </button>
            <FormFeedback feedback={feedback} />
          </form>
        ) : (
          <LockedNote action="publish a journal entry" />
        )}

        <div className="stack-list stack-list--journal">
          {data.posts.map((post) => (
            <article className="journal-entry" key={post.id}>
              <p className="journal-entry__meta">
                <RiderLink riderId={post.createdById} name={post.createdBy} />
                {" - "}
                {formatDate(post.createdAt)}
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
