import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useForm } from "../hooks/useForm";
import { formatDate, formatMiles } from "../utils";
import FormFeedback from "./FormFeedback";
import LockedNote from "./LockedNote";

const emptyRouteForm = {
  title: "",
  distanceMiles: "",
  start: "",
  terrain: "city streets",
  notes: ""
};

export default function RouteBoard() {
  const { member } = useAuth();
  const { data, addItem } = useClubData();
  const { values, handleChange, reset } = useForm(emptyRouteForm);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const payload = await api.postJson("/api/routes", {
        ...values,
        distanceMiles: Number(values.distanceMiles)
      });
      addItem("routes", payload.route, payload.stats);
      reset();
      setFeedback({ type: "success", message: `Route saved: ${payload.route.title}.` });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-section content-section--split" id="routes">
      <div className="section-heading">
        <p className="section-kicker">Route board</p>
        <h2>Share the loops people actually ride, not just the ones on a brochure map.</h2>
        <p>
          Riders can log distance, the best place to start, terrain notes, and local knowledge
          that helps someone decide whether the route fits their day.
        </p>
      </div>

      <div className="section-body section-body--split">
        {member ? (
          <form className="editor editor--cool" onSubmit={handleSubmit}>
            <label>
              Route name
              <input
                name="title"
                value={values.title}
                onChange={handleChange}
                placeholder="West River recovery loop"
                required
              />
            </label>
            <label>
              Distance in miles
              <input
                name="distanceMiles"
                type="number"
                min="1"
                step="0.1"
                value={values.distanceMiles}
                onChange={handleChange}
                placeholder="18.5"
                required
              />
            </label>
            <label>
              Start point
              <input
                name="start"
                value={values.start}
                onChange={handleChange}
                placeholder="Stone Arch Bridge"
                required
              />
            </label>
            <label>
              Terrain
              <select name="terrain" value={values.terrain} onChange={handleChange}>
                <option value="city streets">City streets</option>
                <option value="greenway">Greenway</option>
                <option value="gravel">Gravel</option>
                <option value="mixed surface">Mixed surface</option>
              </select>
            </label>
            <label>
              Ride notes
              <textarea
                name="notes"
                rows="4"
                value={values.notes}
                onChange={handleChange}
                placeholder="Best before 9 a.m. Wind gets real along the river, but the views pay it back."
              />
            </label>
            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? "Posting..." : "Share route"}
            </button>
            <FormFeedback feedback={feedback} />
          </form>
        ) : (
          <LockedNote action="share a route" />
        )}

        <div className="stack-list">
          {data.routes.map((route) => (
            <article className="story-row" key={route.id}>
              <div className="story-meta">
                <span>{formatMiles(route.distanceMiles)}</span>
                <span>{route.start}</span>
                <span>{route.terrain}</span>
              </div>
              <h3>{route.title}</h3>
              <p>{route.notes}</p>
              <footer>
                <span>{route.createdBy}</span>
                <span>{formatDate(route.createdAt)}</span>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
