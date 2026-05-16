import { useState } from "react";
import { api } from "../api";
import { useForm } from "../hooks/useForm";
import FormFeedback from "./FormFeedback";

// Inline editor shown on a rider's own profile.
export default function ProfileEditForm({ member, onSaved, onCancel }) {
  const { values, handleChange } = useForm({
    neighborhood: member.neighborhood ?? "",
    pace: member.pace ?? "steady",
    bike: member.bike ?? "",
    bio: member.bio ?? ""
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const payload = await api.putJson("/api/riders/me", values);
      onSaved(payload.member);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
      setBusy(false);
    }
  }

  return (
    <form className="editor editor--warm profile-edit" onSubmit={handleSubmit}>
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
        Bike
        <input
          name="bike"
          value={values.bike}
          onChange={handleChange}
          placeholder="Steel all-road with fenders"
        />
      </label>
      <label>
        Rider bio
        <textarea
          name="bio"
          rows="4"
          value={values.bio}
          onChange={handleChange}
          placeholder="Bridge laps before work, coffee rides on weekends, and fall trail days."
        />
      </label>
      <div className="profile-edit__actions">
        <button className="button button--primary" type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save profile"}
        </button>
        <button
          className="button button--outline"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
      <FormFeedback feedback={feedback} />
    </form>
  );
}
