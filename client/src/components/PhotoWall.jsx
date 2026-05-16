import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useForm } from "../hooks/useForm";
import FormFeedback from "./FormFeedback";
import LockedNote from "./LockedNote";
import RiderLink from "./RiderLink";

const emptyPhotoForm = {
  routeTag: "",
  caption: ""
};

export default function PhotoWall() {
  const { member } = useAuth();
  const { data, addItem } = useClubData();
  const { values, handleChange, reset } = useForm(emptyPhotoForm);
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const requestBody = new FormData();
      requestBody.append("routeTag", values.routeTag);
      requestBody.append("caption", values.caption);

      if (file) {
        requestBody.append("photo", file);
      }

      const payload = await api.postForm("/api/photos", requestBody);
      addItem("photos", payload.photo, payload.stats);
      reset();
      setFile(null);
      setFileInputKey((current) => current + 1);
      setFeedback({ type: "success", message: `Photo posted by ${payload.photo.createdBy}.` });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-section content-section--gallery" id="photos">
      <div className="section-heading">
        <p className="section-kicker">Photo wall</p>
        <h2>Let rides leave behind proof: river light, trail dust, coffee stops, and weather.</h2>
        <p>
          The backend stores uploads locally, so this MVP already supports real image sharing
          instead of mock photo cards.
        </p>
      </div>

      <div className="section-body section-body--gallery">
        {member ? (
          <form className="editor editor--dark" onSubmit={handleSubmit}>
            <label>
              Route tag
              <input
                name="routeTag"
                value={values.routeTag}
                onChange={handleChange}
                placeholder="Greenway shakeout"
                required
              />
            </label>
            <label>
              Caption
              <textarea
                name="caption"
                rows="4"
                value={values.caption}
                onChange={handleChange}
                placeholder="Tailwind through the corridor and a stop for cardamom buns after the ride."
                required
              />
            </label>
            <label>
              Upload image
              <input
                key={fileInputKey}
                name="photo"
                type="file"
                accept="image/*"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
              />
            </label>
            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? "Uploading..." : "Post photo"}
            </button>
            <FormFeedback feedback={feedback} />
          </form>
        ) : (
          <LockedNote action="post a ride photo" />
        )}

        <div className="photo-grid">
          {data.photos.map((photo, index) => (
            <article className="photo-tile" key={photo.id}>
              {photo.imageUrl ? (
                <img alt={photo.caption} src={photo.imageUrl} />
              ) : (
                <div className={`photo-placeholder tone-${index % 4}`}>
                  <span>{photo.routeTag}</span>
                </div>
              )}
              <div className="photo-copy">
                <p>{photo.caption}</p>
                <footer>
                  <RiderLink riderId={photo.createdById} name={photo.createdBy} />
                  <span>{photo.routeTag}</span>
                </footer>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
